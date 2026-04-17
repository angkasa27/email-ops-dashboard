import { SyncJobStatus, SyncRunStatus } from "@/generated/prisma/client";

export type SystemJobRow = {
  id: string;
  status: SyncJobStatus;
  reason: string;
  error: string | null;
  createdAt: string;
  mailbox: {
    id: string;
    email: string;
  };
};

export type SystemRunRow = {
  id: string;
  status: SyncRunStatus;
  startedAt: string;
  finishedAt: string | null;
  incomingCount: number;
  outgoingCount: number;
  errorMessage: string | null;
  mailbox: {
    id: string;
    email: string;
  };
};

export type SystemData = {
  heartbeat: { lastSeenAt: string; currentState: string } | null;
  metrics: {
    queuedJobs: number;
    runningJobs: number;
    failedJobs24h: number;
    failedRuns24h: number;
  };
  jobs: SystemJobRow[];
  runs: SystemRunRow[];
  mailboxes: { id: string; email: string }[];
};
