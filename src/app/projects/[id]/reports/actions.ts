"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import type { ReportDecision } from "@/lib/domain";
import { createReport, voidReport } from "@/lib/mvp-store";
import { revalidatePath } from "next/cache";

const reportSchema = z.object({
  outcome: z.enum(["PROCEED", "CONDITIONAL", "PAUSE", "REJECT"]),
  rationale: z.string().trim().min(10).max(3000),
});

export async function generateReportAction(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = reportSchema.parse(Object.fromEntries(formData));
  const report = await createReport({ projectId, email: session.email, role: session.role, outcome: input.outcome as ReportDecision, rationale: input.rationale });
  if (!report) throw new Error("项目不存在或无权生成报告");
  redirect(`/projects/${projectId}/reports/${report.id}`);
}

export async function voidReportAction(projectId:string,reportId:string){const session=await getSession();if(!session)redirect("/login");if(!await voidReport({projectId,reportId,email:session.email,role:session.role}))throw new Error("仅项目负责人或管理员可作废报告。");revalidatePath(`/projects/${projectId}/reports`)}
