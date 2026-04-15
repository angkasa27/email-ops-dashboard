import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSystemStatus } from "@/lib/server/data";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const data = await getSystemStatus();

  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Worker Health</h2>
        <p className="mt-2 text-sm text-stone-700">
          Last heartbeat: {data.heartbeat ? formatDistanceToNow(data.heartbeat.lastSeenAt, { addSuffix: true }) : "No heartbeat yet"}
        </p>
        <p className="mt-1 text-sm text-stone-700">Current state: {data.heartbeat?.currentState ?? "unknown"}</p>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">Recent Sync Jobs</h2>
        <div className="mt-4 space-y-2">
          {data.jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-stone-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{job.mailbox.email}</span>
                <Badge
                  label={job.status}
                  tone={job.status === "failed" ? "error" : job.status === "running" ? "syncing" : "ok"}
                />
              </div>
              <p className="mt-1 text-xs text-stone-600">
                {job.reason} · {formatDistanceToNow(job.createdAt, { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
