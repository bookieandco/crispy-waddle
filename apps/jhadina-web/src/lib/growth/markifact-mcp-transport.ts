type JsonObject = Record<string, unknown>

type JsonRpcEnvelope = {
  jsonrpc?: string
  id?: string | number | null
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined
}

function parseEventStream(text: string): JsonRpcEnvelope {
  const payloads = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)

  for (const payload of payloads) {
    try {
      const parsed = JSON.parse(payload) as JsonRpcEnvelope
      if (parsed.result !== undefined || parsed.error !== undefined) return parsed
    } catch {
      // Continue until a JSON-RPC event is found.
    }
  }
  throw new Error("GROWTH_MARKIFACT_MCP_EVENT_STREAM_INVALID")
}

async function parseResponse(response: Response): Promise<JsonRpcEnvelope | undefined> {
  if (response.status === 202 || response.status === 204) return undefined
  const text = await response.text()
  if (!text.trim()) return undefined
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("text/event-stream")) return parseEventStream(text)
  try {
    return JSON.parse(text) as JsonRpcEnvelope
  } catch {
    throw new Error(`GROWTH_MARKIFACT_MCP_RESPONSE_INVALID:${response.status}`)
  }
}

export interface MarkifactHttpTransportOptions {
  endpoint?: string
  accessToken: string
  fetcher?: typeof fetch
}

export class MarkifactHttpTransport {
  private readonly endpoint: string
  private readonly accessToken: string
  private readonly fetcher: typeof fetch
  private sessionId?: string
  private protocolVersion = "2025-11-25"
  private initialized = false
  private requestId = 0

  constructor(options: MarkifactHttpTransportOptions) {
    if (!options.accessToken.trim()) throw new Error("GROWTH_MARKIFACT_ACCESS_TOKEN_REQUIRED")
    this.endpoint = options.endpoint?.trim() || "https://api.markifact.com/mcp"
    this.accessToken = options.accessToken.trim()
    this.fetcher = options.fetcher ?? fetch
  }

  private headers(includeSession = true): HeadersInit {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    }
    if (includeSession && this.sessionId) headers["Mcp-Session-Id"] = this.sessionId
    if (includeSession && this.protocolVersion) headers["MCP-Protocol-Version"] = this.protocolVersion
    return headers
  }

  private async post(
    body: JsonObject,
    options: { includeSession?: boolean; allowEmpty?: boolean } = {},
  ): Promise<JsonRpcEnvelope | undefined> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: this.headers(options.includeSession !== false),
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error(`GROWTH_MARKIFACT_MCP_HTTP_${response.status}`)
    }
    if (!this.sessionId) {
      this.sessionId = response.headers.get("mcp-session-id") ?? undefined
    }
    const envelope = await parseResponse(response)
    if (!envelope && options.allowEmpty) return undefined
    if (!envelope) throw new Error("GROWTH_MARKIFACT_MCP_EMPTY_RESPONSE")
    if (envelope.error) {
      throw new Error(`GROWTH_MARKIFACT_MCP_RPC_ERROR:${envelope.error.code ?? "unknown"}:${envelope.error.message ?? "unknown"}`)
    }
    return envelope
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    const envelope = await this.post({
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: {
          name: "jhadina-growth",
          version: "1.0.0",
        },
      },
    }, { includeSession: false })

    const result = asObject(envelope?.result)
    const negotiated = typeof result?.protocolVersion === "string"
      ? result.protocolVersion
      : "2025-11-25"
    this.protocolVersion = negotiated

    await this.post({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }, { allowEmpty: true })

    this.initialized = true
  }

  async listTools(): Promise<Array<{
    name: string
    inputSchema?: JsonObject
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
  }>> {
    await this.ensureInitialized()
    const envelope = await this.post({
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "tools/list",
      params: {},
    })
    const result = asObject(envelope?.result)
    if (!Array.isArray(result?.tools)) throw new Error("GROWTH_MARKIFACT_MCP_TOOLS_LIST_INVALID")
    return result.tools.flatMap((value) => {
      const tool = asObject(value)
      if (!tool || typeof tool.name !== "string") return []
      return [{
        name: tool.name,
        inputSchema: asObject(tool.inputSchema),
        annotations: asObject(tool.annotations) as { readOnlyHint?: boolean; destructiveHint?: boolean } | undefined,
      }]
    })
  }

  async callTool(name: string, args: JsonObject): Promise<{
    content?: Array<{ type?: string; text?: string }>
    structuredContent?: unknown
    isError?: boolean
  }> {
    await this.ensureInitialized()
    const envelope = await this.post({
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    })
    const result = asObject(envelope?.result)
    if (!result) throw new Error(`GROWTH_MARKIFACT_MCP_TOOL_RESULT_INVALID:${name}`)
    return {
      content: Array.isArray(result.content)
        ? result.content.flatMap((value) => {
            const item = asObject(value)
            return item ? [{ type: typeof item.type === "string" ? item.type : undefined, text: typeof item.text === "string" ? item.text : undefined }] : []
          })
        : undefined,
      structuredContent: result.structuredContent,
      isError: result.isError === true,
    }
  }
}
