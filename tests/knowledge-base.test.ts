import assert from "node:assert/strict";
import test from "node:test";
import type { KnowledgeEntry } from "../src/lib/domain";
import { buildConsultationKnowledge, categorizeConsultation, KNOWLEDGE_CATEGORIES, selectRelevantKnowledge } from "../src/lib/knowledge-base";

function entry(input: Partial<KnowledgeEntry> & Pick<KnowledgeEntry, "id" | "title" | "status">): KnowledgeEntry {
  return {
    code: `KB-${input.id}`,
    category: "OTHER",
    summary: "测试摘要",
    content: "测试知识正文",
    keywords: [],
    sourceName: "测试",
    sourceUrl: "",
    sourceDocumentId: null,
    origin: "MANUAL",
    projectId: null,
    conversationId: null,
    question: "",
    version: 1,
    createdBy: "tester@example.com",
    updatedBy: "tester@example.com",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

test("知识库覆盖开馆尽调主要专业领域", () => {
  assert.equal(KNOWLEDGE_CATEGORIES.length, 11);
  assert.ok(KNOWLEDGE_CATEGORIES.some((item) => item.value === "FIRE_SAFETY"));
  assert.ok(KNOWLEDGE_CATEGORIES.some((item) => item.value === "LEASE_LEGAL"));
  assert.ok(KNOWLEDGE_CATEGORIES.some((item) => item.value === "FINANCE_TAX"));
});

test("AI 咨询可按模式或问题内容整理为结构化问答知识", () => {
  assert.equal(categorizeConsultation("消防验收还缺哪些材料？", "GENERAL"), "FIRE_SAFETY");
  assert.equal(categorizeConsultation("请帮我分析一下", "FINANCE"), "FINANCE_TAX");
  const learned = buildConsultationKnowledge("租赁合同有哪些风险？", "建议先核验出租权。", "LEGAL");
  assert.equal(learned.category, "LEASE_LEGAL");
  assert.match(learned.title, /^咨询问答：/);
  assert.match(learned.content, /问题：租赁合同有哪些风险？\n\n回答：建议先核验出租权。/);
});

test("检索只召回已发布知识并优先匹配中文关键词", () => {
  const entries = [
    entry({ id: "1", title: "消防验收核验", status: "PUBLISHED", category: "FIRE_SAFETY", keywords: ["消防", "验收"] }),
    entry({ id: "2", title: "租赁合同审查", status: "PUBLISHED", category: "LEASE_LEGAL", keywords: ["租赁", "解约"] }),
    entry({ id: "3", title: "未审核消防经验", status: "PENDING", category: "FIRE_SAFETY", keywords: ["消防"] }),
  ];
  const result = selectRelevantKnowledge(entries, "这个场地的消防验收材料还缺什么？");
  assert.deepEqual(result.map((item) => item.id), ["1"]);
});
