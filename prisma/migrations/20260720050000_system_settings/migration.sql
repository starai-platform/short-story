CREATE TABLE "SystemSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "siteName" TEXT NOT NULL DEFAULT '章回',
  "logoUrl" TEXT NOT NULL DEFAULT '',
  "faviconUrl" TEXT NOT NULL DEFAULT '',
  "siteTitle" TEXT NOT NULL DEFAULT '章回｜AI 短篇小说生成器',
  "siteDescription" TEXT NOT NULL DEFAULT '规划并生成 10–50 章、10 万字以内的完整中文小说。',
  "footerCopyright" TEXT NOT NULL DEFAULT '让每一个灵感，都有机会成为完整作品。',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SystemSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
