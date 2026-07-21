ALTER TABLE "PromptType" ADD COLUMN "chapterTemplate" TEXT;

UPDATE "PromptType"
SET "chapterTemplate" = "template"
WHERE "chapterTemplate" IS NULL;

ALTER TABLE "PromptType" ALTER COLUMN "chapterTemplate" SET NOT NULL;

ALTER TABLE "NovelProject" ADD COLUMN "chapterPromptSnapshot" TEXT;

UPDATE "NovelProject" AS project
SET "chapterPromptSnapshot" = COALESCE(prompt."chapterTemplate", project."promptTemplateSnapshot")
FROM "PromptType" AS prompt
WHERE project."promptTypeId" = prompt."id"
  AND project."chapterPromptSnapshot" IS NULL;

UPDATE "NovelProject"
SET "chapterPromptSnapshot" = "promptTemplateSnapshot"
WHERE "chapterPromptSnapshot" IS NULL;

ALTER TABLE "NovelProject" ALTER COLUMN "chapterPromptSnapshot" SET NOT NULL;
