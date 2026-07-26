import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const dataFile = path.resolve(".data/mvp-data.json");
const originalData = existsSync(dataFile) ? await readFile(dataFile) : null;
const port = 3600 + Math.floor(Math.random() * 300);
const origin = `http://127.0.0.1:${port}`;
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: { ...process.env, NODE_ENV: "production", APP_ORIGIN: origin }, stdio: "ignore",
});

const decode = (value = "") => value.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#x27;", "'");
function formDataFrom(html, marker) {
  const form = [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((match) => match[0]).find((value) => value.includes(marker));
  assert.ok(form, `未找到包含 ${marker} 的表单`);
  const data = new FormData();
  for (const input of form.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/g)) {
    const value = input[0].match(/value="([^"]*)"/)?.[1] ?? "";
    data.set(decode(input[1]), decode(value));
  }
  return data;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("服务器未在 15 秒内启动。");
}

async function login(email, password) {
  const html = await (await fetch(`${origin}/login`)).text();
  const data = formDataFrom(html, 'name="password"');
  data.set("email", email);
  data.set("password", password);
  const response = await fetch(`${origin}/login`, { method: "POST", headers: { origin }, body: data, redirect: "manual" });
  assert.equal(response.status, 303);
  const setCookie = response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie");
  assert.ok(setCookie);
  return setCookie.split(";", 1)[0];
}

try {
  await waitForServer();
  const adminEmail = process.env.MVP_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.MVP_ADMIN_PASSWORD ?? "change-me-before-shared-use";
  const adminCookie = await login(adminEmail, adminPassword);
  const membersUrl = `${origin}/projects/demo-shanghai-pudong-a/members`;
  const page = await fetch(membersUrl, { headers: { cookie: adminCookie } });
  assert.equal(page.status, 200);
  const data = formDataFrom(await page.text(), 'name="temporaryPassword"');
  const memberEmail = `account-smoke-${Date.now()}@example.com`;
  const memberPassword = "temporary-member-password-2026";
  data.set("displayName", "验收成员");
  data.set("email", memberEmail);
  data.set("temporaryPassword", memberPassword);
  const assigned = await fetch(membersUrl, { method: "POST", headers: { cookie: adminCookie, origin }, body: data, redirect: "manual" });
  assert.ok(assigned.status < 400, `分配成员返回 ${assigned.status}`);
  const memberCookie = await login(memberEmail, memberPassword);
  assert.equal((await fetch(`${origin}/projects/demo-shanghai-pudong-a`, { headers: { cookie: memberCookie } })).status, 200);
  assert.equal((await fetch(`${origin}/projects/demo-shanghai-pudong-a/members`, { headers: { cookie: memberCookie } })).status, 404);
  console.log(JSON.stringify({ passed: 5, failed: 0 }));
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  if (originalData) await writeFile(dataFile, originalData);
  else await rm(dataFile, { force: true });
}
