CREATE TYPE "NovelStatus" AS ENUM ('DRAFT', 'OUTLINING', 'READY', 'GENERATING', 'COMPLETED', 'FAILED');
CREATE TYPE "ChapterStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "NovelProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptTypeId" TEXT,
    "promptNameSnapshot" TEXT NOT NULL,
    "promptTemplateSnapshot" TEXT NOT NULL,
    "promptVersionSnapshot" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '未命名小说',
    "theme" TEXT NOT NULL,
    "keywords" TEXT[],
    "style" TEXT NOT NULL,
    "pov" TEXT NOT NULL,
    "chapterCount" INTEGER NOT NULL,
    "targetWords" INTEGER NOT NULL,
    "synopsis" TEXT NOT NULL DEFAULT '',
    "characters" JSONB,
    "outline" JSONB,
    "status" "NovelStatus" NOT NULL DEFAULT 'DRAFT',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "NovelProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NovelChapter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "outlineSummary" TEXT NOT NULL,
    "beats" JSONB NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "generationSummary" TEXT NOT NULL DEFAULT '',
    "status" "ChapterStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "NovelChapter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NovelProject_userId_createdAt_idx" ON "NovelProject"("userId", "createdAt" DESC);
CREATE INDEX "NovelProject_promptTypeId_idx" ON "NovelProject"("promptTypeId");
CREATE UNIQUE INDEX "NovelChapter_projectId_number_key" ON "NovelChapter"("projectId", "number");
CREATE INDEX "NovelChapter_projectId_status_idx" ON "NovelChapter"("projectId", "status");
CREATE UNIQUE INDEX "NovelChapter_one_generating_per_project_idx" ON "NovelChapter"("projectId") WHERE "status" = 'GENERATING';

ALTER TABLE "NovelProject" ADD CONSTRAINT "NovelProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NovelProject" ADD CONSTRAINT "NovelProject_promptTypeId_fkey" FOREIGN KEY ("promptTypeId") REFERENCES "PromptType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NovelChapter" ADD CONSTRAINT "NovelChapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "NovelProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
