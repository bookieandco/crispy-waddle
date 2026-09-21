import { afterEach, describe, expect, it } from "vitest"
import { createPaidMediaProvider } from "./paid-media-provider"

const originalToken = process.env.MARKIFACT_MCP_ACCESS_TOKEN
const originalUrl = process.env.MARKIFACT_MCP_URL

afterEach(() => {
  if (originalToken === undefined) delete process.env.MARKIFACT_MCP_ACCESS_TOKEN
  else process.env.MARKIFACT_MCP_ACCESS_TOKEN = originalToken
  if (originalUrl === undefined) delete process.env.MARKIFACT_MCP_URL
  else process.env.MARKIFACT_MCP_URL = originalUrl
})

describe("paid media provider factory", () => {
  it("fails closed when Markifact OAuth is not configured", async () => {
    delete process.env.MARKIFACT_MCP_ACCESS_TOKEN
    const provider = createPaidMediaProvider("markifact")
    expect(provider.configured).toBe(false)
    await expect(provider.dispatch({} as never)).rejects.toThrow("PROVIDER_NOT_CONFIGURED")
  })

  it("only reports Markifact configured when a server-side OAuth access token exists", () => {
    process.env.MARKIFACT_MCP_ACCESS_TOKEN = "oauth-access-token"
    const provider = createPaidMediaProvider("markifact")
    expect(provider.name).toBe("markifact")
    expect(provider.configured).toBe(true)
  })

  it("does not silently substitute another provider", () => {
    process.env.MARKIFACT_MCP_ACCESS_TOKEN = "oauth-access-token"
    expect(createPaidMediaProvider("native").configured).toBe(false)
    expect(createPaidMediaProvider("unknown-provider").configured).toBe(false)
  })
})
