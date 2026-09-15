/**
 * Production persistence regression tests.
 *
 * Proves five required invariants for production composition safety:
 *
 * Proof 1 — test environment may use InMemoryStorage
 * Proof 2 — production environment with missing durable storage FAILS CLOSED
 *            (createStorage() throws; does NOT silently fall back)
 * Proof 3 — production composition cannot silently select InMemoryStorage
 *            (complementary assertion to proof 2: no bypass path exists)
 * Proof 4 — production resolves SupabaseMemoryStorage when env configured
 * Proof 5 — no route file constructs storage directly; all must go through
 *            the createStorage()/getStorage() abstraction in handlers.ts
 *
 * These tests do NOT require a live Supabase connection — they prove
 * selection logic and structural invariants only.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { InMemoryStorage } from "../lib/storage/InMemoryStorage"
import { SupabaseMemoryStorage } from "../lib/storage/SupabaseMemoryStorage"
import type { MemoryStorage } from "../lib/storage/MemoryStorage"

// ---------------------------------------------------------------------------
// Proof 1 — test environment may use InMemoryStorage
// ---------------------------------------------------------------------------
describe("Proof 1: test environment may use InMemoryStorage", () => {
  it("InMemoryStorage can be constructed and used in a test (non-production) environment", () => {
    // NODE_ENV is 'test' when vitest runs; InMemoryStorage must be usable.
    expect(process.env.NODE_ENV).not.toBe("production")
    const storage = new InMemoryStorage()
    expect(typeof storage.createMemory).toBe("function")
    expect(typeof storage.listMemories).toBe("function")
    expect(typeof storage.createCandidate).toBe("function")
    expect(typeof storage.appendTimelineEvent).toBe("function")
  })

  it("createJhadinaApplication() respects a storage override — the injected instance is used as-is", async () => {
    // A production caller or integration test can inject SupabaseMemoryStorage;
    // the factory must use it rather than replacing it with InMemoryStorage.
    const { createJhadinaApplication } = await import("../lib/application/createJhadinaApplication")
    const mockStorage: MemoryStorage = {
      createMemory: vi.fn().mockResolvedValue({}),
      getMemory: vi.fn().mockResolvedValue(undefined),
      listMemories: vi.fn().mockResolvedValue([]),
      updateMemory: vi.fn().mockResolvedValue(undefined),
      createCandidate: vi.fn().mockResolvedValue({}),
      getCandidate: vi.fn().mockResolvedValue(undefined),
      listCandidates: vi.fn().mockResolvedValue([]),
      removeCandidate: vi.fn().mockResolvedValue(undefined),
      createReasoningEvent: vi.fn().mockResolvedValue({}),
      getReasoningEvent: vi.fn().mockResolvedValue(undefined),
      listReasoningEvents: vi.fn().mockResolvedValue([]),
      appendTimelineEvent: vi.fn().mockResolvedValue({}),
      listTimeline: vi.fn().mockResolvedValue([]),
    }
    const app = createJhadinaApplication({ storage: mockStorage })
    expect(app.storage).toBe(mockStorage)
    expect(app.storage).not.toBeInstanceOf(InMemoryStorage)
  })
})

// ---------------------------------------------------------------------------
// Proof 2 — production fails closed when durable storage is missing
// ---------------------------------------------------------------------------
describe("Proof 2: production fails closed when durable storage is missing", () => {
  let originalNodeEnv: string | undefined
  let originalUrl: string | undefined
  let originalKey: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  afterEach(() => {
    // Restore env after each test so other tests are not polluted.
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv

    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl

    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  })

  it("createStorage() throws when NODE_ENV=production and Supabase env is absent", async () => {
    vi.resetModules()
    process.env.NODE_ENV = "production"
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const { createStorage } = await import("../lib/routes/handlers")
    expect(() => createStorage()).toThrowError(/Production requires SUPABASE_SERVICE_ROLE_KEY/)
  })

  it("createStorage() throws even if only SUPABASE_SERVICE_ROLE_KEY is absent in production", async () => {
    vi.resetModules()
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const { createStorage } = await import("../lib/routes/handlers")
    expect(() => createStorage()).toThrowError(/Production requires SUPABASE_SERVICE_ROLE_KEY/)
  })
})

// ---------------------------------------------------------------------------
// Proof 3 — production CANNOT silently select InMemoryStorage
// ---------------------------------------------------------------------------
describe("Proof 3: production cannot silently fall back to InMemoryStorage", () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  })

  it("createStorage() does NOT return InMemoryStorage in production — it throws", async () => {
    vi.resetModules()
    process.env.NODE_ENV = "production"
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const { createStorage } = await import("../lib/routes/handlers")
    // The result must never be an InMemoryStorage instance; production must throw instead.
    let result: MemoryStorage | undefined
    let threw = false
    try {
      result = createStorage()
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
    expect(result).toBeUndefined()
    if (result) {
      // Defensive: if something is returned it must not be InMemoryStorage.
      expect(result).not.toBeInstanceOf(InMemoryStorage)
    }
  })
})

// ---------------------------------------------------------------------------
// Proof 4 — production resolves SupabaseMemoryStorage when env configured
// ---------------------------------------------------------------------------
describe("Proof 4: production resolves SupabaseMemoryStorage when env is configured", () => {
  let originalNodeEnv: string | undefined
  let originalUrl: string | undefined
  let originalKey: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv

    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl

    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  })

  it("createStorage() returns SupabaseMemoryStorage when both Supabase env vars are set", async () => {
    vi.resetModules()
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"

    const { createStorage } = await import("../lib/routes/handlers")
    const storage = createStorage()
    expect(storage).toBeInstanceOf(SupabaseMemoryStorage)
    expect(storage).not.toBeInstanceOf(InMemoryStorage)
  })
})

// ---------------------------------------------------------------------------
// Proof 5 — no route file constructs storage directly (structural invariant)
// ---------------------------------------------------------------------------
describe("Proof 5: no API route bypasses the repository abstraction", () => {
  /**
   * Scans every file under src/app/api/ and asserts none of them directly
   * instantiate InMemoryStorage or SupabaseMemoryStorage — the two concrete
   * classes that implement the canonical Jhadina MemoryStorage interface
   * used by JanetService, MemoryRepository, TimelineRepository, etc.
   *
   * NOTE: domain-specific in-memory stubs (e.g. InMemoryMusicRepository) are
   * a separate concern; this test deliberately scopes only to the canonical
   * Jhadina MemoryStorage abstraction to avoid false positives on those.
   */
  it("API route files do not contain direct new InMemoryStorage() or new SupabaseMemoryStorage() — canonical Jhadina storage abstraction", () => {
    const apiDir = path.resolve(__dirname, "../app/api")
    const violations: string[] = []

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath)
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          const content = fs.readFileSync(fullPath, "utf8")
          if (/new InMemoryStorage\b/.test(content) || /new SupabaseMemoryStorage\b/.test(content)) {
            violations.push(path.relative(apiDir, fullPath))
          }
        }
      }
    }

    scanDir(apiDir)
    expect(violations).toEqual([])
  })

  it("handlers.ts exports createStorage and getStorage as the single production entry point", async () => {
    // Proves the abstraction boundary exists as an exportable contract.
    const mod = await import("../lib/routes/handlers")
    expect(typeof mod.createStorage).toBe("function")
    expect(typeof mod.getStorage).toBe("function")
  })
})
