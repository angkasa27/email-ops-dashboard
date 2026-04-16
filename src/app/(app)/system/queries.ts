import { prisma } from "@/lib/db/prisma";
import { SystemData, SystemJobRow, SystemRunRow } from "./_components/types";

function serializeJobRows(rows: Array<{
  id: string;
  status: SystemJobRow["status"];
  reason: string;
  error: string | null;
  createdAt: Date;
  mailbox: { email: string };
}>): SystemJobRow[] {
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString()
  }));
}

function serializeRunRows(rows: Array<{
  id: string;
  status: SystemRunRow["status"];
  startedAt: Date;
  finishedAt: Date | null;
  incomingCount: number;
  outgoingCount: number;
  errorMessage: string | null;
  mailbox: { email: string };
}>): SystemRunRow[] {
  return rows.map((row) => ({
    ...row,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null
  }));
}

export async function getSystemStatus(): Promise<SystemData> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    heartbeat,
    jobs,
    runs,
    queuedJobs,
    runningJobs,
    failedJobs24h,
    failedRuns24h,
    mailboxes
  ] = await Promise.all([
    prisma.workerHeartbeat.findUnique({ where: { id: "primary" } }),
    prisma.syncJob.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        reason: true,
        error: true,
        createdAt: true,
        mailbox: {
          select: {
            email: true
          }
        }
      }
    }),
    prisma.syncRun.findMany({
      take: 50,
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        incomingCount: true,
        outgoingCount: true,
        errorMessage: true,
        mailbox: {
          select: {
            email: true
          }
        }
      }
    }),
    prisma.syncJob.count({ where: { status: "queued" } }),
    prisma.syncJob.count({ where: { status: "running" } }),
    prisma.syncJob.count({
      where: { status: "failed", createdAt: { gte: twentyFourHoursAgo } }
    }),
    prisma.syncRun.count({
      where: { status: "error", startedAt: { gte: twentyFourHoursAgo } }
    }),
    prisma.mailbox.findMany({
      select: { id: true, email: true },
      orderBy: { email: "asc" }
    })
  ]);

  return {
    heartbeat: heartbeat
      ? {
          ...heartbeat,
          lastSeenAt: heartbeat.lastSeenAt.toISOString()
        }
      : null,
    jobs: serializeJobRows(jobs),
    runs: serializeRunRows(runs),
    metrics: {
      queuedJobs,
      runningJobs,
      failedJobs24h,
      failedRuns24h
    },
    mailboxes
  };
}

export async function countEventsVersion() {
  const [jobCount, messageCount, runCount] = await Promise.all([
    prisma.syncJob.count(),
    prisma.message.count(),
    prisma.syncRun.count()
  ]);

  return `${jobCount}-${messageCount}-${runCount}`;
}
