import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.OPENAI_API_KEY?.trim()) {
  throw new Error("OPENAI_API_KEY 未配置，无法执行逐项尽调 AI 实链路验证。");
}

const data = JSON.parse(await readFile(path.resolve(".data/mvp-data.json"), "utf8"));
const project = data.projects.find((item) => item.id === "simulation-land-noncompliant-2026");
const checklistItem = project?.checklist.find((item) => item.code === "USE-02");
const documents = data.documents.filter((item) => item.projectId === project?.id && item.checklistCodes?.includes(checklistItem?.code) && item.parseStatus === "COMPLETED");

if (!project || !checklistItem || !documents.length) {
  throw new Error("未找到土地性质不合规模拟项目的 USE-02 关联材料。");
}

const assessmentModule = await import("../src/lib/ai-checklist-assessment.ts");
const runChecklistAIAssessment = assessmentModule.runChecklistAIAssessment ?? assessmentModule.default?.runChecklistAIAssessment;
if (!runChecklistAIAssessment) throw new Error("无法加载逐项尽调 AI 分析服务。");

const output = await runChecklistAIAssessment(project, checklistItem, documents);
console.log(JSON.stringify({
  checklistCode: checklistItem.code,
  linkedDocuments: documents.length,
  judgment: output.judgment,
  confidence: output.confidence,
  requiresExpertReview: output.requiresExpertReview,
  hasAnalysis: output.analysis.length > 2,
  hasEvidence: output.evidence.length > 0,
  hasRecommendation: output.recommendation.length > 0,
}, null, 2));
