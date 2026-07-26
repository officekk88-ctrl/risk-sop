import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const source = path.join(process.cwd(), ".data", "mvp-data.json");
const temporary = await mkdtemp(path.join(os.tmpdir(), "pickleball-risk-backup-"));
try {
  const backup = path.join(temporary, "backup", "mvp-data.json");
  const restored = path.join(temporary, "restored", "mvp-data.json");
  await mkdir(path.dirname(backup), { recursive: true });
  await mkdir(path.dirname(restored), { recursive: true });
  await cp(source, backup, { recursive: false });
  await cp(backup, restored, { recursive: false });
  const [sourceBytes, restoredBytes] = await Promise.all([readFile(source), readFile(restored)]);
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest(restoredBytes), digest(sourceBytes));
  const data = JSON.parse(restoredBytes.toString("utf8"));
  assert.equal(data.version, 1);
  assert.ok(Array.isArray(data.projects));
  assert.ok(Array.isArray(data.auditLogs));
  console.log(JSON.stringify({ backupBytes: sourceBytes.length, checksumMatch: true, parseable: true }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
