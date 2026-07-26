"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { KNOWLEDGE_IMPORT_PROMPT_VERSION, runKnowledgeDocumentImport } from "@/lib/ai-knowledge-import";
import { parseDocumentBuffer } from "@/lib/document-parser";
import { readStoredFile, saveValidatedKnowledgeFile } from "@/lib/file-storage";
import { aiModel, isAIConfigured } from "@/lib/openai-client";
import { completeKnowledgeSourceImport, createKnowledgeSourceDocument, failKnowledgeSourceImport, submitKnowledgeEntry, updateKnowledgeEntry } from "@/lib/mvp-store";

const categorySchema = z.enum(["SITE_PROPERTY", "PLANNING_USE", "FIRE_SAFETY", "CONSTRUCTION", "LEASE_LEGAL", "LICENSE_COMPLIANCE", "SPORTS_OPERATION", "SAFETY_INSURANCE", "FINANCE_TAX", "ENVIRONMENT_NEIGHBOR", "OTHER"]);
const entrySchema = z.object({
  category: categorySchema,
  title: z.string().trim().min(2, "标题至少2个字").max(100),
  summary: z.string().trim().min(5, "摘要至少5个字").max(300),
  content: z.string().trim().min(10, "知识正文至少10个字").max(12000),
  keywords: z.string().max(300).transform((value) => value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean)),
  sourceName: z.string().trim().max(200),
  sourceUrl: z.string().trim().max(1000).refine((value) => !value || URL.canParse(value), "来源链接格式不正确"),
});

function withMessage(type: "notice" | "error", message: string): never {
  redirect(`/knowledge?${type}=${encodeURIComponent(message)}`);
}

export async function submitKnowledgeAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = entrySchema.safeParse(Object.fromEntries(formData));
  if (!input.success) withMessage("error", input.error.issues[0]?.message ?? "请检查知识内容。");
  await submitKnowledgeEntry({ email: session.email, ...input.data });
  revalidatePath("/knowledge");
  withMessage("notice", "知识候选已保存，管理员审核发布后会进入 AI 长期记忆。");
}

export async function importKnowledgeDocumentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAIConfigured()) withMessage("error", "AI 服务尚未配置，无法阅读和导入文档。");
  const file = formData.get("file");
  if (!(file instanceof File)) withMessage("error", "请选择要导入的文档。");

  let sourceId: string | null = null;
  let importedCount = 0;
  try {
    const saved = await saveValidatedKnowledgeFile(file);
    const source = await createKnowledgeSourceDocument({ email: session.email, fileName: file.name.slice(0, 180), ...saved });
    sourceId = source.id;
    const buffer = await readStoredFile(saved.storageKey);
    const parsed = await parseDocumentBuffer(file.name, saved.mimeType, buffer);
    const output = await runKnowledgeDocumentImport(file.name, parsed.text);
    const aiSummary = [output.documentSummary, ...output.warnings.map((warning) => `注意：${warning}`)].join("\n");
    const entries = await completeKnowledgeSourceImport({
      sourceId: source.id, email: session.email, role: session.role, parseMethod: parsed.method,
      extractedText: parsed.text, aiSummary, aiModel, promptVersion: KNOWLEDGE_IMPORT_PROMPT_VERSION, entries: output.entries,
    });
    importedCount = entries.length;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "文档读取或 AI 导入失败。";
    if (sourceId) await failKnowledgeSourceImport({ sourceId, email: session.email, role: session.role, error: message });
    revalidatePath("/knowledge");
    withMessage("error", message);
  }
  revalidatePath("/knowledge");
  withMessage("notice", importedCount ? `AI 已阅读文档并生成 ${importedCount} 条待审核知识。` : "AI 已阅读文档，但未发现与开馆尽调相关的可导入知识。");
}

export async function updateKnowledgeAction(entryId: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") withMessage("error", "仅管理员可以审核和维护知识。");
  const parsed = entrySchema.extend({ status: z.enum(["PENDING", "PUBLISHED", "ARCHIVED"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) withMessage("error", parsed.error.issues[0]?.message ?? "请检查知识内容。");
  try {
    await updateKnowledgeEntry({ actorEmail: session.email, actorRole: session.role, entryId, ...parsed.data });
  } catch (error) {
    withMessage("error", error instanceof Error ? error.message.slice(0, 200) : "知识更新失败。");
  }
  revalidatePath("/knowledge");
  revalidatePath("/ai");
  withMessage("notice", parsed.data.status === "PUBLISHED" ? "知识已审核发布，后续 AI 咨询可检索使用。" : "知识状态与内容已更新。");
}
