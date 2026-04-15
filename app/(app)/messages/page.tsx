import { MailDirection } from "@prisma/client";

import { MessagesTableLazy } from "@/components/features/messages-table-lazy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getMessages } from "@/lib/server/data";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    mailboxId: params.mailboxId,
    direction: (params.direction as MailDirection | undefined) ?? undefined,
    search: params.search,
    fromDate: params.fromDate,
    toDate: params.toDate
  };

  const data = await getMessages(filters);

  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Message Traffic</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-5" method="get">
          <Select name="mailboxId" defaultValue={params.mailboxId ?? ""}>
            <option value="">All mailboxes</option>
            {data.mailboxes.map((mailbox) => (
              <option key={mailbox.id} value={mailbox.id}>
                {mailbox.email}
              </option>
            ))}
          </Select>
          <Select name="direction" defaultValue={params.direction ?? ""}>
            <option value="">All directions</option>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
          </Select>
          <Input name="search" placeholder="Subject/body" defaultValue={params.search} />
          <Input name="fromDate" type="date" defaultValue={params.fromDate} />
          <Input name="toDate" type="date" defaultValue={params.toDate} />
          <Button type="submit">Apply</Button>
        </form>
      </Card>
      <MessagesTableLazy
        rows={data.messages.map((message) => ({
          id: message.id,
          mailboxEmail: message.mailbox.email,
          direction: message.direction,
          fromText: message.fromText,
          toText: message.toText,
          subject: message.subject,
          snippet: message.snippet,
          receivedAt: message.receivedAt?.toISOString() ?? null
        }))}
      />
    </>
  );
}
