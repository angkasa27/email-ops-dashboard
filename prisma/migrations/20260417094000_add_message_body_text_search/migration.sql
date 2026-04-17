ALTER TABLE "Message"
ADD COLUMN "bodyTextSearch" TEXT;

UPDATE "Message"
SET "bodyTextSearch" = LEFT(COALESCE("bodyText", ''), 250000)
WHERE "bodyText" IS NOT NULL;

DROP INDEX IF EXISTS "Message_body_fts_idx";
DROP INDEX IF EXISTS "Message_subject_body_fts_idx";

CREATE INDEX "Message_body_fts_idx"
ON "Message"
USING GIN (to_tsvector('simple', coalesce("bodyTextSearch", '')));

CREATE INDEX "Message_subject_body_fts_idx"
ON "Message"
USING GIN (to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce("bodyTextSearch", '')));
