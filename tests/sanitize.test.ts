import { describe, expect, test } from "vitest";

import { sanitizeEmailHtml } from "../src/lib/server/sanitize";

describe("sanitizeEmailHtml", () => {
  test("adds noopener noreferrer to target=_blank links", () => {
    const html = `<a href="https://example.com" target="_blank">open</a>`;
    const sanitized = sanitizeEmailHtml(html);

    expect(sanitized).toContain(`rel="noopener noreferrer"`);
  });

  test("drops unsafe data URI images", () => {
    const html = `<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" alt="bad">`;
    const sanitized = sanitizeEmailHtml(html);

    expect(sanitized).toContain("<img");
    expect(sanitized).not.toContain("data:text/html");
  });

  test("keeps safe data URI images", () => {
    const html = `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA" alt="ok">`;
    const sanitized = sanitizeEmailHtml(html);

    expect(sanitized).toContain("data:image/png;base64");
  });
});
