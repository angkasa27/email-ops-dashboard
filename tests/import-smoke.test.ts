import { describe, expect, test } from "vitest";

describe("module import smoke", () => {
  test("imports core query and auth modules", async () => {
    await expect(import("../src/app/(app)/dashboard/queries")).resolves.toBeDefined();
    await expect(import("../src/app/(app)/messages/queries")).resolves.toBeDefined();
    await expect(import("../src/lib/server/auth")).resolves.toBeDefined();
  });
});
