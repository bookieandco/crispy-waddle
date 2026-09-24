import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { GET } from "./route"

const originalSha = process.env.VERCEL_GIT_COMMIT_SHA
const originalEnv = process.env.VERCEL_ENV

beforeEach(() => {
  process.env.VERCEL_GIT_COMMIT_SHA = "health-test-sha"
  process.env.VERCEL_ENV = "production"
})

afterEach(() => {
  if (originalSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA
  else process.env.VERCEL_GIT_COMMIT_SHA = originalSha
  if (originalEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = originalEnv
})

describe("GET /api/jhadina/expression/health", () => {
  it("returns READY only when the governed production invariants hold", async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("READY")
    expect(body.contractVersion).toBe("JHADINA-EXPRESSION.PROD")
    expect(body.commitSha).toBe("health-test-sha")
    expect(body.environment).toBe("production")
    expect(Object.values(body.checks).every((entry: any) => entry.ready === true)).toBe(true)

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY")
    expect(serialized).not.toContain("ANTHROPIC_API_KEY")
    expect(serialized).not.toContain("OPENAI_API_KEY")
  })
})
