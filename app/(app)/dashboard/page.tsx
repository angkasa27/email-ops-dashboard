import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, Inbox, Mail, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getDashboardData, normalizeMailboxStatus } from "@/lib/server/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <Card className="grid gap-4 md:grid-cols-4">
        <StatCard label="Mailboxes" value={String(data.summary.mailboxCount)} icon={<Mail className="h-4 w-4" />} />
        <StatCard label="Incoming (recent)" value={String(data.summary.incomingCount)} icon={<Inbox className="h-4 w-4" />} />
        <StatCard label="Failed Sync Runs" value={String(data.summary.failedSyncRuns)} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard
          label="Latest Activity"
          value={data.summary.latestActivityAt ? formatDistanceToNow(data.summary.latestActivityAt, { addSuffix: true }) : "No activity"}
          icon={<Activity className="h-4 w-4" />}
        />
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2 text-sm text-stone-600">
          <RefreshCw className="h-4 w-4" />
          Worker heartbeat: {data.heartbeat ? formatDistanceToNow(data.heartbeat.lastSeenAt, { addSuffix: true }) : "No heartbeat yet"}
        </div>
        <h2 className="mb-3 text-xl font-semibold">Mailbox Health</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.mailboxSnapshots.map((mailbox) => (
            <div key={mailbox.id} className="rounded-2xl border border-stone-200 p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{mailbox.email}</h3>
                <Badge label={mailbox.status} tone={mailbox.status} />
              </div>
              <p className="mt-2 text-xs text-stone-600">{mailbox.host}:{mailbox.port}</p>
              <p className="mt-2 text-xs text-stone-600">State: {normalizeMailboxStatus(mailbox.status)}</p>
              <p className="mt-2 text-xs text-stone-600">Last error: {mailbox.lastSyncError ?? "-"}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-stone-600">
        <span>{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}
