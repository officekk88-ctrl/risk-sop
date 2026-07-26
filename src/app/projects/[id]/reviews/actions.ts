"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import type { RiskLevel } from "@/lib/domain";
import { decideAIReviewFinding, finalizeAIReviewWithoutFindings } from "@/lib/mvp-store";

const decisionSchema = z.object({
  decision: z.enum(["CONFIRM", "REJECT"]),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(2000),
  level: z.enum(["CRITICAL", "HIGH", "MEDIUM", "INFO"]),
  evidence: z.string().trim().max(2000),
  recommendation: z.string().trim().max(2000),
  decisionNote: z.string().trim().min(3).max(1000),
});

export async function decideFindingAction(projectId: string, reviewId: string, findingId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = decisionSchema.parse(Object.fromEntries(formData));
  const result = await decideAIReviewFinding({
    projectId, reviewId, findingId, email: session.email, role: session.role,
    ...input, level: input.level as RiskLevel,
  });
  if (!result) throw new Error("该候选风险已处理、记录不存在或无权操作");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/reviews`);
  revalidatePath(`/projects/${projectId}/risks`);
}

export async function finalizeNoFindingsAction(projectId: string, reviewId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const note = z.string().trim().min(3).max(1000).parse(formData.get("note"));
  if (!(await finalizeAIReviewWithoutFindings({ projectId, reviewId, email: session.email, role: session.role, note }))) throw new Error("无法确认该初审结果");
  revalidatePath(`/projects/${projectId}/reviews`);
}
