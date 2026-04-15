"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

import { DirectionBadge } from "@/components/features/status-badge";

type InboxRow = {
  id: string;
  mailboxEmail: string;
  direction: "incoming" | "outgoing";
  fromText: string;
  toText: string;
  subject: string | null;
  snippet: string | null;
  receivedAt: string | null;
};

function formatRelativeDate(value: string | null) {
  if (!value) {
    return "unknown";
  }

  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function MessagesInbox({ rows }: { rows: InboxRow[] }) {
  const router = useRouter();

  return (
    <div className="flex min-w-0 flex-col divide-y rounded-xl border">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="grid w-full min-w-0 gap-2 px-4 py-3 text-left hover:bg-muted/50 md:grid-cols-[1fr_auto]"
          onClick={() => router.push(`/messages/${row.id}`)}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <DirectionBadge direction={row.direction} />
              <p className="truncate text-xs text-muted-foreground">{row.mailboxEmail}</p>
            </div>
            <p className="truncate font-medium">{row.subject ?? "(no subject)"}</p>
            <p className="truncate text-sm text-muted-foreground">
              {row.snippet ?? row.fromText ?? row.toText ?? "-"}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-1">
            <p className="text-xs text-muted-foreground">{formatRelativeDate(row.receivedAt)}</p>
            <p className="truncate text-xs text-muted-foreground">From: {row.fromText || "-"}</p>
            <p className="truncate text-xs text-muted-foreground">To: {row.toText || "-"}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
