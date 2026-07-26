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
const adminUser = await store.authenticateUser(adminEmail, adminPassword);
if (!adminUser) throw new Error("无法初始化安全测试管理员。");
const securityMember = await store.createManagedUser({ actorEmail: adminEmail, actorRole: "ADMIN", displayName: "安全验收成员", email: `security-smoke-${Date.now()}@example.com`, password: "security-smoke-password-2026", role: "MEMBER" });
const port = 3200 + Math.floor(Math.random() * 400);
const origin = `http://127.0.0.1:${port}`;
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, NODE_ENV: "production", APP_ORIGIN: origin }, stdio: ["ignore", "pipe", "pipe"] });

function cookie(email, role) {
  const payload = Buffer.from(JSON.stringify({ email, role, expiresAt: Date.now() + 120_000 })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET || "local-development-session-secret-change-me").update(payload).digest("base64url");
  return `pickleball_mvp_session=${payload}.${signature}`;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("生产服务器未在 15 秒内启动");
}

try {
  await waitForServer();
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.match(health.headers.get("content-security-policy") || "", /object-src 'none'/);

  const anonymousDashboard = await fetch(`${origin}/dashboard`, { redirect: "manual" });
  assert.ok([307, 308].includes(anonymousDashboard.status));

  const data = JSON.parse(await readFile(".data/mvp-data.json", "utf8"));
  const unknownAccount = cookie("outsider@example.com", "MEMBER");
  const invalidSession = await fetch(`${origin}/projects/demo-shanghai-pudong-a`, { headers: { cookie: unknownAccount }, redirect: "manual" });
  assert.ok([307, 308].includes(invalidSession.status));
  const outsider = cookie(securityMember.email, "MEMBER");
  const unauthorizedProject = await fetch(`${origin}/projects/demo-shanghai-pudong-a`, { headers: { cookie: outsider } });
  assert.equal(unauthorizedProject.status, 404);

  const admin = cookie(adminEmail, "ADMIN");
  assert.ok([307, 308].includes((await fetch(`${origin}/admin/users`, { redirect: "manual" })).status));
  assert.equal((await fetch(`${origin}/admin/users`, { headers: { cookie: outsider } })).status, 404);
  assert.equal((await fetch(`${origin}/admin/users`, { headers: { cookie: admin } })).status, 200);
  const reportsPage = await fetch(`${origin}/projects/demo-shanghai-pudong-a/reports`, { headers: { cookie: admin } });
  assert.equal(reportsPage.status, 200);
  if (process.env.OPENAI_API_KEY) assert.equal((await reportsPage.text()).includes(process.env.OPENAI_API_KEY), false);

  const anonymousAI = await fetch(`${origin}/api/projects/demo-shanghai-pudong-a/ai/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "test" }) });
  assert.equal(anonymousAI.status, 401);
  const crossSiteAI = await fetch(`${origin}/api/projects/demo-shanghai-pudong-a/ai/chat`, { method: "POST", headers: { cookie: admin, origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ message: "test" }) });
  assert.equal(crossSiteAI.status, 403);
  const malformedAI = await fetch(`${origin}/api/projects/demo-shanghai-pudong-a/ai/chat`, { method: "POST", headers: { cookie: admin, origin, "content-type": "application/json" }, body: "{" });
  assert.equal(malformedAI.status, 400);

  const fakeDocument = await fetch(`${origin}/api/projects/demo-shanghai-pudong-a/documents/00000000-0000-0000-0000-000000000000`, { headers: { cookie: admin } });
  assert.equal(fakeDocument.status, 404);

  const durations = await Promise.all(Array.from({ length: 20 }, async () => {
    const started = performance.now();
    const response = await fetch(`${origin}/api/health`);
    assert.equal(response.status, 200);
    return performance.now() - started;
  }));
  durations.sort((left, right) => left - right);
  const p95Ms = durations[Math.ceil(durations.length * 0.95) - 1];
  assert.ok(p95Ms < 800, `健康接口 P95 ${p95Ms.toFixed(1)}ms 超过 800ms`);

  let pdfChecks = 0;
  const report = data.reports?.[0];
  if (report) {
    const pdfUrl = `${origin}/api/projects/${report.projectId}/reports/${report.id}/pdf`;
    assert.equal((await fetch(pdfUrl)).status, 401);
    assert.equal((await fetch(pdfUrl, { headers: { cookie: outsider } })).status, 404);
    pdfChecks += 2;
    const hasFont = ["C:\\Windows\\Fonts\\simhei.ttf", "/mnt/c/Windows/Fonts/simhei.ttf", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc"].some(existsSync);
    if (hasFont) {
      const pdf = await fetch(pdfUrl, { headers: { cookie: admin } });
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      assert.equal(pdf.status, 200);
      assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
      pdfChecks += 2;
    }
  }
  console.log(JSON.stringify({ passed: 15 + pdfChecks, failed: 0, p95Ms: Number(p95Ms.toFixed(1)), origin }));
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  if (originalData) await writeFile(dataFile, originalData);
  else await rm(dataFile, { force: true });
}
