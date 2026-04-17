import { NextResponse } from "next/server";
import { SyncJobStatus, SyncRunStatus } from "@/generated/prisma/client";
import { getSession } from "@/lib/server/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function parseJobStatus(value: string | null): SyncJobStatus | undefined {
  if (!value || value === "all") {
    return undefined;
  }
  if (value === "queued" || value === "running" || value === "completed" || value === "failed") {
    return value;
  }
  return undefined;
}

function parseRunStatus(value: string | null): SyncRunStatus | undefined {
  if (!value || value === "all") {
    return undefined;
  }
  if (value === "running" || value === "ok" || value === "error") {
    return value;
  }
  return undefined;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mailboxId = searchParams.get("mailboxId") || undefined;
    const jobStatus = parseJobStatus(searchParams.get("jobStatus"));
    const runStatus = parseRunStatus(searchParams.get("runStatus"));

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      heartbeat,
      queuedJobsCount,
      runningJobsCount,
      failedJobs24h,
      failedRuns24h,
      jobs,
      runs,
      mailboxes,
    ] = await Promise.all([
      prisma.workerHeartbeat.findUnique({ where: { id: "primary" } }),
      prisma.syncJob.count({ where: { status: "queued" } }),
      prisma.syncJob.count({ where: { status: "running" } }),
      prisma.syncJob.count({
        where: { status: "failed", createdAt: { gte: twentyFourHoursAgo } },
      }),
      prisma.syncRun.count({
        where: { status: "error", startedAt: { gte: twentyFourHoursAgo } },
      }),
      prisma.syncJob.findMany({
        take: 50,
        where: {
          mailboxId: mailboxId === "all" ? undefined : mailboxId,
          status: jobStatus,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          reason: true,
          error: true,
          createdAt: true,
          mailbox: { select: { id: true, email: true } },
        },
      }),
      prisma.syncRun.findMany({
        take: 50,
        where: {
          mailboxId: mailboxId === "all" ? undefined : mailboxId,
          status: runStatus,
        },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          incomingCount: true,
          outgoingCount: true,
          errorMessage: true,
          mailbox: { select: { id: true, email: true } },
        },
      }),
      prisma.mailbox.findMany({
        select: { id: true, email: true },
        orderBy: { email: "asc" },
      }),
    ]);

    return NextResponse.json({
      heartbeat,
      metrics: {
        queuedJobs: queuedJobsCount,
        runningJobs: runningJobsCount,
        failedJobs24h,
        failedRuns24h,
      },
      jobs,
      runs,
      mailboxes,
    });
  } catch (error) {
    console.error("Failed to fetch system data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
