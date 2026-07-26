const failures = [];
const warnings = [];
const required = (name) => process.env[name]?.trim() ?? "";

const secret = required("SESSION_SECRET");
if (secret.length < 32 || /replace|change-me|example/i.test(secret)) failures.push("SESSION_SECRET 必须是至少 32 位的非示例值。");

const email = required("MVP_ADMIN_EMAIL");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) failures.push("MVP_ADMIN_EMAIL 必须是有效邮箱。");

const password = required("MVP_ADMIN_PASSWORD");
if (password.length < 12 || /change-me|password|123456/i.test(password)) failures.push("MVP_ADMIN_PASSWORD 必须至少 12 位且不能使用默认值。");

const origin = required("APP_ORIGIN");
const allowInsecureHttp = required("ALLOW_INSECURE_HTTP") === "true";
try {
  const url = new URL(origin);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname) && !allowInsecureHttp) {
    failures.push("APP_ORIGIN 在非本机生产环境必须使用 HTTPS。");
  }
  if (process.env.NODE_ENV === "production" && url.protocol === "http:" && allowInsecureHttp) {
    warnings.push("已显式允许生产环境 HTTP：会话和业务数据将不受 TLS 保护，仅应用于受控测试环境。");
  }
} catch {
  failures.push("APP_ORIGIN 必须是完整 URL。");
}

if (Object.keys(process.env).some((name) => name.startsWith("NEXT_PUBLIC_OPENAI"))) failures.push("禁止将 AI 密钥放入 NEXT_PUBLIC_* 环境变量。");
const aiKey = required("OPENAI_API_KEY");
const aiModel = required("OPENAI_MODEL");
if (!aiKey || !aiModel) warnings.push("未同时配置 OPENAI_API_KEY 和 OPENAI_MODEL，AI 咨询、材料初审和知识导入将保持不可用。");

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exit(1);
}
console.log("环境变量检查通过。");
