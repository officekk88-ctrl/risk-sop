"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createExpertAssignment, updateExpertAssignment } from "@/lib/mvp-store";

export async function createExpertAction(projectId: string, formData: FormData) {
  const session = await getSession(); if (!session) redirect("/login");
  const input = z.object({ sourceType: z.enum(["RISK","DOCUMENT","CHECKLIST","AI_CONVERSATION","GENERAL"]), sourceId: z.string().trim().max(100), specialty: z.enum(["LEGAL","POLICY","FIRE","STRUCTURE","ENGINEERING","FINANCE","OPERATIONS"]), title: z.string().trim().min(3).max(150), question: z.string().trim().min(5).max(3000), urgency: z.enum(["NORMAL","URGENT"]), dueDate: z.string().date(), expertEmail: z.string().email(), expertName: z.string().trim().min(2).max(100), qualification: z.string().trim().max(200), qualificationExpiresAt: z.string().trim().max(20) }).parse(Object.fromEntries(formData));
  if (!await createExpertAssignment({ projectId, email: session.email, role: session.role, ...input, sourceId: input.sourceId || null })) throw new Error("无权发起专家复核。");
  revalidatePath(`/projects/${projectId}/experts`); revalidatePath("/messages");
}

export async function updateExpertAction(projectId: string, assignmentId: string, formData: FormData) {
  const session = await getSession(); if (!session) redirect("/login");
  const status = z.enum(["PENDING","ACCEPTED","MORE_INFO","DELIVERED","CONFIRMED","RETURNED"]).parse(formData.get("status"));
  const opinion = z.string().trim().max(5000).parse(formData.get("opinion") ?? "");
  if (!await updateExpertAssignment({ projectId, assignmentId, email: session.email, role: session.role, status, opinion })) throw new Error("无权更新专家复核。");
  revalidatePath(`/projects/${projectId}/experts`);
}
