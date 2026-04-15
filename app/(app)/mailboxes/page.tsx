import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMailboxes } from "@/lib/server/data";

import {
  createMailboxAction,
  deleteMailboxAction,
  queueMailboxSyncAction,
  updateMailboxAction
} from "./actions";

export const dynamic = "force-dynamic";

export default async function MailboxesPage() {
  const mailboxes = await getMailboxes();

  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Add Mailbox</h2>
        <form action={createMailboxAction} className="mt-4 grid gap-3 md:grid-cols-3">
          <Input name="email" placeholder="ops@example.com" required />
          <Input name="host" placeholder="imap.host.tld" required />
          <Input name="port" type="number" defaultValue={993} required />
          <Input name="username" placeholder="username" required />
          <Input name="password" type="password" placeholder="password / app password" required />
          <label className="flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-3.5 py-2 text-sm">
            <input name="secure" type="checkbox" defaultChecked />
            TLS/SSL
          </label>
          <div className="md:col-span-3">
            <Button type="submit">Save Mailbox</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {mailboxes.map((mailbox) => (
          <Card key={mailbox.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{mailbox.email}</h3>
                <p className="text-sm text-stone-600">
                  {mailbox.host}:{mailbox.port} - {mailbox.username}
                </p>
              </div>
              <Badge label={mailbox.status} tone={mailbox.status} />
            </div>
            <div className="text-xs text-stone-600">
              Last sync: {mailbox.lastSyncFinishedAt ? formatDistanceToNow(mailbox.lastSyncFinishedAt, { addSuffix: true }) : "Never"}
              <br />
              Last error: {mailbox.lastSyncError ?? "-"}
            </div>
            <form action={updateMailboxAction} className="grid gap-3 md:grid-cols-3">
              <input name="id" type="hidden" value={mailbox.id} />
              <Input name="email" defaultValue={mailbox.email} required />
              <Input name="host" defaultValue={mailbox.host} required />
              <Input name="port" type="number" defaultValue={mailbox.port} required />
              <Input name="username" defaultValue={mailbox.username} required />
              <Input name="password" type="password" placeholder="Leave blank to keep current" />
              <label className="flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-3.5 py-2 text-sm">
                <input name="secure" type="checkbox" defaultChecked={mailbox.secure} />
                TLS/SSL
              </label>
              <div className="md:col-span-3 flex gap-2">
                <Button type="submit" variant="outline">
                  Update
                </Button>
              </div>
            </form>
            <div className="flex gap-2">
              <form action={queueMailboxSyncAction}>
                <input name="id" type="hidden" value={mailbox.id} />
                <Button type="submit">Queue Sync</Button>
              </form>
              <form action={deleteMailboxAction}>
                <input name="id" type="hidden" value={mailbox.id} />
                <Button type="submit" variant="danger">
                  Delete
                </Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
