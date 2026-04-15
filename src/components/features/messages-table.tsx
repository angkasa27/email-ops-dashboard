"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { CaretDownIcon, CaretUpIcon, ArrowsDownUpIcon } from "@phosphor-icons/react";

import { DirectionBadge } from "@/components/features/status-badge";
import type { MessageSortBy, MessageSortDir } from "@/lib/server/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MessageRow = {
  id: string;
  mailboxEmail: string;
  direction: "incoming" | "outgoing";
  folderName: string;
  fromText: string;
  toText: string;
  subject: string | null;
  snippet: string | null;
  receivedAt: string | null;
  syncedAt: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return format(new Date(value), "yyyy-MM-dd HH:mm");
}

function SortHeader({
  label,
  column,
  activeSortBy,
  activeSortDir,
  href,
}: {
  label: string;
  column: MessageSortBy;
  activeSortBy: MessageSortBy;
  activeSortDir: MessageSortDir;
  href: string;
}) {
  const isActive = activeSortBy === column;

  return (
    <Link className="inline-flex items-center gap-1 hover:text-foreground" href={href}>
      <span>{label}</span>
      {isActive ? (
        activeSortDir === "asc" ? (
          <CaretUpIcon data-icon="inline-end" />
        ) : (
          <CaretDownIcon data-icon="inline-end" />
        )
      ) : (
        <ArrowsDownUpIcon data-icon="inline-end" />
      )}
    </Link>
  );
}

export function MessagesTable({
  rows,
  sortBy,
  sortDir,
  sortHrefs,
}: {
  rows: MessageRow[];
  sortBy: MessageSortBy;
  sortDir: MessageSortDir;
  sortHrefs: Record<MessageSortBy, string>;
}) {
  const router = useRouter();

  return (
    <Table className="min-w-[1320px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[13ch]">
            <SortHeader
              label="Received"
              column="receivedAt"
              activeSortBy={sortBy}
              activeSortDir={sortDir}
              href={sortHrefs.receivedAt}
            />
          </TableHead>
          <TableHead className="w-[16ch]">
            <SortHeader
              label="Mailbox"
              column="mailbox"
              activeSortBy={sortBy}
              activeSortDir={sortDir}
              href={sortHrefs.mailbox}
            />
          </TableHead>
          <TableHead className="w-[12ch]">
            <SortHeader
              label="Direction"
              column="direction"
              activeSortBy={sortBy}
              activeSortDir={sortDir}
              href={sortHrefs.direction}
            />
          </TableHead>
          <TableHead className="w-[18ch]">From</TableHead>
          <TableHead className="w-[18ch]">To</TableHead>
          <TableHead className="w-[26ch]">
            <SortHeader
              label="Subject"
              column="subject"
              activeSortBy={sortBy}
              activeSortDir={sortDir}
              href={sortHrefs.subject}
            />
          </TableHead>
          <TableHead className="w-[28ch]">Snippet</TableHead>
          <TableHead className="w-[13ch]">
            <SortHeader
              label="Synced"
              column="syncedAt"
              activeSortBy={sortBy}
              activeSortDir={sortDir}
              href={sortHrefs.syncedAt}
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            tabIndex={0}
            role="link"
            className="cursor-pointer"
            onClick={() => router.push(`/messages/${row.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/messages/${row.id}`);
              }
            }}
          >
            <TableCell>
              <span className="block truncate">{formatDateTime(row.receivedAt)}</span>
            </TableCell>
            <TableCell>
              <span className="block truncate">{row.mailboxEmail}</span>
            </TableCell>
            <TableCell>
              <DirectionBadge direction={row.direction} />
            </TableCell>
            <TableCell>
              <span className="block truncate">{row.fromText || "-"}</span>
            </TableCell>
            <TableCell>
              <span className="block truncate">{row.toText || "-"}</span>
            </TableCell>
            <TableCell>
              <span className="block truncate font-medium">{row.subject ?? "(no subject)"}</span>
            </TableCell>
            <TableCell>
              <span className="block truncate text-muted-foreground">{row.snippet ?? "-"}</span>
            </TableCell>
            <TableCell>
              <span className="block truncate">{formatDateTime(row.syncedAt)}</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
