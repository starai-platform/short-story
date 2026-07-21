CREATE TYPE "PointTransactionType" AS ENUM ('RECHARGE', 'CONSUMPTION', 'ADJUSTMENT', 'REFUND');

ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "points" DECIMAL(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "NovelChapter" ADD COLUMN "costPoints" DECIMAL(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "Generation" ADD COLUMN "costPoints" DECIMAL(18,6) NOT NULL DEFAULT 0;

CREATE TABLE "AiModel" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "apiKeyEncrypted" TEXT NOT NULL,
  "inputPricePerMillion" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "outputPricePerMillion" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "billingMultiplier" DECIMAL(10,4) NOT NULL DEFAULT 1,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RedemptionCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "points" DECIMAL(18,6) NOT NULL,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RedemptionCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RedemptionRecord" (
  "id" TEXT NOT NULL,
  "codeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" DECIMAL(18,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedemptionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "PointTransactionType" NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "balanceAfter" DECIMAL(18,6) NOT NULL,
  "description" TEXT NOT NULL,
  "referenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RedemptionCode_code_key" ON "RedemptionCode"("code");
CREATE INDEX "AiModel_isActive_isDefault_isFallback_idx" ON "AiModel"("isActive", "isDefault", "isFallback");
CREATE UNIQUE INDEX "RedemptionRecord_codeId_userId_key" ON "RedemptionRecord"("codeId", "userId");
CREATE INDEX "RedemptionRecord_userId_createdAt_idx" ON "RedemptionRecord"("userId", "createdAt" DESC);
CREATE INDEX "PointTransaction_userId_createdAt_idx" ON "PointTransaction"("userId", "createdAt" DESC);
CREATE INDEX "PointTransaction_referenceId_idx" ON "PointTransaction"("referenceId");
ALTER TABLE "RedemptionRecord" ADD CONSTRAINT "RedemptionRecord_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "RedemptionCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedemptionRecord" ADD CONSTRAINT "RedemptionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
