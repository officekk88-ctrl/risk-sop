import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const dataFile = path.resolve(".data/mvp-data.json");
const uploadDirectory = path.resolve(".data/uploads");
const originalData = existsSync(dataFile) ? await readFile(dataFile) : null;
const originalUploads = new Set(existsSync(uploadDirectory) ? await readdir(uploadDirectory) : []);
const port = 4100 + Math.floor(Math.random() * 200);
const origin = `http://127.0.0.1:${port}`;
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: { ...process.env, NODE_ENV: "production", APP_ORIGIN: origin },
  stdio: "ignore",
});

const decode = (value = "") => value.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#x27;", "'");

function adminCookie() {
  const email = process.env.MVP_ADMIN_EMAIL || "admin@example.com";
  const secret = process.env.SESSION_SECRET || "local-development-session-secret-change-me";
  const payload = Buffer.from(JSON.stringify({ email, role: "ADMIN", expiresAt: Date.now() + 120_000 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `pickleball_mvp_session=${payload}.${signature}`;
}

function uploadFormData(html) {
  const form = [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((match) => match[0]).find((value) => value.includes('type="file"'));
  assert.ok(form, "项目首个尽调项未显示材料上传表单");
  const data = new FormData();
  for (const input of form.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/g)) {
    if (input[0].includes('type="file"')) continue;
    data.set(decode(input[1]), decode(input[0].match(/value="([^"]*)"/)?.[1] ?? ""));
  }
  return data;
}

function assessmentFormData(html) {
  const form = [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((match) => match[0]).find((value) => value.includes('name="analysis"'));
  assert.ok(form, "AI 初判后未显示人工编辑表单");
  const data = new FormData();
  for (const input of form.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/g)) {
    data.set(decode(input[1]), decode(input[0].match(/value="([^"]*)"/)?.[1] ?? ""));
  }
  return data;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("服务器未在 20 秒内启动。");
}

try {
  await waitForServer();
  const projectUrl = `${origin}/projects/demo-shanghai-pudong-a`;
  const cookie = adminCookie();
  const page = await fetch(projectUrl, { headers: { cookie } });
  assert.equal(page.status, 200);
  const formData = uploadFormData(await page.text());
  const fixture = await readFile(path.resolve("test-fixtures/sample-contract.pdf"));
  formData.set("file", new File([fixture], "OWN-01-smoke.pdf", { type: "application/pdf" }));
  const response = await fetch(projectUrl, { method: "POST", headers: { cookie, origin }, body: formData, redirect: "manual" });
  assert.ok(response.status < 400, `逐项材料上传返回 ${response.status}`);

  const data = JSON.parse(await readFile(dataFile, "utf8"));
  const project = data.projects.find((item) => item.id === "demo-shanghai-pudong-a");
  const item = project?.checklist.find((candidate) => candidate.code === "OWN-01");
  const document = data.documents.find((candidate) => candidate.projectId === project?.id && candidate.fileName === "OWN-01-smoke.pdf");
  assert.deepEqual(document?.checklistCodes, ["OWN-01"]);
  assert.equal(document?.parseStatus, "COMPLETED");
  assert.equal(item?.aiAssessment?.status, "COMPLETED");
  assert.ok(["PASSED", "FAILED", "VERIFY"].includes(item?.aiAssessment?.judgment));

  const updatedPage = await fetch(projectUrl, { headers: { cookie } });
  const assessmentData = assessmentFormData(await updatedPage.text());
  assessmentData.set("judgment", "VERIFY");
  assessmentData.set("confidence", "LOW");
  assessmentData.set("analysis", "人工修改后的初步分析，仅用于自动化验收。");
  assessmentData.set("evidence", "人工复核材料依据。");
  assessmentData.set("recommendation", "继续补充原件并请专家复核。");
  assessmentData.set("requiresExpertReview", "on");
  const updateResponse = await fetch(projectUrl, { method: "POST", headers: { cookie, origin }, body: assessmentData, redirect: "manual" });
  assert.ok(updateResponse.status < 400, `人工修改初判返回 ${updateResponse.status}`);
  const updatedData = JSON.parse(await readFile(dataFile, "utf8"));
  const updatedItem = updatedData.projects.find((candidate) => candidate.id === "demo-shanghai-pudong-a")?.checklist.find((candidate) => candidate.code === "OWN-01");
  assert.equal(updatedItem?.aiAssessment?.source, "MANUAL_EDIT");
  assert.equal(updatedItem?.aiAssessment?.analysis, "人工修改后的初步分析，仅用于自动化验收。");
  console.log(JSON.stringify({ passed: 8, checklistCode: "OWN-01", judgment: updatedItem.aiAssessment.judgment, editable: true }));
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  if (originalData) await writeFile(dataFile, originalData);
  else await rm(dataFile, { force: true });
  if (existsSync(uploadDirectory)) {
    for (const file of await readdir(uploadDirectory)) {
      if (!originalUploads.has(file)) await rm(path.join(uploadDirectory, file), { force: true });
    }
  }
}
