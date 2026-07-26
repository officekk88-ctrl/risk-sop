"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import type { ProjectProfile, Venue } from "@/lib/domain";
import { createGeneralTask, deleteCandidateVenue, saveCandidateVenue, updateDecisionGate, updateProjectProfile, updateStageDecision, updateTask } from "@/lib/mvp-store";

const text = (max = 300) => z.string().trim().max(max).catch("");
const numberOrNull = z.preprocess((value) => value === "" || value == null ? null : Number(value), z.number().nonnegative().nullable());
const score = z.preprocess((value) => Number(value || 0), z.number().min(0).max(100));
const refresh = (id: string) => { revalidatePath(`/projects/${id}`); revalidatePath(`/projects/${id}/operations`); revalidatePath("/dashboard"); };

export async function updateProfileAction(projectId: string, formData: FormData) {
  const session = await getSession(); if (!session) redirect("/login");
  const raw = Object.fromEntries(formData);
  const parsed = z.object({
    buildingType: text(), floor: text(), buildingHeightM: numberOrNull, plannedOpeningDate: text(20), budget: numberOrNull,
    operationMode: z.enum(["SELF", "JOINT", "FRANCHISE", "ENTRUSTED"]), propertyOwner: text(), lessor: text(),
    leasingRelation: z.enum(["DIRECT", "AGENCY", "SUBLEASE", "COOPERATION", "ASSET_MANAGEMENT", "UNKNOWN"]),
    certificateNumber: text(), landNature: text(), propertyNature: text(), remainingYears: numberOrNull,
    originalUse: text(), currentCondition: text(1000), fireFacilities: text(1000), exits: numberOrNull,
    powerCapacity: text(), hvac: text(), waterDrainage: text(), network: text(), parking: text(), sensitiveNeighbors: text(1000), noiseRisk: text(1000),
  }).parse(raw);
  const profile: ProjectProfile = { ...parsed, encumbrances: formData.getAll("encumbrances").map(String), nightOperation: formData.get("nightOperation") === "on" };
  if (!await updateProjectProfile({ projectId, email: session.email, role: session.role, profile })) throw new Error("无权更新项目建档信息。");
  refresh(projectId);
}

export async function saveVenueAction(projectId: string, formData: FormData) {
  const session = await getSession(); if (!session) redirect("/login");
  const input = z.object({ id: text(100), name: z.string().trim().min(2).max(100), address: z.string().trim().min(3).max(300), district: text(),
    areaSqm: numberOrNull, clearHeightM: numberOrNull, certificateUsage: text(), intendedUsage: text(), monthlyRent: numberOrNull, leaseMonths: numberOrNull,
    plannedCourts: numberOrNull, trafficScore: score, customerScore: score, visibilityScore: score, parkingScore: score, costScore: score,
    efficiencyScore: score, complianceRisk: score, engineeringRisk: score, neighborRisk: score, expectedRevenue: numberOrNull, plannedInvestment: numberOrNull,
    eliminatedReason: text(500), notes: text(1000),
  }).parse(Object.fromEntries(formData));
  const venue: Venue = { ...input, id: input.id || undefined, isPrimary: formData.get("isPrimary") === "on" };
  if (!await saveCandidateVenue({ projectId, email: session.email, role: session.role, venue })) throw new Error("无权保存候选场地。");
  refresh(projectId);
}

export async function deleteVenueAction(projectId: string, venueId: string) {
  const session = await getSession(); if (!session) redirect("/login");
  if (!await deleteCandidateVenue({ projectId, venueId, email: session.email, role: session.role })) throw new Error("主场地不能删除或无权操作。");
  refresh(projectId);
}

export async function updateStageAction(projectId: string, stageId: string, formData: FormData) {
  const session = await getSession(); if (!session) redirect("/login");
  const input = z.object({ status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"]), decision: z.enum(["PENDING", "PASSED", "CONDITIONAL", "PAUSED", "REJECTED", "EXPERT_REVIEW"]), conditions: text(2000), note: text(2000) }).parse(Object.fromEntries(formData));
  if (!await updateStageDecision({ projectId, stageId, email: session.email, role: session.role, ...input })) throw new Error("无权更新阶段。");
  refresh(projectId);
}

export async function updateGateAction(projectId: string, gateId: string, formData: FormData) {
  const session = await getSession(); if (!session) redirect("/login");
  const input = z.object({ decision: z.enum(["PENDING", "PASSED", "CONDITIONAL", "PAUSED", "REJECTED", "EXPERT_REVIEW"]), rationale: text(2000) }).parse(Object.fromEntries(formData));
  if (!await updateDecisionGate({ projectId, gateId, email: session.email, role: session.role, ...input })) throw new Error("无权更新决策门。");
  refresh(projectId);
}

export async function createGeneralTaskAction(projectId: string, formData: FormData) {
  const session = await getSession(); if (!session) redirect("/login");
  const input = z.object({ title: z.string().trim().min(3).max(150), assigneeEmail: z.string().email(), dueDate: z.string().date(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]) }).parse(Object.fromEntries(formData));
  if (!await createGeneralTask({ projectId, email: session.email, role: session.role, ...input })) throw new Error("无权创建任务。");
  refresh(projectId);
}

export async function updateGeneralTaskAction(projectId: string, taskId: string, formData: FormData) {
  const session = await getSession(); if (!session) redirect("/login");
  const status = z.enum(["TODO", "IN_PROGRESS", "DONE"]).parse(formData.get("status"));
  const completionNote = text(2000).parse(formData.get("completionNote") ?? "");
  if (!await updateTask({ projectId, taskId, email: session.email, role: session.role, status, completionNote })) throw new Error("无权更新任务。");
  refresh(projectId);
}
