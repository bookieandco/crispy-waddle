import { createHash } from 'node:crypto'

/**
 * PURSE-MCP.01–.04 — unprivileged, read-only Phantom agent observations.
 *
 * IMPORTANT: run this behind an isolated worker which exposes ONLY this narrow
 * adapter. Do not hand an AI agent the raw MCP transport or its signing tools.
 * This module grants no execution authority, creates no wallet session and
 * does not convert token valuations into spendable Coffer cash.
 */
export const PHANTOM_MCP_READ_ONLY_POLICY = Object.freeze({
  purpose: 'AGENT_WALLET_OBSERVATION',
  tools: Object.freeze(['get_connection_status', 'get_wallet_addresses', 'get_token_balances'] as const),
  derivationIndex: 0,
  network: 'solana',
  canSign: false,
  canMoveFunds: false,
  canExecute: false,
  canAuthorizeLive: false,
  financialAuthority: 'NONE' as const,
})

export type PhantomMcpReadOnlyTool = typeof PHANTOM_MCP_READ_ONLY_POLICY.tools[number]
export type PhantomMcpReadOnlyTransport = Readonly<{
  callTool: (request: Readonly<{ name: string; arguments: Readonly<Record<string, unknown>> }>) => Promise<unknown>
}>
export type PhantomAgentIdentity = Readonly<{
  provider: 'phantom-agent-mcp'
  walletId: string
  solanaAddress: string
  derivationIndex: 0
  authority: 'DISCOVERY_ONLY'
  canSign: false
}>
export type PhantomAgentObservation = Readonly<{
  provider: 'phantom-agent-mcp'
  walletId: string
  solanaAddress: string
  network: 'SOLANA'
  observedAt: string
  balanceEvidenceSha256: string
  evidenceIds: readonly string[]
  authority: 'OBSERVATION_ONLY'
  financialAuthority: 'NONE'
  canSign: false
  canExecute: false
  canAuthorizeLive: false
  spendableBalanceMinor: null
}>

type JsonRecord = Record<string, unknown>
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const SAFE_WALLET_ID = /^[a-zA-Z0-9:._-]{1,128}$/
const MAX_RESPONSE_BYTES = 262144

function asObject(value: unknown): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('PHANTOM_MCP_RESPONSE_INVALID')
  }
  return value as JsonRecord
}

function parseToolResult(value: unknown): JsonRecord {
  const envelope = asObject(value)
  if (envelope.isError === true) throw new Error('PHANTOM_MCP_PROVIDER_ERROR')
  let body: unknown = value
  if (envelope.structuredContent !== undefined) {
    body = envelope.structuredContent
  } else if (Array.isArray(envelope.content)) {
    const content = envelope.content as unknown[]
    if (content.length !== 1) throw new Error('PHANTOM_MCP_CONTENT_INVALID')
    const item = asObject(content[0])
    if (item.type !== 'text' || typeof item.text !== 'string') {
      throw new Error('PHANTOM_MCP_CONTENT_INVALID')
    }
    try {
      body = JSON.parse(item.text) as unknown
    } catch {
      throw new Error('PHANTOM_MCP_CONTENT_NOT_JSON')
    }
  }
  const result = asObject(body)
  const bytes = Buffer.byteLength(JSON.stringify(result), 'utf8')
  if (bytes > MAX_RESPONSE_BYTES) throw new Error('PHANTOM_MCP_RESPONSE_TOO_LARGE')
  return result
}

export function assertPhantomMcpReadOnlyTool(tool: string): asserts tool is PhantomMcpReadOnlyTool {
  if (!(PHANTOM_MCP_READ_ONLY_POLICY.tools as readonly string[]).includes(tool)) {
    throw new Error('PHANTOM_MCP_TOOL_DENIED')
  }
}

async function readOnly(
  transport: PhantomMcpReadOnlyTransport,
  tool: PhantomMcpReadOnlyTool,
): Promise<JsonRecord> {
  assertPhantomMcpReadOnlyTool(tool)
  // Never propagate LLM-supplied or provider-supplied arguments.
  const args: Record<string, unknown> = tool === 'get_wallet_addresses'
    ? { derivationIndex: 0 }
    : tool === 'get_token_balances'
      ? { networks: ['solana'], derivationIndex: 0 }
      : {}
  return parseToolResult(await transport.callTool({ name: tool, arguments: args }))
}

/**
 * Discovery is identity-only. Do not import discovered addresses as verified
 * owner wallets or treat discovered balances as funds available for trading.
 */
export async function discoverPhantomAgentWallet(
  transport: PhantomMcpReadOnlyTransport,
): Promise<PhantomAgentIdentity> {
  const response = await readOnly(transport, 'get_wallet_addresses')
  const walletId = response.walletId
  if (typeof walletId !== 'string' || !SAFE_WALLET_ID.test(walletId)) {
    throw new Error('PHANTOM_MCP_WALLET_ID_INVALID')
  }
  if (!Array.isArray(response.addresses)) throw new Error('PHANTOM_MCP_ADDRESSES_INVALID')
  const solana = response.addresses.filter((item: unknown) => {
    return item !== null && typeof item === 'object' && !Array.isArray(item) &&
      (item as JsonRecord).addressType === 'Solana'
  })
  if (solana.length !== 1) throw new Error('PHANTOM_MCP_SOLANA_ADDRESS_AMBIGUOUS')
  const address = (solana[0] as JsonRecord).address
  if (typeof address !== 'string' || !SOLANA_ADDRESS.test(address)) {
    throw new Error('PHANTOM_MCP_SOLANA_ADDRESS_INVALID')
  }
  return Object.freeze({
    provider: 'phantom-agent-mcp' as const,
    walletId,
    solanaAddress: address,
    derivationIndex: 0 as const,
    authority: 'DISCOVERY_ONLY' as const,
    canSign: false as const,
  })
}

/**
 * A separately recorded owner-approved pin prevents device-code sign-in,
 * account switching or derivation changes from silently moving observations
 * to a different wallet. Failure MUST NOT fall back to the personal wallet.
 */
export async function observePinnedPhantomAgentWallet(input: Readonly<{
  transport: PhantomMcpReadOnlyTransport
  expectedWalletId: string
  expectedSolanaAddress: string
  ownerWalletAddresses: readonly string[]
  observedAt?: string
}>): Promise<PhantomAgentObservation> {
  if (!SAFE_WALLET_ID.test(input.expectedWalletId) ||
      !SOLANA_ADDRESS.test(input.expectedSolanaAddress) ||
      !Array.isArray(input.ownerWalletAddresses)) {
    throw new Error('PHANTOM_MCP_OWNER_PIN_REQUIRED')
  }
  if (input.ownerWalletAddresses.includes(input.expectedSolanaAddress)) {
    throw new Error('PHANTOM_MCP_OWNER_AGENT_WALLET_COLLISION')
  }
  const identity = await discoverPhantomAgentWallet(input.transport)
  if (identity.walletId !== input.expectedWalletId ||
      identity.solanaAddress !== input.expectedSolanaAddress) {
    throw new Error('PHANTOM_MCP_IDENTITY_CHANGED')
  }
  const observedAt = input.observedAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(observedAt)) ||
      new Date(observedAt).toISOString() !== observedAt) {
    throw new Error('PHANTOM_MCP_OBSERVATION_TIME_INVALID')
  }
  const balances = await readOnly(input.transport, 'get_token_balances')
  // A hash is evidence of the provider response, NOT independently verified
  // asset ownership, real-time valuation, settled funds or permission to trade.
  const digest = createHash('sha256').update(JSON.stringify(balances)).digest('hex')
  return Object.freeze({
    provider: 'phantom-agent-mcp' as const,
    walletId: identity.walletId,
    solanaAddress: identity.solanaAddress,
    network: 'SOLANA' as const,
    observedAt,
    balanceEvidenceSha256: digest,
    evidenceIds: Object.freeze(['phantom-agent-mcp:balances:sha256:' + digest]),
    authority: 'OBSERVATION_ONLY' as const,
    financialAuthority: 'NONE' as const,
    canSign: false as const,
    canExecute: false as const,
    canAuthorizeLive: false as const,
    spendableBalanceMinor: null,
  })
}
