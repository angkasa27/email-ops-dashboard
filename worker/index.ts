import { env } from "../src/lib/server/env";
import { processSyncQueue, recordWorkerHeartbeat, scheduleQueuedSyncJobsForAllMailboxes } from "../src/lib/server/sync";

let isTicking = false;

async function ensureScheduledJobs() {
  await scheduleQueuedSyncJobsForAllMailboxes();
}

async function tick() {
  if (isTicking) {
    return;
  }

  isTicking = true;
  await recordWorkerHeartbeat("tick-start");
  try {
    await ensureScheduledJobs();

    let processed = true;
    while (processed) {
      processed = await processSyncQueue();
    }

    await recordWorkerHeartbeat("idle");
  } finally {
    isTicking = false;
  }
}

async function loop() {
  await recordWorkerHeartbeat("booting");

  await tick();
  setInterval(() => {
    tick().catch(async (error) => {
      await recordWorkerHeartbeat(`error:${error instanceof Error ? error.message : "unknown"}`);
      console.error("Worker tick failed", error);
    });
  }, env.SYNC_POLL_INTERVAL_MS);
}

loop().catch((error) => {
  console.error("Worker crashed", error);
  process.exit(1);
});

export { loop };
