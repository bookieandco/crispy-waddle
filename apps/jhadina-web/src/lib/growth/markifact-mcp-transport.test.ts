import { describe, expect, it } from "vitest"
import { MarkifactHttpTransport } from "./markifact-mcp-transport"

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(
    body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body),
    init,
  )
}

describe("Markifact Streamable HTTP transport", () => {
  it("initializes a session then lists and calls tools with bearer auth", async () => {
    const requests: Array<{ body: Record<string, unknown>; headers: Headers }> = []
    const fetcher: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers)
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      requests.push({ body, headers })
      const method = body.method

      if (method === "initialize") {
        return response({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: "2025-11-25",
            capabilities: { tools: {} },
            serverInfo: { name: "markifact", version: "test" },
          },
        }, { status: 200, headers: { "content-type": "application/json", "mcp-session-id": "session-1" } })
      }
      if (method === "notifications/initialized") return response(undefined, { status: 202 })
      if (method === "tools/list") {
        return response({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: [{ name: "find_operations", inputSchema: { type: "object", properties: {} } }] },
        }, { status: 200, headers: { "content-type": "application/json" } })
      }
      if (method === "tools/call") {
        return response({
          jsonrpc: "2.0",
          id: body.id,
          result: { structuredContent: { ok: true } },
        }, { status: 200, headers: { "content-type": "application/json" } })
      }
      throw new Error("unexpected request")
    }

    const transport = new MarkifactHttpTransport({
      accessToken: "secret-token",
      fetcher,
    })

    const tools = await transport.listTools()
    const result = await transport.callTool("find_operations", { query: "meta_ads_create_campaign" })

    expect(tools[0]?.name).toBe("find_operations")
    expect(result.structuredContent).toEqual({ ok: true })
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer secret-token")
    expect(requests[0]?.headers.get("mcp-session-id")).toBeNull()
    expect(requests[1]?.headers.get("mcp-session-id")).toBe("session-1")
    expect(requests[2]?.headers.get("mcp-session-id")).toBe("session-1")
    expect(requests[2]?.headers.get("mcp-protocol-version")).toBe("2025-11-25")
  })

  it("parses SSE JSON-RPC responses", async () => {
    const fetcher: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      if (body.method === "initialize") {
        return response(
          `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-11-25", capabilities: {}, serverInfo: { name: "markifact", version: "test" } } })}\n\n`,
          { status: 200, headers: { "content-type": "text/event-stream", "mcp-session-id": "sse-session" } },
        )
      }
      if (body.method === "notifications/initialized") return response(undefined, { status: 202 })
      if (body.method === "tools/list") {
        return response(
          `data: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: [] } })}\n\n`,
          { status: 200, headers: { "content-type": "text/event-stream" } },
        )
      }
      throw new Error("unexpected")
    }

    const transport = new MarkifactHttpTransport({ accessToken: "token", fetcher })
    await expect(transport.listTools()).resolves.toEqual([])
  })

  it("fails closed on missing credential or RPC failure", async () => {
    expect(() => new MarkifactHttpTransport({ accessToken: " " })).toThrow("ACCESS_TOKEN_REQUIRED")

    const fetcher: typeof fetch = async () => response({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32000, message: "nope" },
    }, { status: 200, headers: { "content-type": "application/json" } })

    const transport = new MarkifactHttpTransport({ accessToken: "token", fetcher })
    await expect(transport.listTools()).rejects.toThrow("MCP_RPC_ERROR")
  })
})
