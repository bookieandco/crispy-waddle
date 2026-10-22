import { describe, expect, it } from "vitest";
import { OutboundSentinel } from "./OutboundSentinel";

describe("JH-MUSE.PARITY.03 outbound review", () => {
  const sentinel = new OutboundSentinel(["https://example.org", "https://raw.githubusercontent.com"]);

  it("admits only pinned exact HTTPS origins for read-only proposal", () => {
    expect(sentinel.reviewReadOnly("https://example.org/docs").allowed).toBe(true);
    expect(sentinel.reviewReadOnly("https://example.org.evil.test/docs").allowed).toBe(false);
    expect(sentinel.reviewReadOnly("http://example.org/docs").allowed).toBe(false);
    expect(new OutboundSentinel().reviewReadOnly("https://example.org").allowed).toBe(false);
  });

  it("refuses secrets in URLs, userinfo, query, redirects-by-URL and local hosts", () => {
    for (const url of [
      "https://user:pass@example.org/docs", "https://example.org/?token=secret",
      "https://example.org/#fragment", "https://127.0.0.1/",
      "https://localhost/", "https://[::1]/",
      "https://example.org:444/docs", "https://example.org\\@evil.test",
      "file:///etc/passwd", "https://example.org/?redirect=https://evil.test",
    ]) expect(sentinel.reviewReadOnly(url).allowed).toBe(false);
    expect(() => new OutboundSentinel(["https://localhost"])).toThrow();
    expect(() => new OutboundSentinel(["https://example.org/path"])).toThrow();
  });
});
