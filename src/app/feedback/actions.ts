"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { submitExperienceFeedback } from "@/lib/mvp-store";

export async function submitFeedbackAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const input = z.object({
    score: z.coerce.number().int().min(1).max(5),
    category: z.enum(["FLOW", "CLARITY", "MOBILE", "AI", "OTHER"]),
    comment: z.string().trim().max(1000),
  }).parse(Object.fromEntries(formData));
  await submitExperienceFeedback({ ...input, score: input.score as 1 | 2 | 3 | 4 | 5, email: session.email });
  revalidatePath("/analytics");
}
