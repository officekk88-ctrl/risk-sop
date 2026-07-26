import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const dataFile = path.resolve(".data/mvp-data.json");
const originalData = existsSync(dataFile) ? await readFile(dataFile) : null;
const storeModule = await import("../src/lib/mvp-store.ts");
const store = storeModule.createManagedUser ? storeModule : storeModule.default;
const adminEmail = (process.env.MVP_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
const adminPassword = process.env.MVP_ADMIN_PASSWORD || "change-me-before-shared-use";
const userEmail = `user-admin-smoke-${Date.now()}@example.com`;
const userPassword = "temporary-user-admin-smoke-2026";
const port = 4400 + Math.floor(Math.random() * 200);
const origin = `http://127.0.0.1:${port}`;
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
let server;

function cookie(email, role) {
  const payload = Buffer.from(JSON.stringify({ email, role, expiresAt: Date.now() + 120_000 })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET || "local-development-session-secret-change-me").update(payload).digest("base64url");
  return `pickleball_mvp_session=${payload}.${signature}`;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("服务器未在20秒内启动。");
}

try {
  const admin = await store.authenticateUser(adminEmail, adminPassword);
  assert.equal(admin?.role, "ADMIN");
  const user = await store.createManagedUser({ actorEmail: adminEmail, actorRole: "ADMIN", displayName: "用户管理验收成员", email: userEmail, password: userPassword, role: "MEMBER" });
  assert.equal((await store.authenticateUser(userEmail, userPassword))?.id, user.id);
  await store.setManagedUserProjects({ actorEmail: adminEmail, actorRole: "ADMIN", userId: user.id, projectIds: ["demo-shanghai-pudong-a"] });
  assert.equal((await store.listProjects(userEmail, "MEMBER")).some((project) => project.id === "demo-shanghai-pudong-a"), true);
  await store.setManagedUserProjects({ actorEmail: adminEmail, actorRole: "ADMIN", userId: user.id, projectIds: [] });
  assert.equal((await store.listProjects(userEmail, "MEMBER")).some((project) => project.id === "demo-shanghai-pudong-a"), false);

  server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "production", APP_ORIGIN: origin },
    stdio: "ignore",
  });
  await waitForServer();
  const adminPage = await fetch(`${origin}/admin/users`, { headers: { cookie: cookie(adminEmail, "ADMIN") } });
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /用户与权限/);

  const memberCookie = cookie(userEmail, "MEMBER");
  assert.equal((await fetch(`${origin}/admin/users`, { headers: { cookie: memberCookie } })).status, 404);
  await store.updateManagedUser({ actorEmail: adminEmail, actorRole: "ADMIN", userId: user.id, displayName: user.displayName, role: "ADMIN", active: true });
  assert.equal((await fetch(`${origin}/admin/users`, { headers: { cookie: memberCookie } })).status, 200);

  await store.updateManagedUser({ actorEmail: adminEmail, actorRole: "ADMIN", userId: user.id, displayName: user.displayName, role: "MEMBER", active: false });
  const disabledResponse = await fetch(`${origin}/dashboard`, { headers: { cookie: memberCookie }, redirect: "manual" });
  assert.ok([307, 308].includes(disabledResponse.status));
  await assert.rejects(() => store.updateManagedUser({ actorEmail: adminEmail, actorRole: "ADMIN", userId: admin.id, displayName: admin.displayName, role: "MEMBER", active: true }), /不能停用自己|管理员角色/);

  await store.deleteManagedUser({ actorEmail: adminEmail, actorRole: "ADMIN", userId: user.id });
  assert.equal((await store.listManagedUsers(adminEmail, "ADMIN")).some((item) => item.id === user.id), false);
  console.log(JSON.stringify({ passed: 11, failed: 0, projectAssignment: true, immediateRoleRefresh: true, disabledSessionRejected: true }));
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  if (originalData) await writeFile(dataFile, originalData);
  else await rm(dataFile, { force: true });
}
