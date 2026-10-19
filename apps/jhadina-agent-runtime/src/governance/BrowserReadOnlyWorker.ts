import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { OutboundSentinel } from "./OutboundSentinel";
import type { ReadOnlyBrowserPayload } from "./GovernedBrowserSkillOperator";

/**
 * An OFFLINE-WIRED browser transport contract. No Action Core handler is
 * installed by this module. The commissioning host MUST additionally apply
 * outbound firewall/network namespaces and provider-level authorization.
 *
 * Source content is UNTRUSTED. The worker reads raw bytes only; it never
 * executes JavaScript, submits forms, forwards cookies, or follows redirects.
 */
export type BrowserReadPolicy = Readonly<{
  origin: string;
  paths: readonly string[];
}>;
export type BrowserReadReceipt = Readonly<{
  sourceUrl: string;
  resolvedIPv4: string;
  status: 200;
  mediaType: "text/plain" | "text/html" | "application/json";
  bytes: number;
  body: string;
  observedAt: string;
  authority: "READ_ONLY_EVIDENCE";
}>;
export interface BrowserDnsResolver {
  resolve4(hostname: string): Promise<readonly string[]>;
}
export type TransportResult = Readonly<{
  status: number;
  contentType: string;
  contentEncoding?: string;
  byteCount: number;
  body: string;
}>;
export interface BrowserPinnedTransport {
  get(input: Readonly<{
    hostname: string;
    pathname: string;
    pinnedIPv4: string;
    timeoutMs: number;
    maxBytes: number;
  }>): Promise<TransportResult>;
}
const MAX_BYTES = 196608;
const TIMEOUT_MS = 8000;
const MEDIA_TYPES = new Set(["text/plain", "text/html", "application/json"]);

/**
 * All DNS answers are verified before pinning a single public IPv4 address
 * to the socket. IPv6 is intentionally unsupported until separately audited.
 * Block loopback, link-local, private, carrier NAT, documentation, multicast
 * and future/reserved ranges; a "mixed" DNS answer fails as a whole.
 */
export function globallyRoutableIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a,b,c] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 255) return false;
  return true;
}

export class BrowserReadOnlyWorker {
  private readonly sentinel: OutboundSentinel;
  private readonly policies: ReadonlyMap<string, ReadonlySet<string>>;

  constructor(
    policies: readonly BrowserReadPolicy[],
    private readonly dns: BrowserDnsResolver = { resolve4 },
    private readonly transport: BrowserPinnedTransport = new NodePinnedHttpsTransport(),
  ) {
    if (!policies.length) throw new Error("BROWSER_WORKER_ALLOWLIST_REQUIRED");
    const origins = new Set<string>();
    const paths = new Map<string, ReadonlySet<string>>();
    for (const policy of policies) {
      // Let the canonical Sentinel vet origins; never accept wildcards, URLs
      // carrying secrets, userinfo, localhost or scheme downgrades.
      const vet = new OutboundSentinel([policy.origin]);
      const validated = vet.reviewReadOnly(policy.origin);
      if (!validated.allowed || new URL(policy.origin).origin !== policy.origin) {
        throw new Error("BROWSER_WORKER_ORIGIN_INVALID");
      }
      if (origins.has(policy.origin) || !policy.paths.length || policy.paths.length > 32) {
        throw new Error("BROWSER_WORKER_PATH_ALLOWLIST_INVALID");
      }
      const checkedPaths = new Set<string>();
      for (const path of policy.paths) {
        if (path.length > 256 || !path.startsWith("/") || path.startsWith("//") ||
            path.includes("?") || path.includes("#") || path.includes("\\") ||
            /[\x00-\x20\x7f]/.test(path) ||
            new URL(path, policy.origin).pathname !== path) {
          throw new Error("BROWSER_WORKER_PATH_INVALID");
        }
        checkedPaths.add(path);
      }
      origins.add(policy.origin);
      paths.set(policy.origin, checkedPaths);
    }
    this.policies = paths;
    this.sentinel = new OutboundSentinel([...origins]);
  }

  async read(payload: ReadOnlyBrowserPayload): Promise<BrowserReadReceipt> {
    // Require every field from the canonical bridge, not model-provided
    // "similar" objects. Unknown keys are rejected to prevent parameter
    // smuggling into future transports.
    if (!payload || Object.keys(payload).sort().join(",") !==
        "cookies,credentials,method,redirectPolicy,url" ||
        payload.method !== "GET" || payload.cookies !== "omit" ||
        payload.credentials !== "omit" || payload.redirectPolicy !== "error") {
      throw new Error("BROWSER_WORKER_READ_ONLY_PAYLOAD_REQUIRED");
    }
    const review = this.sentinel.reviewReadOnly(payload.url);
    if (!review.allowed) throw new Error("BROWSER_WORKER_URL_DENIED:" + review.reason);
    const parsed = new URL(review.url);
    if (!this.policies.get(parsed.origin)?.has(parsed.pathname)) {
      throw new Error("BROWSER_WORKER_PATH_DENIED");
    }
    let addresses: readonly string[];
    try { addresses = await this.dns.resolve4(parsed.hostname); }
    catch { throw new Error("BROWSER_WORKER_DNS_UNAVAILABLE"); }
    if (addresses.length === 0 || addresses.length > 16 ||
        addresses.some(ip => !globallyRoutableIPv4(ip))) {
      throw new Error("BROWSER_WORKER_DNS_UNSAFE");
    }
    // transport MUST use this pinned IP for the socket, and retain original
    // DNS hostname for TLS SNI and certificate verification.
    const result = await this.transport.get({
      hostname: parsed.hostname, pathname: parsed.pathname,
      pinnedIPv4: addresses[0], timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES,
    });
    if (result.status >= 300 && result.status < 400) {
      throw new Error("BROWSER_WORKER_REDIRECT_DENIED");
    }
    if (result.status !== 200) throw new Error("BROWSER_WORKER_HTTP_NOT_200");
    if (result.contentEncoding && result.contentEncoding.toLowerCase() !== "identity") {
      throw new Error("BROWSER_WORKER_ENCODING_DENIED");
    }
    const mediaType = result.contentType.split(";")[0].toLowerCase().trim();
    if (!MEDIA_TYPES.has(mediaType)) throw new Error("BROWSER_WORKER_MEDIA_TYPE_DENIED");
    const actualBytes = Buffer.byteLength(result.body, "utf8");
    if (result.byteCount < 0 || result.byteCount > MAX_BYTES ||
        actualBytes > MAX_BYTES || actualBytes !== result.byteCount) {
      throw new Error("BROWSER_WORKER_BODY_LIMIT");
    }
    return Object.freeze({
      sourceUrl: parsed.href,
      resolvedIPv4: addresses[0],
      status: 200,
      mediaType: mediaType as BrowserReadReceipt["mediaType"],
      bytes: result.byteCount,
      body: result.body,
      observedAt: new Date().toISOString(),
      authority: "READ_ONLY_EVIDENCE",
    });
  }
}

/**
 * A pinned one-shot HTTPS implementation. No proxy/redirect/cookie jar,
 * dynamic headers, Browser DOM, script execution or connection reuse.
 * This is NOT a substitute for host-level firewall and isolated worker.
 */
export class NodePinnedHttpsTransport implements BrowserPinnedTransport {
  async get(input: {
    hostname: string; pathname: string; pinnedIPv4: string;
    timeoutMs: number; maxBytes: number;
  }): Promise<TransportResult> {
    if (!globallyRoutableIPv4(input.pinnedIPv4)) {
      throw new Error("BROWSER_WORKER_PIN_INVALID");
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (error: Error | null, value?: TransportResult) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(value!);
      };
      const req = httpsRequest({
        protocol: "https:", hostname: input.hostname, port: 443,
        method: "GET", path: input.pathname,
        agent: false, rejectUnauthorized: true, servername: input.hostname,
        signal: AbortSignal.timeout(input.timeoutMs),
        family: 4,
        lookup: (_hostname, _options, callback) => {
          callback(null, input.pinnedIPv4, 4);
        },
        headers: {
          "Accept": "text/plain, text/html, application/json",
          "Accept-Encoding": "identity",
          "User-Agent": "JhadinaOwnerReadOnlyResearch/1.0",
          "Connection": "close",
        },
      }, response => {
        const status = response.statusCode ?? 0;
        const type = String(response.headers["content-type"] ?? "");
        const encoding = String(response.headers["content-encoding"] ?? "identity");
        const length = Number(response.headers["content-length"] ?? 0);
        if (status !== 200 || !MEDIA_TYPES.has(type.split(";")[0].toLowerCase().trim()) ||
            encoding.toLowerCase() !== "identity" ||
            !Number.isFinite(length) || length > input.maxBytes) {
          response.destroy();
          done(new Error("BROWSER_WORKER_RESPONSE_REJECTED"));
          return;
        }
        const chunks: Buffer[] = [];
        let count = 0;
        response.on("data", (chunk: Buffer) => {
          count += chunk.length;
          if (count > input.maxBytes) {
            response.destroy();
            done(new Error("BROWSER_WORKER_BODY_LIMIT"));
          } else chunks.push(chunk);
        });
        response.on("end", () => {
          if (settled) return;
          const bytes = Buffer.concat(chunks);
          const body = bytes.toString("utf8");
          if (Buffer.byteLength(body, "utf8") !== bytes.length) {
            done(new Error("BROWSER_WORKER_TEXT_DECODING_DENIED"));
            return;
          }
          done(null, { status, contentType: type, contentEncoding: encoding, byteCount: count, body });
        });
        response.on("error", () => done(new Error("BROWSER_WORKER_STREAM_ERROR")));
        response.on("aborted", () => done(new Error("BROWSER_WORKER_RESPONSE_ABORTED")));
      });
      req.setTimeout(input.timeoutMs, () => req.destroy(new Error("BROWSER_WORKER_TIMEOUT")));
      req.on("error", () => done(new Error("BROWSER_WORKER_TRANSPORT_ERROR")));
      req.end();
    });
  }
}
