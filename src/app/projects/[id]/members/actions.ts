"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { assignProjectMember, getProject, removeProjectMember, updateProjectMemberRole } from "@/lib/mvp-store";

const memberSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  temporaryPassword: z.string().min(12).max(128),
  projectRole: z.enum(["DECISION_MAKER", "PROJECT_MANAGER", "MEMBER", "REVIEWER", "EXPERT"]).default("MEMBER"),
});

async function requireManager(projectId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  const project = await getProject(projectId, session.email, session.role);
  if (!project || (session.role !== "ADMIN" && project.ownerEmail !== session.email)) {
    throw new Error("无权管理该项目成员。");
  }
  return session;
}

export async function assignMemberAction(projectId: string, formData: FormData): Promise<void> {
  const session = await requireManager(projectId);
  const input = memberSchema.parse(Object.fromEntries(formData));
  await assignProjectMember({ projectId, ...input, actorEmail: session.email });
  await updateProjectMemberRole({ projectId, memberEmail: input.email, projectRole: input.projectRole, actorEmail: session.email, actorRole: session.role });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/members`);
}

export async function updateMemberRoleAction(projectId: string, email: string, formData: FormData): Promise<void> {
  const session = await requireManager(projectId);
  const projectRole = z.enum(["DECISION_MAKER", "PROJECT_MANAGER", "MEMBER", "REVIEWER", "EXPERT"]).parse(formData.get("projectRole"));
  if (!await updateProjectMemberRole({ projectId, memberEmail: email, projectRole, actorEmail: session.email, actorRole: session.role })) throw new Error("角色更新失败。");
  revalidatePath(`/projects/${projectId}/members`);
}

export async function removeMemberAction(projectId: string, email: string): Promise<void> {
  const session = await requireManager(projectId);
  await removeProjectMember({ projectId, email, actorEmail: session.email });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/members`);
}
