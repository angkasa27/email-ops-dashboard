import { describe, expect, test } from "vitest";

import { getImapFetchBatchRange, normalizeParsedAttachments, parseMessageSource } from "../src/lib/server/mail";

describe("getImapFetchBatchRange", () => {
  test("returns null when the mailbox has no newer messages", () => {
    expect(getImapFetchBatchRange(4, 5, 100)).toBeNull();
  });

  test("calculates the next bounded UID window", () => {
    expect(getImapFetchBatchRange(2, 8, 3)).toEqual({
      range: "3:5",
      hasMore: true,
      nextCursorUid: 5,
    });
  });

  test("marks the last batch when the window reaches uidNext", () => {
    expect(getImapFetchBatchRange(2, 5, 10)).toEqual({
      range: "3:4",
      hasMore: false,
      nextCursorUid: 4,
    });
  });

  test("normalizes a regular attachment with metadata", () => {
    expect(
      normalizeParsedAttachments([
        {
          filename: "invoice.pdf",
          contentType: "application/pdf",
          contentDisposition: "attachment",
          cid: undefined,
          size: 24576,
          partId: "2",
          related: false,
        },
      ]),
    ).toEqual([
      {
        filename: "invoice.pdf",
        contentType: "application/pdf",
        contentDisposition: "attachment",
        contentId: null,
        partId: "2",
        size: 24576,
        isInline: false,
      },
    ]);
  });

  test("classifies related image parts as inline assets", () => {
    expect(
      normalizeParsedAttachments([
        {
          filename: "image001.png",
          contentType: "image/png",
          contentDisposition: "inline",
          cid: "<image001@example.com>",
          size: 2048,
          partId: "1.2",
          related: true,
        },
      ]),
    ).toEqual([
      {
        filename: "image001.png",
        contentType: "image/png",
        contentDisposition: "inline",
        contentId: "image001@example.com",
        partId: "1.2",
        size: 2048,
        isInline: true,
      },
    ]);
  });

  test("provides a fallback name for unnamed attachments", () => {
    expect(
      normalizeParsedAttachments([
        {
          filename: "",
          contentType: "application/octet-stream",
          contentDisposition: "attachment",
          size: 512,
          partId: "3",
          related: false,
        },
      ]),
    ).toEqual([
      {
        filename: "Unnamed attachment",
        contentType: "application/octet-stream",
        contentDisposition: "attachment",
        contentId: null,
        partId: "3",
        size: 512,
        isInline: false,
      },
    ]);
  });

  test("parses attachment metadata from raw MIME without inlining related images into HTML", async () => {
    const raw = Buffer.from(
      [
        "From: sender@example.com",
        "To: receiver@example.com",
        "Subject: Attachment test",
        "Message-ID: <m1@example.com>",
        "Date: Thu, 17 Apr 2026 00:00:00 +0000",
        'Content-Type: multipart/related; boundary="boundary1"',
        "",
        "--boundary1",
        'Content-Type: text/html; charset="utf-8"',
        "",
        '<html><body><p>Hello</p><img src="cid:image001@example.com"></body></html>',
        "--boundary1",
        'Content-Type: image/png; name="image001.png"',
        "Content-Transfer-Encoding: base64",
        'Content-Disposition: inline; filename="image001.png"',
        "Content-ID: <image001@example.com>",
        "",
        "iVBORw0KGgoAAAANSUhEUgAAAAUA",
        "--boundary1--",
        "",
      ].join("\r\n"),
    );

    const parsed = await parseMessageSource(raw);

    expect(parsed.bodyHtml).toContain('cid:image001@example.com');
    expect(parsed.bodyHtml).not.toContain("data:image/png;base64");
    expect(parsed.attachments).toEqual([
      {
        filename: "image001.png",
        contentType: "image/png",
        contentDisposition: "inline",
        contentId: "image001@example.com",
        partId: "2",
        size: null,
        isInline: true,
      },
    ]);
  });
});
