"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createManagedUser, deleteManagedUser, listManagedUsers, setManagedUserProjects, updateManagedUser } from "@/lib/mvp-store";

const roleSchema = z.enum(["ADMIN", "MEMBER"]);
const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(12, "密码至少12位").max(128);

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") throw new Error("仅系统管理员可以管理用户和权限。");
  return session;
}

function redirectWith(type: "notice" | "error", message: string): never {
  redirect(`/admin/users?${type}=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : "用户管理操作失败。";
}

export async function createUserAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const input = z.object({
    displayName: z.string().trim().min(2).max(50),
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
  }).safeParse(Object.fromEntries(formData));
  if (!input.success) redirectWith("error", input.error.issues[0]?.message ?? "请检查用户资料。");
  try {
    await createManagedUser({ actorEmail: session.email, actorRole: session.role, ...input.data });
  } catch (error) {
    redirectWith("error", errorMessage(error));
  }
  revalidatePath("/admin/users");
  redirectWith("notice", "用户创建成功。");
}

export async function updateUserAction(userId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const input = z.object({
    displayName: z.string().trim().min(2).max(50),
    role: roleSchema,
    active: z.enum(["true", "false"]).transform((value) => value === "true"),
    newPassword: z.union([z.literal(""), passwordSchema]).transform((value) => value || undefined),
  }).safeParse(Object.fromEntries(formData));
  if (!input.success) redirectWith("error", input.error.issues[0]?.message ?? "请检查修改内容。");
  try {
    await updateManagedUser({ actorEmail: session.email, actorRole: session.role, userId, ...input.data });
  } catch (error) {
    redirectWith("error", errorMessage(error));
  }
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  redirectWith("notice", "用户资料与权限已更新。");
}

export async function deleteUserAction(userId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const confirmEmail = emailSchema.safeParse(formData.get("confirmEmail"));
  if (!confirmEmail.success) redirectWith("error", "请输入有效邮箱确认删除。");
  const users = await listManagedUsers(session.email, session.role);
  const user = users.find((item) => item.id === userId);
  if (!user || user.email !== confirmEmail.data) redirectWith("error", "确认邮箱与目标用户不一致。");
  try {
    await deleteManagedUser({ actorEmail: session.email, actorRole: session.role, userId });
  } catch (error) {
    redirectWith("error", errorMessage(error));
  }
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirectWith("notice", "用户账号已删除，项目成员权限已同步移除。");
}

export async function updateUserProjectsAction(userId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const projectIds = formData.getAll("projectIds").filter((value): value is string => typeof value === "string");
  try {
    await setManagedUserProjects({ actorEmail: session.email, actorRole: session.role, userId, projectIds });
  } catch (error) {
    redirectWith("error", errorMessage(error));
  }
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirectWith("notice", "用户的项目指定已更新。");
}
