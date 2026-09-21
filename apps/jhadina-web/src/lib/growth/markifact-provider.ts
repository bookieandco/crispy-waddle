import type { GrowthPaidOutboxRow } from "./production-repository"
import type { PaidMediaDeliveryReceipt, PaidMediaProvider } from "./paid-media-provider"

type JsonObject = Record<string, unknown>

type McpTool = {
  name: string
  inputSchema?: JsonObject
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
  }
}

type McpCallResult = {
  content?: Array<{ type?: string; text?: string }>
  structuredContent?: unknown
  isError?: boolean
}

export interface MarkifactMcpTransport {
  listTools(): Promise<McpTool[]>
  callTool(name: string, args: JsonObject): Promise<McpCallResult>
}

const OPERATION_BY_CHANNEL: Partial<Record<GrowthPaidOutboxRow["channel"], string>> = {
  meta: "meta_ads_create_campaign",
  google: "gads_create_campaign",
}

function object(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined
}

function textPayload(result: McpCallResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent
  const text = result.content?.find((item) => item.type === "text")?.text
  if (!text) return undefined
  try { return JSON.parse(text) } catch { return text }
}

function deepFind(value: unknown, keys: readonly string[]): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFind(item, keys)
      if (found !== undefined) return found
    }
    return undefined
  }
  const row = object(value)
  if (!row) return undefined
  for (const key of keys) {
    if (row[key] !== undefined) return row[key]
  }
  for (const item of Object.values(row)) {
    const found = deepFind(item, keys)
    if (found !== undefined) return found
  }
  return undefined
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function toolByName(tools: readonly McpTool[], name: string): McpTool {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`GROWTH_MARKIFACT_TOOL_MISSING:${name}`)
  return tool
}

function requiredProperties(schema: JsonObject | undefined): string[] {
  const required = schema?.required
  return Array.isArray(required) ? required.filter((value): value is string => typeof value === "string") : []
}

function properties(schema: JsonObject | undefined): Record<string, JsonObject> {
  const raw = object(schema?.properties)
  if (!raw) return {}
  return Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) => {
      const row = object(value)
      return row ? [[key, row] as const] : []
    }),
  )
}

function buildMetaToolArgs(tool: McpTool, operationId: string, inputs?: JsonObject): JsonObject {
  const props = properties(tool.inputSchema)
  const result: JsonObject = {}
  if ("operation_id" in props) result.operation_id = operationId
  else if ("operationId" in props) result.operationId = operationId
  else throw new Error(`GROWTH_MARKIFACT_OPERATION_ID_SCHEMA_UNKNOWN:${tool.name}`)

  if (inputs !== undefined) {
    if ("inputs" in props) result.inputs = inputs
    else if ("input" in props) result.input = inputs
    else throw new Error(`GROWTH_MARKIFACT_INPUT_SCHEMA_UNKNOWN:${tool.name}`)
  }
  return result
}

function operationSearchArgs(tool: McpTool, operationId: string): JsonObject {
  const props = properties(tool.inputSchema)
  for (const key of ["query", "intent", "search", "q"]) {
    if (key in props) return { [key]: operationId }
  }
  throw new Error("GROWTH_MARKIFACT_FIND_OPERATIONS_SCHEMA_UNKNOWN")
}

function operationRequiresApproval(payload: unknown, operationId: string): boolean | undefined {
  const walk = (value: unknown): boolean | undefined => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item)
        if (found !== undefined) return found
      }
      return undefined
    }
    const row = object(value)
    if (!row) return undefined
    const id = firstString(row.operation_id) ?? firstString(row.operationId) ?? firstString(row.id)
    if (id === operationId && typeof row.requires_approval === "boolean") return row.requires_approval
    for (const item of Object.values(row)) {
      const found = walk(item)
      if (found !== undefined) return found
    }
    return undefined
  }
  return walk(payload)
}

function schemaFromInspection(payload: unknown): JsonObject {
  const row = object(payload)
  if (row) {
    for (const key of ["input_schema", "inputSchema", "schema", "inputs"]) {
      const candidate = object(row[key])
      if (candidate && object(candidate.properties)) return candidate
    }
  }
  const nested = deepFind(payload, ["input_schema", "inputSchema", "schema"])
  const schema = object(nested)
  if (!schema || !object(schema.properties)) throw new Error("GROWTH_MARKIFACT_OPERATION_SCHEMA_MISSING")
  return schema
}

function assignIfPresent(
  result: JsonObject,
  props: Record<string, JsonObject>,
  aliases: readonly string[],
  value: unknown,
): boolean {
  for (const key of aliases) {
    if (key in props) {
      result[key] = value
      return true
    }
  }
  return false
}

export function buildMarkifactPausedCampaignInputs(
  job: GrowthPaidOutboxRow,
  schema: JsonObject,
): JsonObject {
  if (job.operation_intent !== "create_paused_campaign") {
    throw new Error("GROWTH_MARKIFACT_OPERATION_INTENT_UNSAFE")
  }

  const payload = object(job.payload) ?? {}
  const props = properties(schema)
  const inputs: JsonObject = {}

  assignIfPresent(inputs, props, ["account_id", "ad_account_id", "customer_id", "accountId"], job.provider_account_id)
  assignIfPresent(inputs, props, ["name", "campaign_name", "campaignName"], payload.name)
  assignIfPresent(inputs, props, ["objective", "campaign_objective", "objective_type"], payload.objective)
  assignIfPresent(inputs, props, ["status", "campaign_status"], "PAUSED")

  const dailyBudgetMinor = typeof payload.dailyBudgetMinor === "number" ? payload.dailyBudgetMinor : undefined
  if (dailyBudgetMinor !== undefined) {
    assignIfPresent(inputs, props, ["daily_budget_minor", "dailyBudgetMinor"], dailyBudgetMinor)
    assignIfPresent(inputs, props, ["daily_budget", "budget"], dailyBudgetMinor / 100)
  }

  const currency = firstString(payload.currency)
  if (currency) assignIfPresent(inputs, props, ["currency", "currency_code"], currency)

  for (const key of requiredProperties(schema)) {
    if (inputs[key] !== undefined) continue
    const lower = key.toLowerCase()
    if (lower.includes("status")) {
      inputs[key] = "PAUSED"
      continue
    }
    throw new Error(`GROWTH_MARKIFACT_REQUIRED_INPUT_UNMAPPED:${key}`)
  }

  const statusKey = Object.keys(inputs).find((key) => key.toLowerCase().includes("status"))
  if (!statusKey || String(inputs[statusKey]).toUpperCase() !== "PAUSED") {
    throw new Error("GROWTH_MARKIFACT_PAUSED_STATUS_REQUIRED")
  }

  return inputs
}

function deliveredReceipt(operationId: string, result: McpCallResult): PaidMediaDeliveryReceipt {
  if (result.isError) {
    return {
      state: "failed",
      providerOperationId: operationId,
      error: firstString(deepFind(textPayload(result), ["error", "message"])) ?? "MARKIFACT_WRITE_FAILED",
    }
  }
  const payload = textPayload(result)
  const campaignId = firstString(deepFind(payload, [
    "campaign_id",
    "campaignId",
    "resource_name",
    "resourceName",
    "id",
  ]))
  if (!campaignId) {
    return {
      state: "unknown",
      providerOperationId: operationId,
      error: "MARKIFACT_CAMPAIGN_ID_MISSING",
    }
  }
  return {
    state: "delivered",
    providerOperationId: operationId,
    providerCampaignId: campaignId,
  }
}


export async function checkMarkifactCampaignCapability(
  transport: MarkifactMcpTransport,
  channel: string,
): Promise<{
  operationId: string
  approvalGated: boolean
  pausedFieldAvailable: boolean
  writeToolPresent: boolean
}> {
  const operationId = OPERATION_BY_CHANNEL[channel]
  if (!operationId) throw new Error(`GROWTH_MARKIFACT_CHANNEL_NOT_CERTIFIED:${channel}`)

  const tools = await transport.listTools()
  const find = toolByName(tools, "find_operations")
  const inspect = toolByName(tools, "get_operation_inputs")
  const write = toolByName(tools, "run_write_operation")

  if (write.annotations?.readOnlyHint === true) {
    throw new Error("GROWTH_MARKIFACT_WRITE_TOOL_ANNOTATION_INVALID")
  }

  const discovery = await transport.callTool(find.name, operationSearchArgs(find, operationId))
  if (discovery.isError) throw new Error("GROWTH_MARKIFACT_DISCOVERY_FAILED")
  const approvalGated = operationRequiresApproval(textPayload(discovery), operationId) === true

  const inspection = await transport.callTool(inspect.name, buildMetaToolArgs(inspect, operationId))
  if (inspection.isError) throw new Error("GROWTH_MARKIFACT_SCHEMA_INSPECTION_FAILED")
  const schema = schemaFromInspection(textPayload(inspection))
  const props = properties(schema)
  const pausedFieldAvailable = Object.keys(props).some((key) => key.toLowerCase().includes("status"))

  return {
    operationId,
    approvalGated,
    pausedFieldAvailable,
    writeToolPresent: true,
  }
}

export class MarkifactPaidMediaProvider implements PaidMediaProvider {
  readonly name = "markifact"
  readonly configured = true

  constructor(private readonly transport: MarkifactMcpTransport) {}

  async dispatch(job: GrowthPaidOutboxRow): Promise<PaidMediaDeliveryReceipt> {
    const operationId = OPERATION_BY_CHANNEL[job.channel]
    if (!operationId) throw new Error(`GROWTH_MARKIFACT_CHANNEL_NOT_CERTIFIED:${job.channel}`)

    const tools = await this.transport.listTools()
    const find = toolByName(tools, "find_operations")
    const inspect = toolByName(tools, "get_operation_inputs")
    const write = toolByName(tools, "run_write_operation")

    if (write.annotations?.readOnlyHint === true) {
      throw new Error("GROWTH_MARKIFACT_WRITE_TOOL_ANNOTATION_INVALID")
    }

    const discovery = await this.transport.callTool(
      find.name,
      operationSearchArgs(find, operationId),
    )
    if (discovery.isError) throw new Error("GROWTH_MARKIFACT_DISCOVERY_FAILED")

    const requiresApproval = operationRequiresApproval(textPayload(discovery), operationId)
    if (requiresApproval !== true) {
      throw new Error("GROWTH_MARKIFACT_OPERATION_NOT_APPROVAL_GATED")
    }

    const inspection = await this.transport.callTool(
      inspect.name,
      buildMetaToolArgs(inspect, operationId),
    )
    if (inspection.isError) throw new Error("GROWTH_MARKIFACT_SCHEMA_INSPECTION_FAILED")

    const inputs = buildMarkifactPausedCampaignInputs(job, schemaFromInspection(textPayload(inspection)))
    const result = await this.transport.callTool(
      write.name,
      buildMetaToolArgs(write, operationId, inputs),
    )

    return deliveredReceipt(operationId, result)
  }
}
