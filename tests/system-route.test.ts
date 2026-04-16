import { beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.fn(async () => ({ username: "admin" as const }));

const prisma = {
  workerHeartbeat: { findUnique: vi.fn() },
  syncJob: { count: vi.fn(), findMany: vi.fn() },
  syncRun: { count: vi.fn(), findMany: vi.fn() },
  mailbox: { findMany: vi.fn() },
};

vi.mock("@/lib/server/session", () => ({
  getSession,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma,
}));

describe("GET /api/system", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ username: "admin" });
    prisma.workerHeartbeat.findUnique.mockResolvedValue(null);
    prisma.syncJob.count.mockResolvedValue(0);
    prisma.syncRun.count.mockResolvedValue(0);
    prisma.syncJob.findMany.mockResolvedValue([]);
    prisma.syncRun.findMany.mockResolvedValue([]);
    prisma.mailbox.findMany.mockResolvedValue([]);
  });

  test("returns 401 when unauthenticated", async () => {
    getSession.mockResolvedValueOnce(null);
    const { GET } = await import("../src/app/api/system/route");

    const response = await GET(new Request("http://localhost/api/system"));
    expect(response.status).toBe(401);
  });

  test("returns 200 when authenticated", async () => {
    const { GET } = await import("../src/app/api/system/route");

    const response = await GET(new Request("http://localhost/api/system?jobStatus=all&runStatus=all"));
    expect(response.status).toBe(200);
  });
});
