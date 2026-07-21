import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const localEnvPath = path.join(root, ".env.local");
const projectEnvPath = path.join(root, ".env");

function readEnvFile(filePath) { return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""; }
function readEnvValue(content, key) {
  const value = content.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, "m"))?.[1]?.trim() || "";
  return value.replace(/^(['"])(.*)\1$/, "$2").trim();
}
function isUsableSecret(value) {
  return value.length >= 32 && !/请替换|replace|change-me|your-secret/i.test(value);
}
function isUsablePassword(value) { return value.length >= 8 && value.length <= 72; }
function upsertLocalEnv(key, value) {
  const current = readEnvFile(localEnvPath);
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  const next = pattern.test(current) ? current.replace(pattern, line) : `${current.trimEnd()}${current.trim() ? "\n" : ""}${line}\n`;
  writeFileSync(localEnvPath, next, "utf8");
}

const localEnv = readEnvFile(localEnvPath);
const projectEnv = readEnvFile(projectEnvPath);
const localSecret = readEnvValue(localEnv, "AUTH_SECRET");
const projectSecret = readEnvValue(projectEnv, "AUTH_SECRET");
let authSecret = process.env.AUTH_SECRET || localSecret || projectSecret;
if (!isUsableSecret(authSecret)) {
  authSecret = randomBytes(48).toString("base64url");
  upsertLocalEnv("AUTH_SECRET", authSecret);
  process.stdout.write("[SQLite] 已自动生成登录安全密钥并保存到 .env.local\n");
}
if (!readEnvValue(localEnv, "AUTH_TRUST_HOST") && !readEnvValue(projectEnv, "AUTH_TRUST_HOST")) upsertLocalEnv("AUTH_TRUST_HOST", "true");

const configuredAdminEmails = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || readEnvValue(localEnv, "ADMIN_EMAILS") || readEnvValue(localEnv, "ADMIN_EMAIL") || readEnvValue(projectEnv, "ADMIN_EMAILS") || readEnvValue(projectEnv, "ADMIN_EMAIL");
const adminEmail = (configuredAdminEmails || "admin@example.com").split(",")[0].trim().toLowerCase();
if (!configuredAdminEmails) upsertLocalEnv("ADMIN_EMAILS", adminEmail);

let adminPassword = process.env.ADMIN_PASSWORD || readEnvValue(localEnv, "ADMIN_PASSWORD") || readEnvValue(projectEnv, "ADMIN_PASSWORD");
if (!isUsablePassword(adminPassword)) {
  adminPassword = `Nvl-${randomBytes(12).toString("base64url")}`;
  upsertLocalEnv("ADMIN_PASSWORD", adminPassword);
  process.stdout.write("[SQLite] 已生成本地管理员初始密码并保存到 .env.local\n");
}
const adminAlreadyBootstrapped = readEnvValue(localEnv, "SQLITE_ADMIN_BOOTSTRAPPED") === "true" || readEnvValue(projectEnv, "SQLITE_ADMIN_BOOTSTRAPPED") === "true";

const pnpmScript = process.env.npm_execpath;
const command = pnpmScript ? process.execPath : (process.platform === "win32" ? "pnpm.cmd" : "pnpm");
const commandPrefix = pnpmScript ? [pnpmScript] : [];
const production = process.argv.includes("--prod");
const portArg = process.argv.find((item) => item.startsWith("--port="));
const port = portArg?.slice("--port=".length) || process.env.PORT || "3000";
const env = {
  ...process.env,
  AUTH_SECRET: authSecret,
  AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "true",
  ADMIN_EMAILS: configuredAdminEmails || adminEmail,
  ADMIN_PASSWORD: adminPassword,
  SQLITE_BOOTSTRAP_ADMIN: adminAlreadyBootstrapped ? "false" : "true",
  DATABASE_URL: process.env.SQLITE_DATABASE_URL || "file:./novel.sqlite",
  DATABASE_PROVIDER: "sqlite",
};

function run(args, label) {
  process.stdout.write(`\n[SQLite] ${label}\n`);
  const result = spawnSync(command, [...commandPrefix, ...args], { cwd: root, env, stdio: "inherit", shell: !pnpmScript && process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(["exec", "prisma", "generate", "--schema", "prisma/schema.sqlite.prisma"], "生成 SQLite 数据库客户端");
run(["exec", "node", "scripts/init-sqlite.mjs"], "初始化或同步 SQLite 数据库");
run(["exec", "tsx", "prisma/seed.ts"], "初始化系统小说类型");
if (!adminAlreadyBootstrapped) {
  upsertLocalEnv("SQLITE_ADMIN_BOOTSTRAPPED", "true");
  process.stdout.write(`\n[SQLite] 管理员账号：${adminEmail}\n[SQLite] 管理员初始密码：${adminPassword}\n[SQLite] 请登录后及时修改密码。\n`);
}

if (production) run(["exec", "next", "build"], "构建生产版本");

process.stdout.write(`\n[SQLite] ${production ? "生产服务" : "开发服务"}启动于 http://localhost:${port}\n`);
const child = spawn(command, [...commandPrefix, "exec", "next", production ? "start" : "dev", "-p", port], { cwd: root, env, stdio: "inherit", shell: !pnpmScript && process.platform === "win32" });
child.on("exit", (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
