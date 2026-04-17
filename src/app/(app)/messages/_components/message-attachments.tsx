import { PaperclipIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type MessageAttachmentItem = {
  id: string;
  filename: string;
  contentType: string | null;
  contentDisposition: string | null;
  contentId: string | null;
  partId: string | null;
  size: number | null;
  isInline: boolean;
  createdAt: Date;
};

function formatAttachmentSize(size: number | null) {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
    return null;
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentSection({
  title,
  items,
}: {
  title: string;
  items: MessageAttachmentItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PaperclipIcon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map((attachment) => {
          const sizeLabel = formatAttachmentSize(attachment.size);

          return (
            <div
              key={attachment.id}
              className="rounded-lg border bg-muted/20 px-3 py-2 text-sm"
            >
              <div className="font-medium break-all">{attachment.filename}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{attachment.contentType ?? "unknown content type"}</span>
                {sizeLabel ? <span>{sizeLabel}</span> : null}
                {attachment.contentDisposition ? <span>{attachment.contentDisposition}</span> : null}
                {attachment.contentId ? <span>cid:{attachment.contentId}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MessageAttachments({
  attachments,
  inlineAssets,
}: {
  attachments: MessageAttachmentItem[];
  inlineAssets: MessageAttachmentItem[];
}) {
  if (attachments.length === 0 && inlineAssets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <AttachmentSection title="Attachments" items={attachments} />
      <AttachmentSection title="Inline Assets" items={inlineAssets} />
    </div>
  );
}
