import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const source = path.resolve(process.cwd(), ".data");
await stat(source).catch(() => { throw new Error(`数据目录不存在: ${source}`); });
const root = path.resolve(process.argv[2] ?? path.join(process.cwd(), "backups"));
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const target = path.join(root, `mvp-${stamp}`);
await mkdir(target, { recursive: true });
await cp(source, path.join(target, ".data"), { recursive: true, errorOnExist: true });
await writeFile(path.join(target, "backup.json"), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), source }, null, 2));
console.log(target);
