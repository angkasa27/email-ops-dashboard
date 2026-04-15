import { describe, expect, test } from "vitest";

import {
  clearSessionCookie,
  createSessionCookieValue,
  readSessionPayload,
  verifyAdminCredentials
} from "../src/lib/server/auth.js";

describe("admin auth", () => {
  test("accepts the configured admin credentials", async () => {
    expect(
      await verifyAdminCredentials({
        username: "admin",
        password: "password",
        adminUsername: "admin",
        adminPassword: "password"
      })
    ).toBe(true);
  });

  test("rejects invalid admin credentials", async () => {
    expect(
      await verifyAdminCredentials({
        username: "admin",
        password: "wrong",
        adminUsername: "admin",
        adminPassword: "password"
      })
    ).toBe(false);
  });

  test("creates and reads a signed session payload", async () => {
    const cookieValue = await createSessionCookieValue({
      username: "admin",
      secret: "super-secret"
    });

    const session = await readSessionPayload({
      cookieValue,
      secret: "super-secret"
    });

    expect(session).toEqual({ username: "admin" });
  });

  test("clears the session cookie with an expired header", () => {
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });
});
