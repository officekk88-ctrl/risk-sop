import type { ChecklistStatus, ExpertAssignment, Project, ProjectDocument, RemediationTask, ReportDecision, ReportSnapshot, Risk } from "@/lib/domain";
import { REPORT_TEMPLATE_VERSION, reportDisclaimer } from "@/lib/report-template";

export function buildReportSnapshot(input: {
  project: Project;
  documents: ProjectDocument[];
  risks: Risk[];
  tasks: RemediationTask[];
  expertAssignments?: ExpertAssignment[];
  outcome: ReportDecision;
  rationale: string;
  decidedBy: string;
  generatedAt?: string;
}): ReportSnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const statuses: ChecklistStatus[] = ["TODO", "PASSED", "FAILED", "VERIFY", "NOT_APPLICABLE"];
  const checklistSummary = Object.fromEntries(statuses.map((status) => [status, input.project.checklist.filter((item) => item.status === status).length])) as Record<ChecklistStatus, number>;
  const conditions = [
    ...input.risks.filter((risk) => risk.status !== "CLOSED" && (risk.level === "CRITICAL" || risk.level === "HIGH")).map((risk) => `${risk.title}：${risk.recommendation || "完成专业核验并形成书面依据"}`),
    ...input.tasks.filter((task) => task.status !== "DONE").map((task) => `${task.title}（负责人：${task.assigneeEmail}，截止：${task.dueDate}）`),
    ...input.project.checklist.filter((item) => item.status === "FAILED" || item.status === "VERIFY").map((item) => `${item.code} ${item.title}：${item.note || "补充材料并人工核验"}`),
  ];
  const uniqueConditions = [...new Set(conditions)];
  if (!uniqueConditions.length) uniqueConditions.push("在签约、付款、施工或开业前，由对应专业人员完成材料原件及属地要求的最终核验。");

  return structuredClone({
    templateVersion: REPORT_TEMPLATE_VERSION,
    generatedAt,
    project: {
      id: input.project.id,
      name: input.project.name,
      city: input.project.city,
      status: input.project.status,
      ownerEmail: input.project.ownerEmail,
      venue: input.project.venue,
    },
    documents: input.documents.filter((document) => !document.deletedAt).map((document) => ({
      id: document.id,
      category: document.category,
      fileName: document.fileName,
      parseStatus: document.parseStatus,
      pageCount: document.pageCount,
      createdAt: document.createdAt,
    })),
    checklist: input.project.checklist,
    checklistSummary,
    risks: input.risks,
    tasks: input.tasks,
    venues: input.project.venues,
    profile: input.project.profile,
    stages: input.project.stages,
    decisionGates: input.project.decisionGates,
    expertAssignments: input.expertAssignments ?? [],
    decision: { outcome: input.outcome, rationale: input.rationale, decidedBy: input.decidedBy, decidedAt: generatedAt },
    conditions: uniqueConditions,
    disclaimer: reportDisclaimer,
  });
}
