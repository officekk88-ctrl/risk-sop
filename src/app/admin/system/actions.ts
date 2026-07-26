"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { updateSystemSettings } from "@/lib/mvp-store";
export async function updateSettingsAction(formData:FormData){const session=await getSession();if(!session)redirect("/login");const input=z.object({organizationName:z.string().trim().min(2).max(100),reminderDays:z.coerce.number().int().min(1).max(90),riskThreshold:z.enum(["CRITICAL","HIGH","MEDIUM","INFO"]),aiPromptVersion:z.string().trim().min(1).max(50),reportTemplateVersion:z.string().trim().min(1).max(50),allowedFileTypes:z.string().trim().min(1).max(200)}).parse(Object.fromEntries(formData));await updateSystemSettings({email:session.email,role:session.role,settings:{...input,allowedFileTypes:input.allowedFileTypes.split(/[,，\s]+/).filter(Boolean),decisionGateEnabled:formData.get("decisionGateEnabled")==="on"}});revalidatePath("/admin/system")}
