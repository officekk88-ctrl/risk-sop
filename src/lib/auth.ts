import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/mvp-store";

const COOKIE_NAME = "pickleball_mvp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type SessionPayload = {
  email: string;
  role: "ADMIN" | "MEMBER";
  expiresAt: number;
};

function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return "local-development-session-secret-change-me";
  throw new Error("SESSION_SECRET is required in production");
}

function shouldUseSecureSessionCookie(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  return process.env.ALLOW_INSECURE_HTTP !== "true";
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken(payload: SessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as SessionPayload;
    if (!payload.email || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const signedSession = verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!signedSession) return null;
  const user = await getSessionUser(signedSession.email);
  if (!user?.active) return null;
  return { ...signedSession, email: user.email, role: user.role };
}

export async function setSession(email: string, role: SessionPayload["role"]): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  cookieStore.set(COOKIE_NAME, createSessionToken({ email, role, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
