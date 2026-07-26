import assert from "node:assert/strict";
import test from "node:test";
import type { Project, ProjectDocument, Risk } from "../src/lib/domain";
import { buildReportSnapshot } from "../src/lib/report-builder";

const now = "2026-07-22T10:00:00.000Z";
const project: Project = {
  id: "project-1", name: "报告测试项目", city: "上海市", status: "DUE_DILIGENCE", ownerEmail: "admin@example.com", memberEmails: [],
  venue: { address: "测试地址", district: "浦东新区", areaSqm: 1000, clearHeightM: 8, certificateUsage: "仓储", intendedUsage: "匹克球馆", monthlyRent: 10000, leaseMonths: 60, plannedCourts: 4 },
  checklist: [
    { code: "A-01", category: "产权", title: "产权材料", required: true, evidence: "产权证", status: "VERIFY", note: "待核原件", updatedAt: now },
    { code: "A-02", category: "产权", title: "地址一致", required: true, evidence: "地址", status: "PASSED", note: "", updatedAt: now },
  ], createdAt: now, updatedAt: now,
};
const document: ProjectDocument = { id: "doc-1", projectId: project.id, category: "CONTRACT", fileName: "合同.pdf", mimeType: "application/pdf", sizeBytes: 10, storageKey: "key.pdf", uploadedBy: "admin@example.com", createdAt: now, deletedAt: null, parseStatus: "COMPLETED", extractedText: "正文", pageCount: 1, parseError: "", parsedAt: now, checklistCodes: [] };
const risk: Risk = { id: "risk-1", projectId: project.id, source: "AI_REVIEW", checklistCode: null, documentId: document.id, title: "出租授权待核验", description: "待核验", level: "HIGH", status: "OPEN", evidence: "材料中未找到直接依据", recommendation: "核验授权", closeReason: "", createdBy: "admin@example.com", createdAt: now, updatedAt: now, closedAt: null };

test("报告快照只包含有效材料并正确汇总清单", () => {
  const deleted = { ...document, id: "doc-2", deletedAt: now };
  const snapshot = buildReportSnapshot({ project, documents: [document, deleted], risks: [risk], tasks: [], outcome: "CONDITIONAL", rationale: "完成出租授权核验后再推进", decidedBy: "admin@example.com", generatedAt: now });
  assert.equal(snapshot.documents.length, 1);
  assert.equal(snapshot.checklistSummary.VERIFY, 1);
  assert.equal(snapshot.checklistSummary.PASSED, 1);
  assert.equal(snapshot.risks[0].source, "AI_REVIEW");
  assert.ok(snapshot.conditions.some((item) => item.includes("出租授权待核验")));
});

test("报告快照生成后不随源数据变化", () => {
  const source = structuredClone(project);
  const snapshot = buildReportSnapshot({ project: source, documents: [document], risks: [], tasks: [], outcome: "PAUSE", rationale: "等待关键材料完成后重新评估", decidedBy: "admin@example.com", generatedAt: now });
  source.name = "被修改的名称";
  source.checklist[0].note = "被修改";
  assert.equal(snapshot.project.name, "报告测试项目");
  assert.equal(snapshot.checklist[0].note, "待核原件");
});
