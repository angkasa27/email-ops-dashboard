import { describe, expect, test } from "vitest";

import {
  groupMessageAttachments,
  normalizeMailboxIds,
  resolveMessageQuery,
} from "../src/app/(app)/messages/queries";

describe("message query resolution", () => {
  test("applies defaults for invalid values", () => {
    const result = resolveMessageQuery({
      page: 0,
      pageSize: -10,
      sortBy: "unknown",
      sortDir: "bad"
    });

    expect(result).toEqual({
      page: 1,
      pageSize: 50,
      sortBy: "receivedAt",
      sortDir: "desc"
    });
  });

  test("keeps explicit supported values", () => {
    const result = resolveMessageQuery({
      page: 3,
      pageSize: 100,
      sortBy: "mailbox",
      sortDir: "asc"
    });

    expect(result).toEqual({
      page: 3,
      pageSize: 100,
      sortBy: "mailbox",
      sortDir: "asc"
    });
  });

  test("caps page size to hard limit", () => {
    const result = resolveMessageQuery({
      page: 2,
      pageSize: 500,
      sortBy: "subject",
      sortDir: "desc"
    });

    expect(result.pageSize).toBe(100);
  });

  test("normalizes repeated mailbox ids into a unique list", () => {
    expect(
      normalizeMailboxIds(["mailbox-2", "mailbox-1", "mailbox-2", ""])
    ).toEqual(["mailbox-2", "mailbox-1"]);
  });

  test("returns undefined when mailbox ids are empty", () => {
    expect(normalizeMailboxIds(undefined)).toBeUndefined();
    expect(normalizeMailboxIds("")).toBeUndefined();
    expect(normalizeMailboxIds(["", "   "])).toBeUndefined();
  });

  test("groups regular attachments ahead of inline assets", () => {
    const grouped = groupMessageAttachments([
      {
        id: "att-2",
        filename: "logo.png",
        contentType: "image/png",
        contentDisposition: "inline",
        contentId: "logo@example.com",
        partId: "1.2",
        size: 4096,
        isInline: true,
        createdAt: new Date("2026-04-17T00:00:00.000Z"),
      },
      {
        id: "att-1",
        filename: "quote.pdf",
        contentType: "application/pdf",
        contentDisposition: "attachment",
        contentId: null,
        partId: "2",
        size: 1024,
        isInline: false,
        createdAt: new Date("2026-04-17T00:00:00.000Z"),
      },
    ]);

    expect(grouped.attachments.map((entry) => entry.id)).toEqual(["att-1"]);
    expect(grouped.inlineAssets.map((entry) => entry.id)).toEqual(["att-2"]);
  });
});
