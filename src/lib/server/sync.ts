import { MailDirection, Prisma, SyncJobStatus, SyncRunStatus } from "../../generated/prisma/client";
import { randomUUID } from "node:crypto";

import { decryptSecret } from "./crypto";
import { env } from "./env";
import { createImapClient, type ImapMailboxClient } from "./mail";
import { prisma } from "@/lib/db/prisma";

type FolderPlan = {
  folderName: string;
  direction: MailDirection;
};

const FOLDERS: FolderPlan[] = [
  { folderName: "Inbox", direction: "incoming" },
  { folderName: "Sent", direction: "outgoing" }
];

type ClaimedSyncJob = {
  id: string;
  mailboxId: string;
};

type StaleReapResult = {
  reapedCount: number;
  retriedCount: number;
};

type SyncFolderResult = {
  processedCount: number;
  hasMore: boolean;
  maxUid: number;
};

type SyncMailboxResult = {
  needsContinuation: boolean;
  incomingCount: number;
  outgoingCount: number;
};

const MAX_SEARCHABLE_BODY_TEXT_CHARS = 250_000;

class SyncTimeoutError extends Error {
  code = "SYNC_TIMEOUT";
  command: string;

  constructor(command: string, timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = "SyncTimeoutError";
    this.command = command;
  }
}

class SyncCancelledError extends Error {
  code = "SYNC_CANCELLED";
  command = "sync-cancelled";

  constructor(reason = "reason=manual-stop") {
    super(`Sync job was cancelled (${reason})`);
    this.name = "SyncCancelledError";
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toErrorDetail(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function formatSyncError(error: unknown, context?: string): string {
  const message = error instanceof Error ? error.message : "Unknown sync failure";
  const details: string[] = [];

  if (error && typeof error === "object") {
    const source = error as Record<string, unknown>;
    const command = toErrorDetail(source.command);
    const code = toErrorDetail(source.code);
    const responseStatus = toErrorDetail(source.responseStatus);
    const responseCode = toErrorDetail(source.serverResponseCode);
    const responseText = toErrorDetail(source.responseText);

    if (command) {
      details.push(`command=${command}`);
    }
    if (code) {
      details.push(`code=${code}`);
    }
    if (responseStatus) {
      details.push(`imapStatus=${responseStatus}`);
    }
    if (responseCode) {
      details.push(`serverCode=${responseCode}`);
    }
    if (responseText) {
      details.push(`response=${responseText}`);
    }
  }

  const prefix = context ? `${context}: ` : "";
  if (details.length === 0) {
    return `${prefix}${message}`;
  }

  return `${prefix}${message} (${details.join(", ")})`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, command: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new SyncTimeoutError(command, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rss: formatBytes(usage.rss),
    heapUsed: formatBytes(usage.heapUsed),
    heapTotal: formatBytes(usage.heapTotal)
  };
}

function logSyncEvent(event: string, details: Record<string, unknown>) {
  console.info("[sync]", {
    event,
    at: new Date().toISOString(),
    ...details
  });
}

function buildSearchableBodyText(bodyText: string | null): string | null {
  if (!bodyText) {
    return null;
  }

  if (bodyText.length <= MAX_SEARCHABLE_BODY_TEXT_CHARS) {
    return bodyText;
  }

  return bodyText.slice(0, MAX_SEARCHABLE_BODY_TEXT_CHARS);
}

export async function queueMailboxSync(mailboxId: string, reason: string) {
  try {
    return await prisma.syncJob.create({
      data: {
        mailboxId,
        reason,
        status: "queued"
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }

    throw error;
  }
}

export async function scheduleQueuedSyncJobsForAllMailboxes() {
  const eligibleMailboxes = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT m.id
    FROM "Mailbox" m
    LEFT JOIN "SyncJob" j
      ON j."mailboxId" = m.id
      AND j.status IN ('queued'::"SyncJobStatus", 'running'::"SyncJobStatus")
    WHERE j.id IS NULL
  `;

  if (eligibleMailboxes.length === 0) {
    return 0;
  }

  const inserted = await prisma.syncJob.createMany({
    data: eligibleMailboxes.map((mailbox) => ({
      id: randomUUID(),
      mailboxId: mailbox.id,
      reason: "scheduled",
      status: "queued",
    })),
  });

  return inserted.count;
}

export async function reapStaleRunningJobs(now: Date = new Date()): Promise<StaleReapResult> {
  const cutoff = new Date(now.getTime() - env.SYNC_JOB_STALE_TIMEOUT_MS);

  const staleJobs = await prisma.syncJob.findMany({
    where: {
      status: "running",
      startedAt: { lte: cutoff }
    },
    select: {
      id: true,
      mailboxId: true,
      startedAt: true
    }
  });

  if (staleJobs.length === 0) {
    return { reapedCount: 0, retriedCount: 0 };
  }

  let reapedCount = 0;
  let retriedCount = 0;

  for (const staleJob of staleJobs) {
    const startedAt = staleJob.startedAt ?? cutoff;
    const ageMs = Math.max(now.getTime() - startedAt.getTime(), 0);
    const reason = `reason=stale-running-timeout age=${formatDurationMs(ageMs)}`;
    const staleMessage = `Sync job exceeded timeout window (${reason})`;

    const updated = await prisma.syncJob.updateMany({
      where: {
        id: staleJob.id,
        status: "running"
      },
      data: {
        status: "failed",
        finishedAt: now,
        error: staleMessage
      }
    });

    if (updated.count === 0) {
      continue;
    }

    reapedCount += 1;

    await prisma.syncRun.updateMany({
      where: {
        mailboxId: staleJob.mailboxId,
        status: "running",
        startedAt: { lte: cutoff }
      },
      data: {
        status: "error",
        finishedAt: now,
        errorMessage: staleMessage
      }
    });

    await prisma.mailbox.update({
      where: { id: staleJob.mailboxId },
      data: {
        status: "error",
        lastSyncFinishedAt: now,
        lastSyncError: staleMessage
      }
    });

    const retryJob = await queueMailboxSync(staleJob.mailboxId, "retry-stale-timeout");
    if (retryJob) {
      retriedCount += 1;
    }
  }

  return { reapedCount, retriedCount };
}

export async function claimNextQueuedSyncJob(): Promise<ClaimedSyncJob | null> {
  const claimed = await prisma.$queryRaw<ClaimedSyncJob[]>`
    WITH claim AS (
      SELECT id
      FROM "SyncJob"
      WHERE status = 'queued'::"SyncJobStatus"
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "SyncJob"
    SET status = 'running'::"SyncJobStatus", "startedAt" = NOW()
    WHERE id = (SELECT id FROM claim)
    RETURNING id, "mailboxId";
  `;

  return claimed[0] ?? null;
}

export async function processSyncQueue(options?: { createClient?: typeof createImapClient }) {
  const createClient = options?.createClient ?? createImapClient;

  const job = await claimNextQueuedSyncJob();

  if (!job) {
    return false;
  }

  try {
    await recordWorkerHeartbeat(`job-start mailbox=${job.mailboxId}`);
    logSyncEvent("job-start", {
      mailboxId: job.mailboxId,
      jobId: job.id,
      memory: getMemorySnapshot()
    });
    const result = await syncMailbox(job.mailboxId, createClient, { jobId: job.id });
    await prisma.syncJob.updateMany({
      where: { id: job.id, status: "running" },
      data: {
        status: "completed",
        finishedAt: new Date()
      }
    });
    if (result.needsContinuation) {
      await queueMailboxSync(job.mailboxId, "continue-batch");
    }
    await recordWorkerHeartbeat(
      `job-complete mailbox=${job.mailboxId} incoming=${result.incomingCount} outgoing=${result.outgoingCount} continuation=${result.needsContinuation}`
    );
    logSyncEvent("job-complete", {
      mailboxId: job.mailboxId,
      jobId: job.id,
      incoming: result.incomingCount,
      outgoing: result.outgoingCount,
      continuation: result.needsContinuation,
      memory: getMemorySnapshot()
    });
  } catch (error) {
    const message = formatSyncError(error, "Sync queue job failed");
    await prisma.syncJob.updateMany({
      where: { id: job.id, status: "running" },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error: message
      }
    });
    logSyncEvent("job-failed", {
      mailboxId: job.mailboxId,
      jobId: job.id,
      error: message,
      memory: getMemorySnapshot()
    });
  }

  return true;
}

export async function syncMailbox(
  mailboxId: string,
  createClient: typeof createImapClient = createImapClient,
  options?: { jobId?: string }
): Promise<SyncMailboxResult> {
  const mailbox = await prisma.mailbox.findUnique({ where: { id: mailboxId } });
  if (!mailbox) {
    throw new Error(`Mailbox ${mailboxId} not found`);
  }

  const run = await prisma.syncRun.create({
    data: {
      mailboxId,
      status: SyncRunStatus.running
    }
  });

  await prisma.mailbox.update({
    where: { id: mailboxId },
    data: {
      status: "syncing",
      lastSyncStartedAt: new Date(),
      lastSyncError: null
    }
  });

  let client: ImapMailboxClient | null = null;

  const ensureNotCancelled = async () => {
    if (!options?.jobId) {
      return;
    }

    const job = await prisma.syncJob.findUnique({
      where: { id: options.jobId },
      select: { status: true }
    });

    if (!job || job.status !== "running") {
      throw new SyncCancelledError();
    }
  };

  try {
    let password: string;
    try {
      password = decryptSecret(mailbox.encryptedPassword, env.APP_ENCRYPTION_KEY);
    } catch {
      throw new Error(
        "Unable to decrypt mailbox password. Check APP_ENCRYPTION_KEY consistency across web and worker, then re-save mailbox credentials."
      );
    }

    client = await withTimeout(
      createClient({
        host: mailbox.host,
        port: mailbox.port,
        secure: mailbox.secure,
        username: mailbox.username,
        password,
        commandTimeoutMs: env.IMAP_COMMAND_TIMEOUT_MS
      }),
      env.IMAP_COMMAND_TIMEOUT_MS,
      "imap-connect"
    );

    let incomingCount = 0;
    let outgoingCount = 0;
    let needsContinuation = false;

    for (const folder of FOLDERS) {
      await ensureNotCancelled();
      const result = await syncFolder(mailboxId, folder, client);
      if (folder.direction === "incoming") {
        incomingCount += result.processedCount;
      } else {
        outgoingCount += result.processedCount;
      }
      needsContinuation = needsContinuation || result.hasMore;
    }

    await ensureNotCancelled();

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.ok,
        finishedAt: new Date(),
        incomingCount,
        outgoingCount,
        errorMessage: null
      }
    });

    await prisma.mailbox.update({
      where: { id: mailboxId },
      data: {
        status: "ok",
        lastSyncFinishedAt: new Date(),
        lastSyncError: null
      }
    });

    if (needsContinuation && !options?.jobId) {
      await queueMailboxSync(mailboxId, "continue-batch");
    }

    return {
      needsContinuation,
      incomingCount,
      outgoingCount,
    };
  } catch (error) {
    const message = formatSyncError(error, `Mailbox sync failed for ${mailbox.email}`);
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.error,
        finishedAt: new Date(),
        errorMessage: message
      }
    });
    await prisma.mailbox.update({
      where: { id: mailboxId },
      data: {
        status: "error",
        lastSyncFinishedAt: new Date(),
        lastSyncError: message
      }
    });
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function syncFolder(mailboxId: string, folder: FolderPlan, client: ImapMailboxClient): Promise<SyncFolderResult> {
  const cursor = await prisma.syncCursor.findUnique({
    where: {
      mailboxId_folderName: {
        mailboxId,
        folderName: folder.folderName
      }
    }
  });

  const lastUid = cursor?.lastUid ?? 0;
  let batch;
  const fetchStartedAt = Date.now();
  logSyncEvent("folder-fetch-start", {
    mailboxId,
    folder: folder.folderName,
    lastUid,
    batchSize: env.IMAP_SYNC_BATCH_SIZE,
    memory: getMemorySnapshot()
  });
  await recordWorkerHeartbeat(`fetching mailbox=${mailboxId} folder=${folder.folderName} lastUid=${lastUid}`);
  const fetchHeartbeatInterval = setInterval(() => {
    void recordWorkerHeartbeat(`fetch-wait mailbox=${mailboxId} folder=${folder.folderName} lastUid=${lastUid}`);
  }, 30_000);
  try {
    batch = await client.listMessages(folder.folderName, lastUid, env.IMAP_SYNC_BATCH_SIZE);
  } catch (error) {
    throw new Error(formatSyncError(error, `Folder ${folder.folderName}`));
  } finally {
    clearInterval(fetchHeartbeatInterval);
  }
  logSyncEvent("folder-fetch-complete", {
    mailboxId,
    folder: folder.folderName,
    lastUid,
    fetched: batch.messages.length,
    hasMore: batch.hasMore,
    nextCursorUid: batch.nextCursorUid,
    durationMs: Date.now() - fetchStartedAt,
    memory: getMemorySnapshot()
  });
  await recordWorkerHeartbeat(
    `fetched mailbox=${mailboxId} folder=${folder.folderName} count=${batch.messages.length} nextUid=${batch.nextCursorUid}`
  );

  for (let index = 0; index < batch.messages.length; index += 1) {
    const message = batch.messages[index];
    const messageStartedAt = Date.now();
    const bodyTextSearch = buildSearchableBodyText(message.bodyText);
    const storedMessage = await prisma.message.upsert({
      where: {
        mailboxId_folderName_externalUid: {
          mailboxId,
          folderName: folder.folderName,
          externalUid: message.uid
        }
      },
      update: {
        messageId: message.messageId,
        direction: folder.direction,
        fromJson: toJson(message.from),
        toJson: toJson(message.to),
        ccJson: toJson(message.cc),
        bccJson: toJson(message.bcc),
        subject: message.subject,
        sentAt: message.sentAt ? new Date(message.sentAt) : null,
        receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
        snippet: message.snippet,
        bodyText: message.bodyText,
        bodyTextSearch,
        bodyHtml: message.bodyHtml,
        syncedAt: new Date()
      },
      create: {
        mailboxId,
        folderName: folder.folderName,
        externalUid: message.uid,
        messageId: message.messageId,
        direction: folder.direction,
        fromJson: toJson(message.from),
        toJson: toJson(message.to),
        ccJson: toJson(message.cc),
        bccJson: toJson(message.bcc),
        subject: message.subject,
        sentAt: message.sentAt ? new Date(message.sentAt) : null,
        receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
        snippet: message.snippet,
        bodyText: message.bodyText,
        bodyTextSearch,
        bodyHtml: message.bodyHtml
      }
    });

    await recordWorkerHeartbeat(
      `syncing mailbox=${mailboxId} folder=${folder.folderName} uid=${message.uid}`
    );

    await prisma.attachment.deleteMany({
      where: { messageId: storedMessage.id }
    });

    if (message.attachments.length > 0) {
      await prisma.attachment.createMany({
        data: message.attachments.map((attachment) => ({
          messageId: storedMessage.id,
          filename: attachment.filename,
          contentType: attachment.contentType,
          contentDisposition: attachment.contentDisposition,
          contentId: attachment.contentId,
          partId: attachment.partId,
          size: attachment.size,
          isInline: attachment.isInline
        }))
      });
    }

    logSyncEvent("message-persist-complete", {
      mailboxId,
      folder: folder.folderName,
      uid: message.uid,
      position: `${index + 1}/${batch.messages.length}`,
      attachments: message.attachments.length,
      durationMs: Date.now() - messageStartedAt,
      memory: getMemorySnapshot()
    });
  }

  if (batch.nextCursorUid > lastUid) {
    await prisma.syncCursor.upsert({
      where: {
        mailboxId_folderName: {
          mailboxId,
          folderName: folder.folderName
        }
      },
      update: {
        lastUid: batch.nextCursorUid
      },
      create: {
        mailboxId,
        folderName: folder.folderName,
        lastUid: batch.nextCursorUid
      }
    });
  }

  return {
    processedCount: batch.messages.length,
    hasMore: batch.hasMore,
    maxUid: batch.nextCursorUid,
  };
}

export async function recordWorkerHeartbeat(currentState: string) {
  await prisma.workerHeartbeat.upsert({
    where: { id: "primary" },
    update: {
      currentState,
      lastSeenAt: new Date()
    },
    create: {
      id: "primary",
      currentState,
      lastSeenAt: new Date()
    }
  });
}

export async function stopRunningSyncJob(jobId: string) {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
    select: { id: true, mailboxId: true, status: true }
  });

  if (!job || job.status !== "running") {
    return { stopped: false as const };
  }

  const now = new Date();
  const stopMessage = "Stopped by admin (reason=manual-stop)";

  const updated = await prisma.syncJob.updateMany({
    where: {
      id: job.id,
      status: "running"
    },
    data: {
      status: "failed",
      finishedAt: now,
      error: stopMessage
    }
  });

  if (updated.count === 0) {
    return { stopped: false as const };
  }

  await prisma.syncRun.updateMany({
    where: {
      mailboxId: job.mailboxId,
      status: "running"
    },
    data: {
      status: "error",
      finishedAt: now,
      errorMessage: stopMessage
    }
  });

  await prisma.mailbox.update({
    where: { id: job.mailboxId },
    data: {
      status: "error",
      lastSyncFinishedAt: now,
      lastSyncError: stopMessage
    }
  });

  return { stopped: true as const, mailboxId: job.mailboxId };
}

export function mapJobStatusToSyncState(status: SyncJobStatus): "queued" | "running" | "done" {
  if (status === "queued") {
    return "queued";
  }

  if (status === "running") {
    return "running";
  }

  return "done";
}
