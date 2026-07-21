CREATE TYPE "GenerationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptType" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "template" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromptType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptTypeId" TEXT,
    "promptNameSnapshot" TEXT NOT NULL,
    "promptTemplateSnapshot" TEXT NOT NULL,
    "promptVersionSnapshot" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "output" TEXT NOT NULL DEFAULT '',
    "status" "GenerationStatus" NOT NULL DEFAULT 'RUNNING',
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "PromptType_ownerId_deletedAt_idx" ON "PromptType"("ownerId", "deletedAt");
CREATE INDEX "Generation_userId_createdAt_idx" ON "Generation"("userId", "createdAt" DESC);
CREATE INDEX "Generation_promptTypeId_idx" ON "Generation"("promptTypeId");
CREATE UNIQUE INDEX "Generation_one_running_per_user_idx" ON "Generation"("userId") WHERE "status" = 'RUNNING';

ALTER TABLE "PromptType" ADD CONSTRAINT "PromptType_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_promptTypeId_fkey" FOREIGN KEY ("promptTypeId") REFERENCES "PromptType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
