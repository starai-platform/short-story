import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const schemaDirectory = path.join(root, "prisma");
const databaseUrl = process.env.DATABASE_URL || "file:./novel.sqlite";
if (!databaseUrl.startsWith("file:")) throw new Error("SQLite DATABASE_URL 必须以 file: 开头");
const rawPath = databaseUrl.slice(5);
const databasePath = path.isAbsolute(rawPath) || /^[A-Za-z]:[\\/]/.test(rawPath)
  ? rawPath
  : path.resolve(schemaDirectory, rawPath);
const sql = readFileSync(path.join(schemaDirectory, "sqlite-init.sql"), "utf8");
const database = new DatabaseSync(databasePath);
function applySchema() { database.exec(sql); }
function resetInterruptedJobs() {
  database.exec(`
    UPDATE "NovelChapter"
    SET "status" = 'FAILED', "errorCode" = 'STALE_GENERATION', "errorMessage" = '上次生成异常中断', "completedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "status" = 'GENERATING';
    UPDATE "Generation"
    SET "status" = 'FAILED', "errorCode" = 'STALE_GENERATION', "errorMessage" = '上次生成异常中断', "completedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "status" = 'RUNNING';
  `);
}
try {
  try {
    applySchema();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/UNIQUE constraint failed|already exists/i.test(message)) throw error;
    resetInterruptedJobs();
    applySchema();
  }
} finally { database.close(); }
process.stdout.write(`[SQLite] 数据库已就绪：${databasePath}\n`);
