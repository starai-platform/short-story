PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "points" DECIMAL NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "PromptType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "template" TEXT NOT NULL,
  "chapterTemplate" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "deletedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PromptType_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PromptType_ownerId_deletedAt_idx" ON "PromptType"("ownerId", "deletedAt");

CREATE TABLE IF NOT EXISTS "NovelProject" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "promptTypeId" TEXT,
  "promptNameSnapshot" TEXT NOT NULL,
  "promptTemplateSnapshot" TEXT NOT NULL,
  "chapterPromptSnapshot" TEXT NOT NULL,
  "promptVersionSnapshot" INTEGER NOT NULL,
  "title" TEXT NOT NULL DEFAULT '未命名小说',
  "theme" TEXT NOT NULL,
  "protagonist" TEXT NOT NULL DEFAULT '',
  "worldSetting" TEXT NOT NULL DEFAULT '',
  "pace" TEXT NOT NULL DEFAULT '张弛有度',
  "ending" TEXT NOT NULL DEFAULT '完整收束',
  "constraints" TEXT NOT NULL DEFAULT '',
  "keywords" JSONB NOT NULL,
  "style" TEXT NOT NULL,
  "pov" TEXT NOT NULL,
  "chapterCount" INTEGER NOT NULL,
  "targetWords" INTEGER NOT NULL,
  "synopsis" TEXT NOT NULL DEFAULT '',
  "characters" JSONB,
  "outline" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME,
  CONSTRAINT "NovelProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NovelProject_promptTypeId_fkey" FOREIGN KEY ("promptTypeId") REFERENCES "PromptType"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "NovelProject_userId_createdAt_idx" ON "NovelProject"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "NovelProject_promptTypeId_idx" ON "NovelProject"("promptTypeId");

CREATE TABLE IF NOT EXISTS "NovelChapter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "outlineSummary" TEXT NOT NULL,
  "beats" JSONB NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "generationSummary" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "model" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "durationMs" INTEGER,
  "costPoints" DECIMAL NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME,
  CONSTRAINT "NovelChapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "NovelProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NovelChapter_projectId_number_key" ON "NovelChapter"("projectId", "number");
CREATE INDEX IF NOT EXISTS "NovelChapter_projectId_status_idx" ON "NovelChapter"("projectId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "NovelChapter_one_generating_per_project_idx" ON "NovelChapter"("projectId") WHERE "status" = 'GENERATING';

CREATE TABLE IF NOT EXISTS "Generation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "promptTypeId" TEXT,
  "promptNameSnapshot" TEXT NOT NULL,
  "promptTemplateSnapshot" TEXT NOT NULL,
  "promptVersionSnapshot" INTEGER NOT NULL,
  "input" JSONB NOT NULL,
  "output" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "durationMs" INTEGER,
  "costPoints" DECIMAL NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME,
  CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Generation_promptTypeId_fkey" FOREIGN KEY ("promptTypeId") REFERENCES "PromptType"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Generation_userId_createdAt_idx" ON "Generation"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Generation_promptTypeId_idx" ON "Generation"("promptTypeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Generation_one_running_per_user_idx" ON "Generation"("userId") WHERE "status" = 'RUNNING';

CREATE TABLE IF NOT EXISTS "AiModel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "apiKeyEncrypted" TEXT NOT NULL,
  "inputPricePerMillion" DECIMAL NOT NULL DEFAULT 0,
  "outputPricePerMillion" DECIMAL NOT NULL DEFAULT 0,
  "billingMultiplier" DECIMAL NOT NULL DEFAULT 1,
  "isDefault" BOOLEAN NOT NULL DEFAULT 0,
  "isFallback" BOOLEAN NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "AiModel_isActive_isDefault_isFallback_idx" ON "AiModel"("isActive", "isDefault", "isFallback");

CREATE TABLE IF NOT EXISTS "RedemptionCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "points" DECIMAL NOT NULL,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "expiresAt" DATETIME,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "RedemptionCode_code_key" ON "RedemptionCode"("code");

CREATE TABLE IF NOT EXISTS "RedemptionRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "codeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedemptionRecord_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "RedemptionCode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RedemptionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "RedemptionRecord_codeId_userId_key" ON "RedemptionRecord"("codeId", "userId");
CREATE INDEX IF NOT EXISTS "RedemptionRecord_userId_createdAt_idx" ON "RedemptionRecord"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "PointTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "balanceAfter" DECIMAL NOT NULL,
  "description" TEXT NOT NULL,
  "referenceId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PointTransaction_userId_createdAt_idx" ON "PointTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointTransaction_referenceId_idx" ON "PointTransaction"("referenceId");

CREATE TABLE IF NOT EXISTS "SystemSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "siteName" TEXT NOT NULL DEFAULT '章回',
  "logoUrl" TEXT NOT NULL DEFAULT '',
  "faviconUrl" TEXT NOT NULL DEFAULT '',
  "siteTitle" TEXT NOT NULL DEFAULT '章回｜AI 短篇小说生成器',
  "siteDescription" TEXT NOT NULL DEFAULT '规划并生成 10–50 章、10 万字以内的完整中文小说。',
  "footerCopyright" TEXT NOT NULL DEFAULT '让每一个灵感，都有机会成为完整作品。',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

PRAGMA user_version = 2;
