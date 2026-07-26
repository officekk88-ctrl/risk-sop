import { cp, readFile, stat } from "node:fs/promises";
import path from "node:path";

const backup = process.argv[2] ? path.resolve(process.argv[2]) : "";
if (!backup || process.argv[3] !== "--confirm") {
  console.error("用法: node scripts/restore-mvp.mjs <备份目录> --confirm");
  process.exit(2);
}
await stat(path.join(backup, ".data", "mvp-data.json"));
const parsed = JSON.parse(await readFile(path.join(backup, ".data", "mvp-data.json"), "utf8"));
if (parsed.version !== 1 || !Array.isArray(parsed.projects)) throw new Error("备份数据结构无效。");
const target = path.resolve(process.cwd(), ".data");
await cp(path.join(backup, ".data"), target, { recursive: true, force: true });
console.log(`已恢复到 ${target}；启动应用前请确认服务已停止。`);
