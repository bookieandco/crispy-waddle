import { describe, expect, it } from "vitest"
import {
  MarkifactPaidMediaProvider,
  buildMarkifactPausedCampaignInputs,
  checkMarkifactCampaignCapability,
  type MarkifactMcpTransport,
} from "./markifact-provider"
import type { GrowthPaidOutboxRow } from "./production-repository"

const job: GrowthPaidOutboxRow = {
  id: "outbox-1",
  user_id: "u1",
  campaign_id: "campaign-1",
  approval_receipt_id: "receipt-1",
  provider: "markifact",
  channel: "meta",
  provider_account_id: "act_123",
  operation_intent: "create_paused_campaign",
  payload: {
    name: "PupsonStuff acceptance",
    objective: "OUTCOME_SALES",
    dailyBudgetMinor: 2500,
    currency: "USD",
  },
  request_fingerprint: "fp",
  idempotency_key: "idem",
  status: "attempting",
  attempt_count: 1,
  provider_operation_id: null,
  provider_campaign_id: null,
  last_error: null,
  created_at: "2026-09-21T20:00:00Z",
  updated_at: "2026-09-21T20:00:00Z",
}

const tools = [
  { name: "find_operations", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "get_operation_inputs", inputSchema: { type: "object", properties: { operation_id: { type: "string" } }, required: ["operation_id"] } },
  {
    name: "run_write_operation",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, inputs: { type: "object" } },
      required: ["operation_id", "inputs"],
    },
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
]

describe("Markifact paid-media adapter", () => {
  it("maps a certified campaign to an explicitly PAUSED provider write", () => {
    const inputs = buildMarkifactPausedCampaignInputs(job, {
      type: "object",
      properties: {
        account_id: { type: "string" },
        name: { type: "string" },
        objective: { type: "string" },
        status: { type: "string" },
      },
      required: ["account_id", "name", "objective", "status"],
    })
    expect(inputs).toEqual({
      account_id: "act_123",
      name: "PupsonStuff acceptance",
      objective: "OUTCOME_SALES",
      status: "PAUSED",
    })
  })

  it("fails closed when Markifact requires an unmapped field", () => {
    expect(() => buildMarkifactPausedCampaignInputs(job, {
      type: "object",
      properties: {
        account_id: { type: "string" },
        name: { type: "string" },
        status: { type: "string" },
        unsafe_unknown_required_field: { type: "string" },
      },
      required: ["account_id", "name", "status", "unsafe_unknown_required_field"],
    })).toThrow("REQUIRED_INPUT_UNMAPPED")
  })

  it("discovers, inspects, then uses the approval-gated write tool", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const transport: MarkifactMcpTransport = {
      async listTools() { return tools },
      async callTool(name, args) {
        calls.push({ name, args })
        if (name === "find_operations") {
          return { structuredContent: { operations: [{ operation_id: "meta_ads_create_campaign", requires_approval: true }] } }
        }
        if (name === "get_operation_inputs") {
          return {
            structuredContent: {
              input_schema: {
                type: "object",
                properties: {
                  account_id: { type: "string" },
                  name: { type: "string" },
                  objective: { type: "string" },
                  status: { type: "string" },
                },
                required: ["account_id", "name", "objective", "status"],
              },
            },
          }
        }
        if (name === "run_write_operation") {
          const inputs = (args.inputs ?? {}) as Record<string, unknown>
          expect(inputs.status).toBe("PAUSED")
          return { structuredContent: { campaign_id: "meta-campaign-123", status: "PAUSED" } }
        }
        throw new Error("unexpected tool")
      },
    }

    const receipt = await new MarkifactPaidMediaProvider(transport).dispatch(job)
    expect(receipt).toEqual({
      state: "delivered",
      providerOperationId: "meta_ads_create_campaign",
      providerCampaignId: "meta-campaign-123",
    })
    expect(calls.map((call) => call.name)).toEqual([
      "find_operations",
      "get_operation_inputs",
      "run_write_operation",
    ])
  })

  it("refuses any operation that Markifact does not itself flag approval-required", async () => {
    const transport: MarkifactMcpTransport = {
      async listTools() { return tools },
      async callTool(name) {
        if (name === "find_operations") {
          return { structuredContent: { operations: [{ operation_id: "meta_ads_create_campaign", requires_approval: false }] } }
        }
        throw new Error("should not continue")
      },
    }
    await expect(new MarkifactPaidMediaProvider(transport).dispatch(job))
      .rejects.toThrow("OPERATION_NOT_APPROVAL_GATED")
  })

  it("reports provider readiness without issuing a write", async () => {
    const calls: string[] = []
    const transport: MarkifactMcpTransport = {
      async listTools() { return tools },
      async callTool(name) {
        calls.push(name)
        if (name === "find_operations") {
          return { structuredContent: { operations: [{ operation_id: "meta_ads_create_campaign", requires_approval: true }] } }
        }
        if (name === "get_operation_inputs") {
          return {
            structuredContent: {
              input_schema: {
                type: "object",
                properties: {
                  account_id: { type: "string" },
                  name: { type: "string" },
                  status: { type: "string" },
                },
                required: ["account_id", "name", "status"],
              },
            },
          }
        }
        throw new Error("preflight must not call write")
      },
    }

    await expect(checkMarkifactCampaignCapability(transport, "meta")).resolves.toEqual({
      operationId: "meta_ads_create_campaign",
      approvalGated: true,
      pausedFieldAvailable: true,
      writeToolPresent: true,
    })
    expect(calls).toEqual(["find_operations", "get_operation_inputs"])
  })

  it("only certifies Meta and Google until other platform operation mappings are proven", async () => {
    const provider = new MarkifactPaidMediaProvider({
      async listTools() { return tools },
      async callTool() { throw new Error("should not call") },
    })
    await expect(provider.dispatch({ ...job, channel: "tiktok" }))
      .rejects.toThrow("CHANNEL_NOT_CERTIFIED")
  })
})
