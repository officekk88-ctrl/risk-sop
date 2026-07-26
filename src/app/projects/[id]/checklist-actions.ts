"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runChecklistAIAssessment, CHECKLIST_AI_PROMPT_VERSION } from "@/lib/ai-checklist-assessment";
import { getSession } from "@/lib/auth";
import type { ChecklistAIAssessment, DocumentCategory } from "@/lib/domain";
import { parseDocumentBuffer } from "@/lib/document-parser";
import { readStoredFile, saveValidatedFile } from "@/lib/file-storage";
import { aiModel, isAIConfigured } from "@/lib/openai-client";
import { addDocument, getProject, listDocuments, setChecklistAIAssessment, setDocumentParseResult, updateChecklistAIAssessment } from "@/lib/mvp-store";

function categoryFor(code: string): DocumentCategory {
  if (code.startsWith("OWN")) return "OWNERSHIP";
  if (code.startsWith("USE")) return "PLANNING";
  if (code.startsWith("FIR")) return "FIRE";
  if (code.startsWith("ENG")) return "ENGINEERING";
  if (code.startsWith("CTR")) return "CONTRACT";
  return "OTHER";
}

function assessmentBase(documentId: string, email: string, previousCreatedAt?: string): ChecklistAIAssessment {
  const timestamp = new Date().toISOString();
  return {
    status: "PROCESSING",
    judgment: "VERIFY",
    analysis: "材料已上传，正在解析并进行AI初判。",
    evidence: "",
    recommendation: "",
    confidence: "LOW",
    requiresExpertReview: true,
    documentId,
    promptVersion: CHECKLIST_AI_PROMPT_VERSION,
    model: aiModel,
    error: "",
    source: "AI",
    updatedBy: email,
    createdAt: previousCreatedAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function revalidate(projectId: string) {
  revalidatePath("/checklists");
  revalidatePath("/documents");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents`);
  revalidatePath(`/projects/${projectId}/ai`);
}

export async function uploadChecklistEvidenceAction(projectId: string, checklistCode: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const project = await getProject(projectId, session.email, session.role);
  const checklistItem = project?.checklist.find((item) => item.code === checklistCode);
  if (!project || !checklistItem) throw new Error("无权访问该检查项。");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("请选择材料文件。");

  const saved = await saveValidatedFile(file);
  const document = await addDocument({
    projectId,
    email: session.email,
    role: session.role,
    category: categoryFor(checklistCode),
    fileName: file.name.slice(0, 180),
    checklistCodes: [checklistCode],
    ...saved,
  });
  if (!document) throw new Error("材料登记失败。");

  const processing = assessmentBase(document.id, session.email, checklistItem.aiAssessment?.createdAt);
  await setChecklistAIAssessment({ projectId, checklistCode, email: session.email, role: session.role, assessment: processing });
  await setDocumentParseResult({ projectId, documentId: document.id, email: session.email, role: session.role, status: "PROCESSING" });

  try {
    const buffer = await readStoredFile(document.storageKey);
    const parsed = await parseDocumentBuffer(document.fileName, document.mimeType, buffer);
    await setDocumentParseResult({ projectId, documentId: document.id, email: session.email, role: session.role, status: "COMPLETED", extractedText: parsed.text, pageCount: parsed.pageCount });

    if (!isAIConfigured()) throw new Error("AI服务未配置；材料已保存并完成解析，可手工填写初判。");
    const currentProject = await getProject(projectId, session.email, session.role);
    const allDocuments = await listDocuments(projectId, session.email, session.role);
    const currentItem = currentProject?.checklist.find((item) => item.code === checklistCode);
    const linked = allDocuments?.filter((item) => item.checklistCodes.includes(checklistCode) && item.parseStatus === "COMPLETED" && item.extractedText) ?? [];
    if (!currentProject || !currentItem || !linked.length) throw new Error("无法组装检查项分析上下文。");
    const output = await runChecklistAIAssessment(currentProject, currentItem, linked);
    const completedAt = new Date().toISOString();
    await setChecklistAIAssessment({
      projectId,
      checklistCode,
      email: session.email,
      role: session.role,
      assessment: { ...processing, ...output, status: "COMPLETED", error: "", updatedAt: completedAt },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "材料解析或AI初判失败。";
    const latestDocument = (await listDocuments(projectId, session.email, session.role))?.find((item) => item.id === document.id);
    if (latestDocument?.parseStatus === "PROCESSING") {
      await setDocumentParseResult({ projectId, documentId: document.id, email: session.email, role: session.role, status: "FAILED", error: message });
    }
    await setChecklistAIAssessment({
      projectId,
      checklistCode,
      email: session.email,
      role: session.role,
      assessment: { ...processing, status: "FAILED", analysis: "AI初判未完成，请核对已解析材料并手工补充。", recommendation: "检查材料内容、AI配置或重新上传。", error: message, updatedAt: new Date().toISOString() },
    });
  }
  revalidate(projectId);
}

const manualAssessmentSchema = z.object({
  judgment: z.enum(["PASSED", "FAILED", "VERIFY"]),
  analysis: z.string().trim().min(3).max(2000),
  evidence: z.string().trim().max(2000),
  recommendation: z.string().trim().max(2000),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  requiresExpertReview: z.preprocess((value) => value === "on", z.boolean()),
});

export async function updateChecklistAssessmentAction(projectId: string, checklistCode: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = manualAssessmentSchema.parse(Object.fromEntries(formData));
  const updated = await updateChecklistAIAssessment({ projectId, checklistCode, email: session.email, role: session.role, ...input });
  if (!updated) throw new Error("初判记录不存在或无权修改。");
  revalidate(projectId);
}
