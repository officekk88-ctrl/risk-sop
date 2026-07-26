import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const uploadDirectory = path.join(process.cwd(), ".data", "uploads");

const allowedFiles: Record<string, { mimeTypes: string[]; signature: (buffer: Buffer) => boolean }> = {
  ".pdf": { mimeTypes: ["application/pdf"], signature: (buffer) => buffer.subarray(0, 4).toString() === "%PDF" },
  ".docx": { mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"], signature: (buffer) => buffer[0] === 0x50 && buffer[1] === 0x4b },
  ".xlsx": { mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"], signature: (buffer) => buffer[0] === 0x50 && buffer[1] === 0x4b },
  ".zip": { mimeTypes: ["application/zip", "application/x-zip-compressed", "application/octet-stream"], signature: (buffer) => buffer[0] === 0x50 && buffer[1] === 0x4b },
  ".png": { mimeTypes: ["image/png"], signature: (buffer) => buffer.subarray(1, 4).toString() === "PNG" },
  ".jpg": { mimeTypes: ["image/jpeg"], signature: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  ".jpeg": { mimeTypes: ["image/jpeg"], signature: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
};

const knowledgeFiles: Record<string, { mimeTypes: string[]; signature: (buffer: Buffer) => boolean }> = {
  ".pdf": allowedFiles[".pdf"],
  ".docx": allowedFiles[".docx"],
  ".xlsx": { mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"], signature: (buffer) => buffer[0] === 0x50 && buffer[1] === 0x4b },
  ".md": { mimeTypes: ["text/markdown", "text/plain", "application/octet-stream", ""], signature: isUtf8Text },
  ".txt": { mimeTypes: ["text/plain", "application/octet-stream", ""], signature: isUtf8Text },
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

async function saveFileWithRules(file: File, rules: typeof allowedFiles, errorMessage: string) {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error("文件必须大于 0 且不超过 10MB");
  const extension = path.extname(file.name).toLowerCase();
  const rule = rules[extension];
  if (!rule || !rule.mimeTypes.includes(file.type)) throw new Error(errorMessage);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!rule.signature(buffer)) throw new Error("文件内容与扩展名不一致，已拒绝上传");
  await mkdir(uploadDirectory, { recursive: true });
  const storageKey = `${randomUUID()}${extension}`;
  await writeFile(path.join(uploadDirectory, storageKey), buffer, { flag: "wx" });
  return { storageKey, mimeType: file.type || "application/octet-stream", sizeBytes: buffer.length };
}

export async function saveValidatedFile(file: File): Promise<{ storageKey: string; mimeType: string; sizeBytes: number }> {
  return saveFileWithRules(file, allowedFiles, "仅支持 PDF、DOCX、XLSX、ZIP、JPG、JPEG 和 PNG 文件");
}

export async function saveValidatedKnowledgeFile(file: File): Promise<{ storageKey: string; mimeType: string; sizeBytes: number }> {
  return saveFileWithRules(file, knowledgeFiles, "知识库仅支持 PDF、DOCX、XLSX、MD 和 TXT 文件");
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  if (!/^[a-f0-9-]+\.(pdf|docx|xlsx|zip|md|txt|png|jpe?g)$/i.test(storageKey)) throw new Error("非法文件标识");
  return readFile(path.join(uploadDirectory, storageKey));
}
