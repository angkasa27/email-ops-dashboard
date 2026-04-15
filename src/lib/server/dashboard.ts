import { MailDirection, MailboxStatus, SyncRunStatus } from "../../generated/prisma/client";

type DashboardSummaryInput = {
  mailboxes: Array<{
    id: string;
    status: MailboxStatus;
    lastSyncFinishedAt: Date | null;
  }>;
  recentMessages: Array<{
    direction: MailDirection;
    receivedAt: Date | null;
    syncedAt: Date;
  }>;
  syncRuns: Array<{
    status: SyncRunStatus;
  }>;
};

export function buildDashboardSummary(input: DashboardSummaryInput) {
  const latestActivity = input.recentMessages.reduce<Date | null>((latest, message) => {
    const candidate = message.receivedAt ?? message.syncedAt;
    if (!latest || candidate > latest) {
      return candidate;
    }

    return latest;
  }, null);

  return {
    mailboxCount: input.mailboxes.length,
    healthyMailboxCount: input.mailboxes.filter((mailbox) => mailbox.status === "ok").length,
    failingMailboxCount: input.mailboxes.filter((mailbox) => mailbox.status === "error").length,
    incomingCount: input.recentMessages.filter((message) => message.direction === "incoming").length,
    outgoingCount: input.recentMessages.filter((message) => message.direction === "outgoing").length,
    failedSyncRuns: input.syncRuns.filter((run) => run.status === "error").length,
    latestActivityAt: latestActivity
  };
}
