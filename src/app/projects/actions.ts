"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import type { ChecklistStatus, ProjectStatus, Venue } from "@/lib/domain";
import { cloneProject, createProject, updateChecklistItem, updateProject } from "@/lib/mvp-store";

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}, z.number().nonnegative().nullable());

const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(50),
  district: z.string().trim().max(50),
  address: z.string().trim().min(3).max(300),
  areaSqm: optionalNumber,
  clearHeightM: optionalNumber,
  certificateUsage: z.string().trim().max(100),
  intendedUsage: z.string().trim().min(2).max(100),
  monthlyRent: optionalNumber,
  leaseMonths: optionalNumber,
  plannedCourts: optionalNumber,
});

function projectInput(formData: FormData) {
  return projectSchema.parse(Object.fromEntries(formData));
}

function venueFrom(input: z.infer<typeof projectSchema>): Venue {
  return {
    address: input.address,
    district: input.district,
    areaSqm: input.areaSqm,
    clearHeightM: input.clearHeightM,
    certificateUsage: input.certificateUsage,
    intendedUsage: input.intendedUsage,
    monthlyRent: input.monthlyRent,
    leaseMonths: input.leaseMonths,
    plannedCourts: input.plannedCourts,
  };
}

export async function createProjectAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = projectInput(formData);
  const project = await createProject({ name: input.name, city: input.city, ownerEmail: session.email, venue: venueFrom(input) });
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = projectInput(formData);
  const status = z.enum(["DRAFT", "DUE_DILIGENCE", "NEGOTIATING", "SIGNED", "CONSTRUCTION", "OPENING_PREP", "OPEN", "PAUSED", "ABANDONED", "DECISION_PENDING", "ARCHIVED"]).parse(formData.get("status")) as ProjectStatus;
  const project = await updateProject({ id: projectId, email: session.email, role: session.role, name: input.name, city: input.city, status, venue: venueFrom(input) });
  if (!project) throw new Error("无权编辑该项目或项目不存在");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateChecklistAction(projectId: string, code: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const status = z.enum(["TODO", "PASSED", "FAILED", "VERIFY", "NOT_APPLICABLE"]).parse(formData.get("status")) as ChecklistStatus;
  const note = z.string().trim().max(1000).parse(formData.get("note") ?? "");
  const updated = await updateChecklistItem({ projectId, code, email: session.email, role: session.role, status, note });
  if (!updated) throw new Error("无权更新该检查项或检查项不存在");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

export async function cloneProjectAction(projectId:string){const session=await getSession();if(!session)redirect("/login");const project=await cloneProject({projectId,email:session.email,role:session.role});if(!project)throw new Error("无权复制项目。");revalidatePath("/projects");revalidatePath("/dashboard");redirect(`/projects/${project.id}/edit`)}
