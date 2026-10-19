import { describe, expect, it, vi } from "vitest";
import {
  BrowserReadOnlyWorker,
  globallyRoutableIPv4,
  type BrowserDnsResolver,
  type BrowserPinnedTransport,
} from "./BrowserReadOnlyWorker";
import type { ReadOnlyBrowserPayload } from "./GovernedBrowserSkillOperator";

const allowed = [{ origin: "https://example.com", paths: ["/docs", "/"] }] as const;
const payload: ReadOnlyBrowserPayload = {
  url: "https://example.com/docs",
  method: "GET", redirectPolicy: "error", cookies: "omit", credentials: "omit",
};
const result = {
  status: 200, contentType: "text/html; charset=utf-8",
  contentEncoding: "identity", byteCount: 13,
  body: "hello browser",
};
function setup(
  dnsAddresses: string[] = ["8.8.8.8"],
  reply: Record<string, unknown> = result,
) {
  const dns: BrowserDnsResolver = { resolve4: vi.fn().mockResolvedValue(dnsAddresses) };
  const transport: BrowserPinnedTransport = { get: vi.fn().mockResolvedValue(reply) };
  const worker = new BrowserReadOnlyWorker(allowed, dns, transport);
  return { worker, dns, transport };
}

describe("JH-MUSE-BROWSER.06 network boundary", () => {
  it("permits only approved origin AND exact public path, pinned IPv4 and harmless GET", async () => {
    const {worker,dns,transport} = setup();
    const out = await worker.read(payload);
    expect(out).toMatchObject({
      sourceUrl: "https://example.com/docs", status: 200,
      mediaType: "text/html", bytes: 13,
      authority: "READ_ONLY_EVIDENCE",
    });
    expect(dns.resolve4).toHaveBeenCalledWith("example.com");
    expect(transport.get).toHaveBeenCalledOnce();
    expect(transport.get).toHaveBeenCalledWith({
      hostname: "example.com", pathname: "/docs",
      pinnedIPv4: "8.8.8.8", timeoutMs: 8000, maxBytes: 196608,
    });
    expect(out).not.toHaveProperty("credential");
  });

  it("blocks external destinations and paths BEFORE DNS or transport", async () => {
    const {worker,dns,transport} = setup();
    for (const url of [
      "http://example.com/docs",
      "https://example.com.evil.test/docs",
      "https://example.com/admin",
      "https://example.com/docs/sub",
      "https://example.com/docs?token=secret",
      "https://user:pass@example.com/docs",
      "https://127.0.0.1/docs",
      "https://[::1]/docs",
      "https://example.com/docs#hidden",
      "https://example.com:8443/docs",
      "https://example.com/%64ocs",
    ]) {
      await expect(worker.read({...payload,url})).rejects.toThrow(/BROWSER_WORKER_/);
    }
    expect(dns.resolve4).not.toHaveBeenCalled();
    expect(transport.get).not.toHaveBeenCalled();
  });

  it("blocks non-GET, cookies, redirect allowance, credential forwarding and extra keys", async () => {
    const {worker,dns,transport} = setup();
    for (const change of [
      { method: "POST" }, { method: "HEAD" }, { cookies: "include" },
      { credentials: "include" }, { redirectPolicy: "follow" },
      { headers: { "Authorization": "secret" } },
      { body: "sensitive" },
    ]) {
      await expect(worker.read({...payload,...change} as ReadOnlyBrowserPayload))
        .rejects.toThrow("BROWSER_WORKER_READ_ONLY_PAYLOAD_REQUIRED");
    }
    expect(dns.resolve4).not.toHaveBeenCalled();
    expect(transport.get).not.toHaveBeenCalled();
  });

  it("rejects private, loopback, reserved, mapped or mixed DNS response before socket", async () => {
    const bad = [
      "127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.1.1", "169.254.169.254",
      "100.64.0.1", "0.0.0.0", "198.18.0.2", "203.0.113.7",
      "192.0.2.33", "198.51.100.8", "::ffff:127.0.0.1",
      "fe80::1", "224.0.0.1", "255.255.255.255",
    ];
    for (const ip of bad) {
      expect(globallyRoutableIPv4(ip), ip).toBe(false);
      const {worker,transport} = setup([ip,"8.8.8.8"]);
      await expect(worker.read(payload)).rejects.toThrow("BROWSER_WORKER_DNS_UNSAFE");
      expect(transport.get).not.toHaveBeenCalled();
    }
    expect(globallyRoutableIPv4("8.8.8.8")).toBe(true);
    expect(globallyRoutableIPv4("1.1.1.1")).toBe(true);
  });

  it("fails closed on failed DNS lookup, no answers or implausibly many answers", async () => {
    const { worker, transport } = setup([]);
    await expect(worker.read(payload)).rejects.toThrow("BROWSER_WORKER_DNS_UNSAFE");
    expect(transport.get).not.toHaveBeenCalled();
    const unavailableDns = { resolve4: vi.fn().mockRejectedValue(new Error("dns failed")) };
    const worker2 = new BrowserReadOnlyWorker(allowed, unavailableDns, transport);
    await expect(worker2.read(payload)).rejects.toThrow("BROWSER_WORKER_DNS_UNAVAILABLE");
    expect(transport.get).not.toHaveBeenCalled();
    const worker3 = setup(Array(17).fill("8.8.8.8")).worker;
    await expect(worker3.read(payload)).rejects.toThrow("BROWSER_WORKER_DNS_UNSAFE");
  });

  it("never treats a redirect, binary, compressed, error page or excessive body as evidence", async () => {
    for (const reply of [
      {...result,status:302},
      {...result,status:500},
      {...result,contentType:"application/octet-stream"},
      {...result,contentEncoding:"gzip"},
      {...result,byteCount:196609},
      {...result,body:"tampered"},
    ]) {
      await expect(setup(["8.8.8.8"],reply).worker.read(payload))
        .rejects.toThrow(/BROWSER_WORKER_/);
    }
  });

  it("refuses invalid, wildcard, private or empty allowlists", () => {
    for (const p of [
      [],
      [{origin: "http://example.com",paths:["/docs"]}],
      [{origin: "https://localhost",paths:["/docs"]}],
      [{origin: "https://example.com.evil.test/path",paths:["/docs"]}],
      [{origin: "https://example.com",paths:["//evil"]}],
      [{origin: "https://example.com",paths:["/docs?abc=1"]}],
      [{origin: "https://example.com",paths:[]}],
    ]) expect(() => new BrowserReadOnlyWorker(p)).toThrow();
  });
});
