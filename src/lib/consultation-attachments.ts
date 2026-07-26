import "server-only";

import path from "node:path";
import { parseDocumentBuffer } from "@/lib/document-parser";

export const MAX_CONSULTATION_ATTACHMENTS = 4;
export const MAX_CONSULTATION_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_CONSULTATION_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENT_TEXT = 20_000;
const MAX_ALL_ATTACHMENT_TEXT = 50_000;

export const CONSULTATION_ATTACHMENT_ACCEPT = ".pdf,.docx,.xlsx,.md,.txt,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

type ValidatedAttachment = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  isImage: boolean;
};

export type PreparedConsultationAttachments = {
  names: string[];
  textContext: string;
  images: Array<{ type: "input_image"; detail: "auto"; image_url: string }>;
};

function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function isWebp(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
}

async function validateAttachment(file: File): Promise<ValidatedAttachment> {
  if (!file.size || file.size > MAX_CONSULTATION_ATTACHMENT_BYTES) throw new Error(`附件“${file.name}”必须大于 0 且不超过 10MB`);
  const extension = path.extname(file.name).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const rules: Record<string, { mimes: string[]; mimeType: string; valid: boolean; image?: boolean }> = {
    ".pdf": { mimes: ["application/pdf", "application/octet-stream"], mimeType: "application/pdf", valid: buffer.subarray(0, 4).toString() === "%PDF" },
    ".docx": { mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"], mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", valid: zip },
    ".xlsx": { mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"], mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", valid: zip },
    ".md": { mimes: ["text/markdown", "text/plain", "application/octet-stream", ""], mimeType: "text/markdown", valid: isUtf8Text(buffer) },
    ".txt": { mimes: ["text/plain", "application/octet-stream", ""], mimeType: "text/plain", valid: isUtf8Text(buffer) },
    ".png": { mimes: ["image/png", "application/octet-stream"], mimeType: "image/png", valid: buffer.subarray(1, 4).toString() === "PNG", image: true },
    ".jpg": { mimes: ["image/jpeg", "application/octet-stream"], mimeType: "image/jpeg", valid: buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff, image: true },
    ".jpeg": { mimes: ["image/jpeg", "application/octet-stream"], mimeType: "image/jpeg", valid: buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff, image: true },
    ".webp": { mimes: ["image/webp", "application/octet-stream"], mimeType: "image/webp", valid: isWebp(buffer), image: true },
  };
  const rule = rules[extension];
  if (!rule || !rule.mimes.includes(file.type)) throw new Error(`附件“${file.name}”格式不支持，仅支持 PDF、DOCX、XLSX、MD、TXT、PNG、JPG 和 WEBP`);
  if (!rule.valid) throw new Error(`附件“${file.name}”内容与扩展名不一致，已拒绝上传`);
  return { fileName: file.name.slice(0, 180), mimeType: rule.mimeType, buffer, isImage: Boolean(rule.image) };
}

export async function prepareConsultationAttachments(files: File[]): Promise<PreparedConsultationAttachments> {
  if (files.length > MAX_CONSULTATION_ATTACHMENTS) throw new Error(`单次最多添加 ${MAX_CONSULTATION_ATTACHMENTS} 个附件`);
  if (files.reduce((total, file) => total + file.size, 0) > MAX_CONSULTATION_TOTAL_BYTES) throw new Error("单次附件总大小不能超过 20MB");
  const validated = await Promise.all(files.map(validateAttachment));
  const textParts: string[] = [];
  const images: PreparedConsultationAttachments["images"] = [];
  let textLength = 0;

  for (const attachment of validated) {
    if (attachment.isImage) {
      images.push({ type: "input_image", detail: "auto", image_url: `data:${attachment.mimeType};base64,${attachment.buffer.toString("base64")}` });
      continue;
    }
    const parsed = await parseDocumentBuffer(attachment.fileName, attachment.mimeType, attachment.buffer);
    const remaining = MAX_ALL_ATTACHMENT_TEXT - textLength;
    if (remaining <= 0) break;
    const text = parsed.text.slice(0, Math.min(MAX_ATTACHMENT_TEXT, remaining));
    textParts.push(`附件：${attachment.fileName}（解析方式：${parsed.method}）\n<attachment>\n${text}\n</attachment>`);
    textLength += text.length;
  }

  return {
    names: validated.map((attachment) => attachment.fileName),
    textContext: textParts.join("\n\n"),
    images,
  };
}
