-- Full-text search indexes for web-style query matching across subject/body.
CREATE INDEX "Message_subject_fts_idx"
ON "Message"
USING GIN (to_tsvector('simple', coalesce(subject, '')));

CREATE INDEX "Message_body_fts_idx"
ON "Message"
USING GIN (to_tsvector('simple', coalesce("bodyText", '')));

CREATE INDEX "Message_subject_body_fts_idx"
ON "Message"
USING GIN (to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce("bodyText", '')));
