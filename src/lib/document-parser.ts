import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/node";
import Tesseract from "tesseract.js";
import { extractText, renderPageAsImage } from "unpdf";

const MAX_TEXT_LENGTH = 500_000;
const MAX_OCR_PDF_PAGES = 10;

export type ParsedDocument = {
  text: string;
  pageCount: number | null;
  method: "PDF_TEXT" | "PDF_OCR" | "DOCX_TEXT" | "XLSX_TEXT" | "MARKDOWN_TEXT" | "PLAIN_TEXT" | "IMAGE_OCR";
};

function normalizeText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, MAX_TEXT_LENGTH);
}

async function recognizeImage(image: Buffer): Promise<string> {
  const languages = process.env.OCR_LANGUAGES?.trim() || "chi_sim+eng";
  const cachePath = path.join(process.cwd(), ".data", "tesseract-cache");
  await mkdir(cachePath, { recursive: true });
  const result = await Tesseract.recognize(image, languages, { cachePath });
  return normalizeText(result.data.text);
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const pdf = new Uint8Array(buffer);
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = extracted.text.map((text, index) => normalizeText(`--- 第 ${index + 1} 页 ---\n${text}`));
  const merged = normalizeText(pages.join("\n\n"));
  if (merged.replace(/--- 第 \d+ 页 ---/g, "").trim()) {
    return { text: merged, pageCount: extracted.totalPages, method: "PDF_TEXT" };
  }

  const ocrPages: string[] = [];
  const pageLimit = Math.min(extracted.totalPages, MAX_OCR_PDF_PAGES);
  for (let page = 1; page <= pageLimit; page += 1) {
    const image = await renderPageAsImage(pdf, page, { scale: 1.5 });
    ocrPages.push(`--- 第 ${page} 页（OCR）---\n${await recognizeImage(Buffer.from(image))}`);
  }
  const text = normalizeText(ocrPages.join("\n\n"));
  if (!text.replace(/--- 第 \d+ 页（OCR）---/g, "").trim()) throw new Error("未能从 PDF 中识别出文字");
  return { text, pageCount: extracted.totalPages, method: "PDF_OCR" };
}

export async function parseDocumentBuffer(fileName: string, mimeType: string, buffer: Buffer): Promise<ParsedDocument> {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") return parsePdf(buffer);
  if (lowerName.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    const text = normalizeText(result.value);
    if (!text) throw new Error("未能从 DOCX 中提取出文字");
    return { text, pageCount: null, method: "DOCX_TEXT" };
  }
  if (lowerName.endsWith(".xlsx") || mimeType.includes("spreadsheetml")) {
    const workbook = await readXlsxFile(buffer);
    const sheets = workbook.map((worksheet) => {
      const rows = worksheet.data.slice(0, 10_000).map((row, index) => `第 ${index + 1} 行\t${row.slice(0, 200).map((value) => value instanceof Date ? value.toISOString() : String(value ?? "")).join("\t")}`);
      return `--- 工作表：${worksheet.sheet} ---\n${rows.join("\n")}`;
    });
    const text = normalizeText(sheets.join("\n\n"));
    if (!text) throw new Error("未能从 XLSX 中提取出单元格内容");
    return { text, pageCount: workbook.length, method: "XLSX_TEXT" };
  }
  if (lowerName.endsWith(".md") || mimeType === "text/markdown") {
    const text = normalizeText(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    if (!text) throw new Error("Markdown 文件没有可导入内容");
    return { text, pageCount: null, method: "MARKDOWN_TEXT" };
  }
  if (lowerName.endsWith(".txt") || mimeType === "text/plain") {
    const text = normalizeText(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    if (!text) throw new Error("TXT 文件没有可导入内容");
    return { text, pageCount: null, method: "PLAIN_TEXT" };
  }
  if (mimeType.startsWith("image/") || /\.(png|jpe?g)$/.test(lowerName)) {
    const text = await recognizeImage(buffer);
    if (!text) throw new Error("未能从图片中识别出文字");
    return { text, pageCount: 1, method: "IMAGE_OCR" };
  }
  throw new Error("暂不支持解析该文件类型");
}
