"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { setSession } from "@/lib/auth";
import { authenticateUser } from "@/lib/mvp-store";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!input.success) return { error: "请输入有效的邮箱和密码。" };

  const user = await authenticateUser(input.data.email, input.data.password);
  if (!user) {
    return { error: "邮箱或密码不正确。" };
  }

  await setSession(user.email, user.role);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const { clearSession } = await import("@/lib/auth");
  await clearSession();
  redirect("/login");
}
