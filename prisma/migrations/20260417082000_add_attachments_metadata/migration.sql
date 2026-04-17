CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT,
    "contentDisposition" TEXT,
    "contentId" TEXT,
    "partId" TEXT,
    "size" INTEGER,
    "isInline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_messageId_isInline_createdAt_idx" ON "Attachment"("messageId", "isInline", "createdAt");

ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
