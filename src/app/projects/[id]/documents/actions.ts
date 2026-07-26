"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import type { DocumentCategory } from "@/lib/domain";
import { parseDocumentBuffer } from "@/lib/document-parser";
import { readStoredFile, saveValidatedFile } from "@/lib/file-storage";
import { addDocument, getDocument, getProject, setDocumentParseResult, softDeleteDocument } from "@/lib/mvp-store";

const categorySchema = z.enum(["OWNERSHIP", "AUTHORIZATION", "CONTRACT", "FIRE", "PLANNING", "ENGINEERING", "SITE_PHOTO", "OTHER"]);

export async function uploadDocumentAction(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await getProject(projectId, session.email, session.role))) throw new Error("无权访问该项目");
  const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
  if (!files.length) throw new Error("请选择文件");
  const category = categorySchema.parse(formData.get("category")) as DocumentCategory;
  const metadata = z.object({ source: z.string().trim().max(200), provider: z.string().trim().max(200), evidenceForm: z.enum(["ORIGINAL_VERIFIED","COPY","SCAN","ORIGINAL_PENDING"]), expiresAt: z.string().trim().max(20), tags: z.string().trim().max(300) }).parse(Object.fromEntries(formData));
  for (const file of files.slice(0, 20)) {
    const saved = await saveValidatedFile(file);
    const document = await addDocument({ projectId, email: session.email, role: session.role, category, fileName: file.name.slice(0, 180), ...saved,
      ...metadata, tags: metadata.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), sensitive: formData.get("sensitive") === "on" });
    if (!document) throw new Error("文件登记失败");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents`);
}

export async function deleteDocumentAction(projectId: string, documentId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  const document = await softDeleteDocument(projectId, documentId, session.email, session.role);
  if (!document) throw new Error("无权删除该文件或文件不存在");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents`);
}

export async function parseDocumentAction(projectId: string, documentId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  const document = await getDocument(projectId, documentId, session.email, session.role);
  if (!document) throw new Error("无权解析该文件或文件不存在");
  await setDocumentParseResult({ projectId, documentId, email: session.email, role: session.role, status: "PROCESSING" });
  try {
    const buffer = await readStoredFile(document.storageKey);
    const result = await parseDocumentBuffer(document.fileName, document.mimeType, buffer);
    await setDocumentParseResult({ projectId, documentId, email: session.email, role: session.role, status: "COMPLETED", extractedText: result.text, pageCount: result.pageCount });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "文档解析失败";
    await setDocumentParseResult({ projectId, documentId, email: session.email, role: session.role, status: "FAILED", error: message });
  }
  revalidatePath(`/projects/${projectId}/documents`);
  revalidatePath(`/projects/${projectId}/ai`);
}
