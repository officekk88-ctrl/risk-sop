"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import type { RiskLevel, RiskStatus, TaskStatus } from "@/lib/domain";
import { createRisk, createTask, updateRisk, updateTask } from "@/lib/mvp-store";

const riskSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(2000),
  level: z.enum(["CRITICAL", "HIGH", "MEDIUM", "INFO"]),
  evidence: z.string().trim().max(2000),
  recommendation: z.string().trim().max(2000),
  checklistCode: z.string().trim().max(30).optional(),
  documentId: z.string().uuid().or(z.literal("")).optional(),
  stageCode: z.string().trim().max(30), specialty: z.string().trim().max(100), probability: z.coerce.number().int().min(1).max(5), impact: z.coerce.number().int().min(1).max(5), potentialLoss: z.string().trim().max(500), ownerEmail: z.string().trim().email(), dueDate: z.string().trim().max(20), requiredEvidence: z.string().trim().max(1000),
});

export async function createRiskAction(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = riskSchema.parse(Object.fromEntries(formData));
  const risk = await createRisk({ projectId, email: session.email, role: session.role, ...input, level: input.level as RiskLevel, checklistCode: input.checklistCode || null, documentId: input.documentId || null });
  if (!risk) throw new Error("无权创建风险");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/risks`);
}

export async function updateRiskAction(projectId: string, riskId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const status = z.enum(["OPEN", "ANALYZING", "EVIDENCE_PENDING", "MITIGATING", "REVIEW_PENDING", "ACCEPTED", "AVOIDED", "CLOSED", "UNRESOLVED"]).parse(formData.get("status")) as RiskStatus;
  const closeReason = z.string().trim().max(2000).parse(formData.get("closeReason") ?? "");
  if (!(await updateRisk({ projectId, riskId, email: session.email, role: session.role, status, closeReason }))) throw new Error("无权更新风险");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}/risks`);
}

export async function createTaskAction(projectId: string, riskId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = z.object({ title: z.string().trim().min(3).max(150), assigneeEmail: z.string().trim().email(), dueDate: z.string().date() }).parse(Object.fromEntries(formData));
  if (!(await createTask({ projectId, riskId, email: session.email, role: session.role, ...input }))) throw new Error("无权创建整改任务");
  revalidatePath(`/projects/${projectId}/risks`);
}

export async function updateTaskAction(projectId: string, taskId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const status = z.enum(["TODO", "IN_PROGRESS", "DONE"]).parse(formData.get("status")) as TaskStatus;
  const completionNote = z.string().trim().max(2000).parse(formData.get("completionNote") ?? "");
  if (!(await updateTask({ projectId, taskId, email: session.email, role: session.role, status, completionNote }))) throw new Error("无权更新整改任务");
  revalidatePath(`/projects/${projectId}/risks`);
}
