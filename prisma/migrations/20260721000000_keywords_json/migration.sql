ALTER TABLE "NovelProject"
ALTER COLUMN "keywords" TYPE JSONB
USING to_jsonb("keywords");
