/**
 * JH-MUSE.PARITY.03: deterministic, fail-closed destination screen for
 * read-only browser proposals. Not a network sandbox or permission grant.
 * The actual provider MUST enforce DNS/IP, redirects, credentials and egress.
 */
export type SentinelReview =
  | { allowed: false; reason: string }
  | { allowed: true; reason: "REVIEW_ONLY"; url: string };

export class OutboundSentinel {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(approvedOrigins: readonly string[] = []) {
    const origins = new Set<string>();
    for (const raw of approvedOrigins) {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
          parsed.search || parsed.hash || parsed.pathname !== "/" ||
          parsed.port || this.localOrNumericHost(parsed.hostname)) {
        throw new Error("Invalid sentinel allowlist origin");
      }
      origins.add(parsed.origin);
    }
    this.allowedOrigins = origins;
  }

  reviewReadOnly(rawUrl: string): SentinelReview {
    if (typeof rawUrl !== "string" || rawUrl.length > 2048 ||
        /[\\\x00-\x20\x7f]/.test(rawUrl)) {
      return { allowed: false, reason: "INVALID_URL" };
    }
    let url: URL;
    try { url = new URL(rawUrl); }
    catch { return { allowed: false, reason: "INVALID_URL" }; }
    if (url.protocol !== "https:" || url.username || url.password ||
        url.port || url.hash || url.search) {
      return { allowed: false, reason: "UNSAFE_URL_COMPONENT" };
    }
    if (this.localOrNumericHost(url.hostname)) {
      return { allowed: false, reason: "PRIVATE_OR_NUMERIC_DESTINATION" };
    }
    if (!this.allowedOrigins.has(url.origin)) {
      return { allowed: false, reason: "DESTINATION_NOT_ALLOWLISTED" };
    }
    return { allowed: true, reason: "REVIEW_ONLY", url: url.href };
  }

  private localOrNumericHost(host: string): boolean {
    return host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      host.includes(":") || /^\d+(?:\.\d+)*$/.test(host) ||
      /^0x/i.test(host);
  }
}
