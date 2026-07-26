import assert from "node:assert/strict";
import test from "node:test";
import { checklistAIOutputSchema } from "../src/lib/checklist-ai-schema";
import { aiReviewOutputSchema } from "../src/lib/ai-review-schema";
import { isSameOriginWrite } from "../src/lib/request-security";
import { knowledgeImportOutputSchema } from "../src/lib/knowledge-import-schema";
import { resolveProjectRole, type Project } from "../src/lib/domain";

test("同源写请求允许、跨站写请求拒绝", () => {
  assert.equal(isSameOriginWrite(new Request("https://risk.example/api", { method: "POST", headers: { origin: "https://risk.example" } })), true);
  assert.equal(isSameOriginWrite(new Request("https://risk.example/api", { method: "POST", headers: { origin: "https://evil.example" } })), false);
  assert.equal(isSameOriginWrite(new Request("https://risk.example/api", { method: "POST" })), true);
});

test("开发服务器绑定地址不会误拒绝浏览器实际 Host", () => {
  const local = new Request("http://0.0.0.0:3000/api", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost:3000" },
  });
  const attack = new Request("http://0.0.0.0:3000/api", {
    method: "POST",
    headers: { origin: "https://evil.example", host: "localhost:3000" },
  });
  assert.equal(isSameOriginWrite(local), true);
  assert.equal(isSameOriginWrite(attack), false);
});

test("项目界面按项目角色收敛，负责人和管理员保持管理权限", () => {
  const project = {
    ownerEmail: "owner@example.com",
    memberRoles: {
      "decision@example.com": "DECISION_MAKER",
      "expert@example.com": "EXPERT",
    },
  } as unknown as Project;
  assert.equal(resolveProjectRole(project, "owner@example.com", "MEMBER"), "PROJECT_MANAGER");
  assert.equal(resolveProjectRole(project, "any-admin@example.com", "ADMIN"), "PROJECT_MANAGER");
  assert.equal(resolveProjectRole(project, "decision@example.com", "MEMBER"), "DECISION_MAKER");
  assert.equal(resolveProjectRole(project, "expert@example.com", "MEMBER"), "EXPERT");
  assert.equal(resolveProjectRole(project, "other@example.com", "MEMBER"), "MEMBER");
});

test("AI 初审结构拒绝未知风险等级和额外字段", () => {
  const base = { documentType: "合同", summary: "测试摘要", extractedFields: [], missingItems: [], findings: [], overallConfidence: "LOW", expertReviewRequired: true, limitations: ["仅用于测试"] };
  assert.equal(aiReviewOutputSchema.safeParse(base).success, true);
  assert.equal(aiReviewOutputSchema.safeParse({ ...base, extra: "not-allowed" }).success, false);
  assert.equal(aiReviewOutputSchema.safeParse({ ...base, overallConfidence: "CERTAIN" }).success, false);
});

test("逐项尽调 AI 初判仅接受严格、可编辑的固定字段", () => {
  const base = {
    judgment: "VERIFY",
    analysis: "材料尚不足以形成通过结论。",
    evidence: "材料中未找到直接依据",
    recommendation: "补充主管部门书面意见。",
    confidence: "LOW",
    requiresExpertReview: true,
  };
  assert.equal(checklistAIOutputSchema.safeParse(base).success, true);
  assert.equal(checklistAIOutputSchema.safeParse({ ...base, judgment: "APPROVED" }).success, false);
  assert.equal(checklistAIOutputSchema.safeParse({ ...base, model: "hidden" }).success, false);
});

test("知识文档 AI 导入输出限制分类、条数和未知字段", () => {
  const base = {
    documentSummary: "消防管理制度摘要",
    warnings: [],
    entries: [{ category: "FIRE_SAFETY", title: "消防巡查", summary: "每日巡查并保留记录", content: "开馆运营期间应按制度执行巡查，并保留可复核的检查记录。", keywords: ["消防", "巡查"] }],
  };
  assert.equal(knowledgeImportOutputSchema.safeParse(base).success, true);
  assert.equal(knowledgeImportOutputSchema.safeParse({ ...base, entries: [{ ...base.entries[0], category: "LEGAL" }] }).success, false);
  assert.equal(knowledgeImportOutputSchema.safeParse({ ...base, hidden: "field" }).success, false);
});
