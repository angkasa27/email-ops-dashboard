import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = process.env;

const prisma = {
  $queryRaw: vi.fn(),
  syncJob: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  syncRun: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mailbox: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  syncCursor: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  workerHeartbeat: {
    upsert: vi.fn(),
  },
  attachment: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  message: {
    upsert: vi.fn(),
  },
};

const decryptSecret = vi.fn(() => "decrypted-password");

vi.mock("@/lib/db/prisma", () => ({
  prisma,
}));

vi.mock("../src/lib/server/crypto", () => ({
  decryptSecret,
}));

function applyEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/monitor_email_test",
    APP_ENCRYPTION_KEY: "placeholderEncryptionKey12345678901234567890",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "placeholder-password",
    SESSION_SECRET: "placeholderSecret123",
    SYNC_POLL_INTERVAL_MS: "60000",
    EVENTS_POLL_INTERVAL_MS: "3000",
    SYNC_JOB_STALE_TIMEOUT_MS: "600000",
    IMAP_COMMAND_TIMEOUT_MS: "120000",
    IMAP_SYNC_BATCH_SIZE: "100",
    ...overrides,
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    }
  }
}

async function importSyncModule(overrides: Record<string, string | undefined> = {}) {
  applyEnv(overrides);
  vi.resetModules();
  return await import("../src/lib/server/sync");
}

function createMailboxRecord() {
  return {
    id: "mailbox-1",
    email: "karin@dwipatelco.co.id",
    host: "mail.example.com",
    port: 993,
    secure: true,
    username: "karin",
    encryptedPassword: "encrypted-password",
  };
}

function createSyncMessage(uid: number) {
  return {
    uid,
    messageId: `<message-${uid}@example.com>`,
    subject: `Subject ${uid}`,
    sentAt: "2026-04-17T00:00:00.000Z",
    receivedAt: "2026-04-17T00:00:00.000Z",
    snippet: `Snippet ${uid}`,
    bodyText: `Body ${uid}`,
    bodyHtml: `<p>Body ${uid}</p>`,
    from: [{ name: "Sender", address: "sender@example.com" }],
    to: [{ name: "Receiver", address: "receiver@example.com" }],
    cc: [],
    bcc: [],
    attachments: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$queryRaw.mockReset();
  prisma.syncJob.create.mockReset();
  prisma.syncJob.createMany.mockReset();
  prisma.syncJob.findMany.mockReset();
  prisma.syncJob.findUnique.mockReset();
  prisma.syncJob.update.mockReset();
  prisma.syncJob.updateMany.mockReset();
  prisma.syncRun.create.mockReset();
  prisma.syncRun.update.mockReset();
  prisma.syncRun.updateMany.mockReset();
  prisma.mailbox.findUnique.mockReset();
  prisma.mailbox.update.mockReset();
  prisma.syncCursor.findUnique.mockReset();
  prisma.syncCursor.upsert.mockReset();
  prisma.workerHeartbeat.upsert.mockReset();
  prisma.attachment.deleteMany.mockReset();
  prisma.attachment.createMany.mockReset();
  prisma.message.upsert.mockReset();
  decryptSecret.mockReset();
  decryptSecret.mockReturnValue("decrypted-password");
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("sync queue", () => {
  test("claimNextQueuedSyncJob atomically claims one queued job", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: "job-1", mailboxId: "mailbox-1" }]);

    const { claimNextQueuedSyncJob } = await importSyncModule();
    const claimed = await claimNextQueuedSyncJob();

    expect(claimed).toEqual({ id: "job-1", mailboxId: "mailbox-1" });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test("queueMailboxSync ignores duplicate active-job constraint", async () => {
    prisma.syncJob.create.mockRejectedValueOnce({ code: "P2002" });
    const { queueMailboxSync } = await importSyncModule();

    await expect(queueMailboxSync("mailbox-1", "scheduled")).resolves.toBeNull();
  });

  test("scheduleQueuedSyncJobsForAllMailboxes batches inserts", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: "mailbox-1" }, { id: "mailbox-2" }]);
    prisma.syncJob.createMany.mockResolvedValueOnce({ count: 2 });

    const { scheduleQueuedSyncJobsForAllMailboxes } = await importSyncModule();
    const inserted = await scheduleQueuedSyncJobsForAllMailboxes();

    expect(inserted).toBe(2);
    expect(prisma.syncJob.createMany).toHaveBeenCalledTimes(1);
  });

  test("reapStaleRunningJobs ignores fresh running jobs", async () => {
    prisma.syncJob.findMany.mockResolvedValueOnce([]);

    const { reapStaleRunningJobs } = await importSyncModule();
    const result = await reapStaleRunningJobs(new Date("2026-04-16T00:10:00.000Z"));

    expect(result).toEqual({ reapedCount: 0, retriedCount: 0 });
    expect(prisma.syncJob.updateMany).not.toHaveBeenCalled();
    expect(prisma.syncJob.create).not.toHaveBeenCalled();
  });

  test("reapStaleRunningJobs marks stale running as failed and requeues once", async () => {
    prisma.syncJob.findMany.mockResolvedValueOnce([
      {
        id: "job-running-1",
        mailboxId: "mailbox-1",
        startedAt: new Date("2026-04-16T00:00:00.000Z"),
      },
    ]);
    prisma.syncJob.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.syncRun.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.mailbox.update.mockResolvedValueOnce({});
    prisma.syncJob.create.mockResolvedValueOnce({ id: "job-retry-1" });

    const { reapStaleRunningJobs } = await importSyncModule();
    const result = await reapStaleRunningJobs(new Date("2026-04-16T00:20:00.000Z"));

    expect(result).toEqual({ reapedCount: 1, retriedCount: 1 });
    expect(prisma.syncJob.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.syncRun.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.mailbox.update).toHaveBeenCalledTimes(1);
    expect(prisma.syncJob.create).toHaveBeenCalledWith({
      data: {
        mailboxId: "mailbox-1",
        reason: "retry-stale-timeout",
        status: "queued",
      },
    });
  });

  test("syncMailbox batches a large first sync and queues continuation work", async () => {
    prisma.mailbox.findUnique.mockResolvedValueOnce(createMailboxRecord());
    prisma.syncRun.create.mockResolvedValueOnce({ id: "run-1" });
    prisma.mailbox.update.mockResolvedValue({});
    prisma.syncCursor.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.message.upsert.mockResolvedValue({ id: "message-1" });
    prisma.syncCursor.upsert.mockResolvedValue({});
    prisma.syncRun.update.mockResolvedValue({});
    prisma.syncJob.create.mockResolvedValueOnce({ id: "job-continue-1" });

    const listMessages = vi
      .fn()
      .mockResolvedValueOnce({
        messages: [createSyncMessage(1), createSyncMessage(2)],
        hasMore: true,
        nextCursorUid: 2,
      })
      .mockResolvedValueOnce({
        messages: [],
        hasMore: false,
        nextCursorUid: 0,
      });

    const createClient = vi.fn(async () => ({
      listMessages,
      close: vi.fn(async () => undefined),
    }));

    const { syncMailbox } = await importSyncModule({ IMAP_SYNC_BATCH_SIZE: "2" });
    await syncMailbox("mailbox-1", createClient);

    expect(listMessages).toHaveBeenNthCalledWith(1, "Inbox", 0, 2);
    expect(listMessages).toHaveBeenNthCalledWith(2, "Sent", 0, 2);
    expect(prisma.message.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.syncCursor.upsert).toHaveBeenCalledWith({
      where: {
        mailboxId_folderName: {
          mailboxId: "mailbox-1",
          folderName: "Inbox",
        },
      },
      update: {
        lastUid: 2,
      },
      create: {
        mailboxId: "mailbox-1",
        folderName: "Inbox",
        lastUid: 2,
      },
    });
    expect(prisma.syncJob.create).toHaveBeenCalledWith({
      data: {
        mailboxId: "mailbox-1",
        reason: "continue-batch",
        status: "queued",
      },
    });
    expect(prisma.syncRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "ok",
        incomingCount: 2,
        outgoingCount: 0,
        errorMessage: null,
      }),
    });
    expect(prisma.mailbox.update).toHaveBeenLastCalledWith({
      where: { id: "mailbox-1" },
      data: expect.objectContaining({
        status: "ok",
        lastSyncError: null,
      }),
    });
  });

  test("syncMailbox resumes from the stored cursor on the next batch", async () => {
    prisma.mailbox.findUnique.mockResolvedValue(createMailboxRecord());
    prisma.syncRun.create.mockResolvedValue({ id: "run-1" });
    prisma.mailbox.update.mockResolvedValue({});
    prisma.message.upsert.mockResolvedValue({ id: "message-1" });
    prisma.syncCursor.upsert.mockResolvedValue({});
    prisma.syncRun.update.mockResolvedValue({});
    prisma.syncJob.create.mockResolvedValueOnce({ id: "job-continue-1" });
    prisma.syncCursor.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lastUid: 2 })
      .mockResolvedValueOnce(null);

    const listMessages = vi
      .fn()
      .mockResolvedValueOnce({
        messages: [createSyncMessage(1), createSyncMessage(2)],
        hasMore: true,
        nextCursorUid: 2,
      })
      .mockResolvedValueOnce({
        messages: [],
        hasMore: false,
        nextCursorUid: 0,
      })
      .mockResolvedValueOnce({
        messages: [createSyncMessage(3)],
        hasMore: false,
        nextCursorUid: 3,
      })
      .mockResolvedValueOnce({
        messages: [],
        hasMore: false,
        nextCursorUid: 0,
      });

    const createClient = vi.fn(async () => ({
      listMessages,
      close: vi.fn(async () => undefined),
    }));

    const { syncMailbox } = await importSyncModule({ IMAP_SYNC_BATCH_SIZE: "2" });

    await syncMailbox("mailbox-1", createClient);
    await syncMailbox("mailbox-1", createClient);

    expect(listMessages).toHaveBeenNthCalledWith(1, "Inbox", 0, 2);
    expect(listMessages).toHaveBeenNthCalledWith(3, "Inbox", 2, 2);
    expect(prisma.syncJob.create).toHaveBeenCalledTimes(1);
  });

  test("processSyncQueue records timeout failures with timeout details", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: "job-1", mailboxId: "mailbox-1" }]);
    prisma.mailbox.findUnique.mockResolvedValueOnce(createMailboxRecord());
    prisma.syncRun.create.mockResolvedValueOnce({ id: "run-1" });
    prisma.mailbox.update.mockResolvedValue({});
    prisma.syncRun.update.mockResolvedValue({});
    prisma.syncJob.updateMany.mockResolvedValue({});

    const timeoutError = Object.assign(new Error("Operation timed out after 120000ms"), {
      command: "imap-fetch-range-Inbox",
      code: "SYNC_TIMEOUT",
    });

    const createClient = vi.fn(async () => {
      throw timeoutError;
    });

    const { processSyncQueue } = await importSyncModule();
    await expect(processSyncQueue({ createClient })).resolves.toBe(true);

    expect(prisma.syncRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "error",
        errorMessage: expect.stringContaining("code=SYNC_TIMEOUT"),
      }),
    });
    expect(prisma.syncJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: "job-1", status: "running" },
      data: expect.objectContaining({
        status: "failed",
        error: expect.stringContaining("command=imap-fetch-range-Inbox"),
      }),
    });
  });

  test("syncMailbox refreshes attachment metadata for synced messages", async () => {
    prisma.mailbox.findUnique.mockResolvedValueOnce(createMailboxRecord());
    prisma.syncRun.create.mockResolvedValueOnce({ id: "run-1" });
    prisma.mailbox.update.mockResolvedValue({});
    prisma.syncCursor.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.message.upsert.mockResolvedValueOnce({ id: "message-1" });
    prisma.syncCursor.upsert.mockResolvedValue({});
    prisma.syncRun.update.mockResolvedValue({});

    const listMessages = vi
      .fn()
      .mockResolvedValueOnce({
        messages: [
          {
            ...createSyncMessage(1),
            attachments: [
              {
                filename: "invoice.pdf",
                contentType: "application/pdf",
                contentDisposition: "attachment",
                contentId: null,
                partId: "2",
                size: 24576,
                isInline: false,
              },
              {
                filename: "logo.png",
                contentType: "image/png",
                contentDisposition: "inline",
                contentId: "logo@example.com",
                partId: "1.2",
                size: 4096,
                isInline: true,
              },
            ],
          },
        ],
        hasMore: false,
        nextCursorUid: 1,
      })
      .mockResolvedValueOnce({
        messages: [],
        hasMore: false,
        nextCursorUid: 0,
      });

    const createClient = vi.fn(async () => ({
      listMessages,
      close: vi.fn(async () => undefined),
    }));

    const { syncMailbox } = await importSyncModule();
    await syncMailbox("mailbox-1", createClient);

    expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({
      where: { messageId: "message-1" },
    });
    expect(prisma.attachment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          messageId: "message-1",
          filename: "invoice.pdf",
          isInline: false,
        }),
        expect.objectContaining({
          messageId: "message-1",
          filename: "logo.png",
          isInline: true,
        }),
      ],
    });
  });

  test("syncMailbox records heartbeat progress while processing messages", async () => {
    prisma.mailbox.findUnique.mockResolvedValueOnce(createMailboxRecord());
    prisma.syncJob.findUnique.mockResolvedValue({ status: "running" });
    prisma.syncRun.create.mockResolvedValueOnce({ id: "run-1" });
    prisma.mailbox.update.mockResolvedValue({});
    prisma.syncCursor.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.message.upsert.mockResolvedValue({ id: "message-1" });
    prisma.syncCursor.upsert.mockResolvedValue({});
    prisma.syncRun.update.mockResolvedValue({});

    const listMessages = vi
      .fn()
      .mockResolvedValueOnce({
        messages: [createSyncMessage(1)],
        hasMore: false,
        nextCursorUid: 1,
      })
      .mockResolvedValueOnce({
        messages: [],
        hasMore: false,
        nextCursorUid: 0,
      });

    const createClient = vi.fn(async () => ({
      listMessages,
      close: vi.fn(async () => undefined),
    }));

    const { syncMailbox } = await importSyncModule();
    await syncMailbox("mailbox-1", createClient, { jobId: "job-1" });

    expect(prisma.workerHeartbeat.upsert).toHaveBeenCalledWith({
      where: { id: "primary" },
      update: expect.objectContaining({
        currentState: expect.stringContaining("syncing mailbox=mailbox-1 folder=Inbox"),
      }),
      create: expect.objectContaining({
        id: "primary",
        currentState: expect.stringContaining("syncing mailbox=mailbox-1 folder=Inbox"),
      }),
    });
  });

  test("syncMailbox stores a capped search body while preserving the full plain-text body", async () => {
    prisma.mailbox.findUnique.mockResolvedValueOnce(createMailboxRecord());
    prisma.syncRun.create.mockResolvedValueOnce({ id: "run-1" });
    prisma.mailbox.update.mockResolvedValue({});
    prisma.syncCursor.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.message.upsert.mockResolvedValue({ id: "message-1" });
    prisma.syncCursor.upsert.mockResolvedValue({});
    prisma.syncRun.update.mockResolvedValue({});

    const largeBody = "A".repeat(300_000);
    const listMessages = vi
      .fn()
      .mockResolvedValueOnce({
        messages: [
          {
            ...createSyncMessage(1),
            bodyText: largeBody,
          },
        ],
        hasMore: false,
        nextCursorUid: 1,
      })
      .mockResolvedValueOnce({
        messages: [],
        hasMore: false,
        nextCursorUid: 0,
      });

    const createClient = vi.fn(async () => ({
      listMessages,
      close: vi.fn(async () => undefined),
    }));

    const { syncMailbox } = await importSyncModule();
    await syncMailbox("mailbox-1", createClient);

    expect(prisma.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          bodyText: largeBody,
          bodyTextSearch: largeBody.slice(0, 250_000),
        }),
        create: expect.objectContaining({
          bodyText: largeBody,
          bodyTextSearch: largeBody.slice(0, 250_000),
        }),
      }),
    );
  });

  test("syncMailbox logs folder fetch lifecycle for debugging", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    prisma.mailbox.findUnique.mockResolvedValueOnce(createMailboxRecord());
    prisma.syncRun.create.mockResolvedValueOnce({ id: "run-1" });
    prisma.mailbox.update.mockResolvedValue({});
    prisma.syncCursor.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.message.upsert.mockResolvedValue({ id: "message-1" });
    prisma.syncCursor.upsert.mockResolvedValue({});
    prisma.syncRun.update.mockResolvedValue({});

    const listMessages = vi
      .fn()
      .mockResolvedValueOnce({
        messages: [createSyncMessage(1)],
        hasMore: false,
        nextCursorUid: 1,
      })
      .mockResolvedValueOnce({
        messages: [],
        hasMore: false,
        nextCursorUid: 0,
      });

    const createClient = vi.fn(async () => ({
      listMessages,
      close: vi.fn(async () => undefined),
    }));

    const { syncMailbox } = await importSyncModule();
    await syncMailbox("mailbox-1", createClient);

    expect(infoSpy).toHaveBeenCalledWith(
      "[sync]",
      expect.objectContaining({
        event: "folder-fetch-start",
        mailboxId: "mailbox-1",
        folder: "Inbox",
        lastUid: 0,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[sync]",
      expect.objectContaining({
        event: "folder-fetch-complete",
        mailboxId: "mailbox-1",
        folder: "Inbox",
        fetched: 1,
        hasMore: false,
        nextCursorUid: 1,
      }),
    );
  });

  test("syncMailbox keeps heartbeat alive while waiting for folder fetch", async () => {
    vi.useFakeTimers();

    try {
      prisma.mailbox.findUnique.mockResolvedValueOnce(createMailboxRecord());
      prisma.syncJob.findUnique.mockResolvedValue({ status: "running" });
      prisma.syncRun.create.mockResolvedValueOnce({ id: "run-1" });
      prisma.mailbox.update.mockResolvedValue({});
      prisma.syncCursor.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.message.upsert.mockResolvedValue({ id: "message-1" });
      prisma.syncCursor.upsert.mockResolvedValue({});
      prisma.syncRun.update.mockResolvedValue({});

      let resolveInboxFetch: ((value: unknown) => void) | null = null;

      const listMessages = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveInboxFetch = resolve;
            }),
        )
        .mockResolvedValueOnce({
          messages: [],
          hasMore: false,
          nextCursorUid: 0,
        });

      const createClient = vi.fn(async () => ({
        listMessages,
        close: vi.fn(async () => undefined),
      }));

      const { syncMailbox } = await importSyncModule();
      const pending = syncMailbox("mailbox-1", createClient, { jobId: "job-1" });

      await vi.advanceTimersByTimeAsync(30_000);

      expect(prisma.workerHeartbeat.upsert).toHaveBeenCalledWith({
        where: { id: "primary" },
        update: expect.objectContaining({
          currentState: expect.stringContaining("fetch-wait mailbox=mailbox-1 folder=Inbox"),
        }),
        create: expect.objectContaining({
          id: "primary",
          currentState: expect.stringContaining("fetch-wait mailbox=mailbox-1 folder=Inbox"),
        }),
      });

      resolveInboxFetch?.({
        messages: [],
        hasMore: false,
        nextCursorUid: 0,
      });

      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  test("stopRunningSyncJob marks running job failed", async () => {
    prisma.syncJob.findUnique.mockResolvedValueOnce({
      id: "job-running-1",
      mailboxId: "mailbox-1",
      status: "running",
    });
    prisma.syncJob.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.syncRun.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.mailbox.update.mockResolvedValueOnce({});

    const { stopRunningSyncJob } = await importSyncModule();
    const result = await stopRunningSyncJob("job-running-1");

    expect(result).toEqual({ stopped: true, mailboxId: "mailbox-1" });
    expect(prisma.syncJob.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.syncRun.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.mailbox.update).toHaveBeenCalledTimes(1);
  });
});
