"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { markNotificationRead } from "@/lib/mvp-store";
export async function markReadAction(id: string) { const session = await getSession(); if (!session) redirect("/login"); await markNotificationRead({ id, email: session.email }); revalidatePath("/messages"); }
