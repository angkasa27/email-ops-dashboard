import { describe, expect, test } from "vitest";

import {
  parseCreateMailboxFormData,
  parseMailboxIdFormData,
  parseUpdateMailboxFormData,
} from "../src/lib/server/mailbox-validation";

function createFormData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    form.set(key, value);
  }
  return form;
}

describe("mailbox validation", () => {
  test("rejects invalid create payload", () => {
    const result = parseCreateMailboxFormData(
      createFormData({
        email: "not-an-email",
        host: "",
        port: "99999",
        username: "",
        password: "",
      }),
    );

    expect(result.success).toBe(false);
  });

  test("accepts valid create payload", () => {
    const result = parseCreateMailboxFormData(
      createFormData({
        email: "ops@example.com",
        host: "imap.example.com",
        port: "993",
        username: "ops",
        password: "app-password",
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(993);
      expect(result.data.secure).toBe(true);
    }
  });

  test("update allows blank password but validates id", () => {
    const result = parseUpdateMailboxFormData(
      createFormData({
        id: "mailbox-1",
        email: "ops@example.com",
        host: "127.0.0.1",
        port: "143",
        username: "ops",
        password: "",
      }),
    );

    expect(result.success).toBe(true);
  });

  test("id form rejects empty id", () => {
    const result = parseMailboxIdFormData(createFormData({ id: "" }));
    expect(result.success).toBe(false);
  });
});
