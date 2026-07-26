import assert from "node:assert/strict";
import test from "node:test";
import { parseDocumentBuffer } from "../src/lib/document-parser";

const XLSX_FIXTURE = "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";

test("知识库解析 UTF-8 Markdown 和 TXT", async () => {
  const markdown = await parseDocumentBuffer("消防制度.md", "text/markdown", Buffer.from("# 消防制度\n每日巡查。"));
  const text = await parseDocumentBuffer("运营复盘.txt", "text/plain", Buffer.from("高峰时段需要增加安全巡场人员。"));
  assert.equal(markdown.method, "MARKDOWN_TEXT");
  assert.match(markdown.text, /每日巡查/);
  assert.equal(text.method, "PLAIN_TEXT");
  assert.match(text.text, /安全巡场/);
});

test("知识库解析 XLSX 工作表和单元格", async () => {
  const result = await parseDocumentBuffer("尽调表.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Buffer.from(XLSX_FIXTURE, "base64"));
  assert.equal(result.method, "XLSX_TEXT");
  assert.match(result.text, /工作表：风险清单/);
  assert.match(result.text, /检查疏散通道/);
});
