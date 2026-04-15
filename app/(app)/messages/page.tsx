import { MailDirection } from "@/generated/prisma/client";
import Link from "next/link";

import { MessagesInbox } from "@/components/features/messages-inbox";
import { MessagesTable } from "@/components/features/messages-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  getMessages,
  type MessageSortBy,
  type MessageSortDir,
} from "@/lib/server/data";

export const dynamic = "force-dynamic";

type ViewMode = "table" | "inbox";

function toInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function getViewMode(value: string | undefined): ViewMode {
  return value === "inbox" ? "inbox" : "table";
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = toInt(params.page, 1);
  const pageSize = Math.min(toInt(params.pageSize, 50), 100);
  const view = getViewMode(params.view);

  const filters = {
    mailboxId: params.mailboxId,
    direction: (params.direction as MailDirection | undefined) ?? undefined,
    folderName:
      params.folderName === "Inbox" || params.folderName === "Sent"
        ? params.folderName
        : undefined,
    searchScope:
      params.searchScope === "subject" ||
      params.searchScope === "body" ||
      params.searchScope === "all"
        ? params.searchScope
        : undefined,
    search: params.search,
    fromDate: params.fromDate,
    toDate: params.toDate,
    page,
    pageSize,
    sortBy: params.sortBy as MessageSortBy | undefined,
    sortDir: params.sortDir === "asc" ? "asc" : "desc",
  } as const;

  const data = await getMessages(filters);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const startItem = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const endItem =
    data.total === 0 ? 0 : Math.min(data.page * data.pageSize, data.total);

  function buildUrl(next: Record<string, string | undefined>) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (!value) {
        continue;
      }
      query.set(key, value);
    }

    for (const [key, value] of Object.entries(next)) {
      if (!value) {
        query.delete(key);
      } else {
        query.set(key, value);
      }
    }

    const output = query.toString();
    return output ? `/messages?${output}` : "/messages";
  }

  function getSortHref(column: MessageSortBy) {
    const nextDir: MessageSortDir =
      data.sort.by === column && data.sort.direction === "desc" ? "asc" : "desc";

    return buildUrl({
      sortBy: column,
      sortDir: nextDir,
      page: "1",
    });
  }

  const sortHrefs: Record<MessageSortBy, string> = {
    receivedAt: getSortHref("receivedAt"),
    syncedAt: getSortHref("syncedAt"),
    subject: getSortHref("subject"),
    mailbox: getSortHref("mailbox"),
    direction: getSortHref("direction"),
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Message Explorer</CardTitle>
              <CardDescription>
                Search, filter, sort, and page through monitored email activity.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant={view === "table" ? "default" : "outline"}>
                <Link href={buildUrl({ view: "table", page: "1" })}>Table View</Link>
              </Button>
              <Button asChild variant={view === "inbox" ? "default" : "outline"}>
                <Link href={buildUrl({ view: "inbox", page: "1" })}>Inbox View</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" method="get">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="sortBy" value={data.sort.by} />
            <input type="hidden" name="sortDir" value={data.sort.direction} />
            <FieldGroup className="md:grid md:grid-cols-5 md:items-end md:gap-3">
              <Field>
                <FieldLabel htmlFor="mailboxId">Mailbox</FieldLabel>
                <select
                  id="mailboxId"
                  name="mailboxId"
                  defaultValue={params.mailboxId ?? ""}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">All mailboxes</option>
                  {data.mailboxes.map((mailbox) => (
                    <option key={mailbox.id} value={mailbox.id}>
                      {mailbox.email}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="direction">Direction</FieldLabel>
                <select
                  id="direction"
                  name="direction"
                  defaultValue={params.direction ?? ""}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">All directions</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="folderName">Folder</FieldLabel>
                <select
                  id="folderName"
                  name="folderName"
                  defaultValue={params.folderName ?? ""}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">All folders</option>
                  <option value="Inbox">Inbox</option>
                  <option value="Sent">Sent</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="searchScope">Search in</FieldLabel>
                <select
                  id="searchScope"
                  name="searchScope"
                  defaultValue={params.searchScope ?? "all"}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Subject + Body</option>
                  <option value="subject">Subject only</option>
                  <option value="body">Body only</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="search">Search</FieldLabel>
                <Input
                  id="search"
                  name="search"
                  placeholder="Subject or body"
                  defaultValue={params.search}
                />
              </Field>
              <div className="md:col-span-5 flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" type="button">
                      Advanced
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[340px]">
                    <div className="flex flex-col gap-3">
                      <Field>
                        <FieldLabel htmlFor="fromDate">From date</FieldLabel>
                        <Input
                          id="fromDate"
                          name="fromDate"
                          type="date"
                          defaultValue={params.fromDate}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="toDate">To date</FieldLabel>
                        <Input
                          id="toDate"
                          name="toDate"
                          type="date"
                          defaultValue={params.toDate}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="pageSize">Rows per page</FieldLabel>
                        <select
                          id="pageSize"
                          name="pageSize"
                          defaultValue={String(pageSize)}
                          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="25">25</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </select>
                      </Field>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button type="submit">Apply</Button>
                <Button asChild variant="ghost">
                  <Link href="/messages">Reset</Link>
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            Showing {startItem} - {endItem} of {data.total} messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {view === "table" ? (
            <MessagesTable
              rows={data.items.map((message) => ({
                id: message.id,
                mailboxEmail: message.mailbox.email,
                direction: message.direction,
                folderName: message.folderName,
                fromText: message.fromText,
                toText: message.toText,
                subject: message.subject,
                snippet: message.snippet,
                receivedAt: message.receivedAt?.toISOString() ?? null,
                syncedAt: message.syncedAt.toISOString(),
              }))}
              sortBy={data.sort.by}
              sortDir={data.sort.direction}
              sortHrefs={sortHrefs}
            />
          ) : (
            <MessagesInbox
              rows={data.items.map((message) => ({
                id: message.id,
                mailboxEmail: message.mailbox.email,
                direction: message.direction,
                fromText: message.fromText,
                toText: message.toText,
                subject: message.subject,
                snippet: message.snippet,
                receivedAt: message.receivedAt?.toISOString() ?? null,
              }))}
            />
          )}

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={buildUrl({
                    page: String(data.page === 1 ? 1 : data.page - 1),
                  })}
                  aria-disabled={data.page === 1}
                />
              </PaginationItem>
              {Array.from({ length: totalPages })
                .slice(
                  Math.max(0, data.page - 3),
                  Math.min(totalPages, data.page + 2),
                )
                .map((_, index) => {
                  const pageNumber = Math.max(1, data.page - 2) + index;
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href={buildUrl({ page: String(pageNumber) })}
                        isActive={pageNumber === data.page}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
              <PaginationItem>
                <PaginationNext
                  href={buildUrl({
                    page: String(
                      data.page === totalPages ? totalPages : data.page + 1,
                    ),
                  })}
                  aria-disabled={data.page === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>
    </div>
  );
}
