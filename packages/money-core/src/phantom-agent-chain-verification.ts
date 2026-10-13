import { createHash } from 'node:crypto'
import type { PhantomAgentObservation } from './phantom-agent-mcp-observer.js'

/** Independent RPC check of native SOL only. SPL/Phantom USD valuations
 * remain unverified and can never become Coffer settled/spendable money.
 */
export type PhantomAgentVerifiedNativeSol = Readonly<{
  provider: 'solana-rpc-independent'
  walletId: string
  address: string
  balanceLamports: string
  slot: number
  commitment: 'confirmed'
  observedAt: string
  evidenceHash: string
  phantomEvidenceHash: string
  authority: 'CHAIN_OBSERVATION_ONLY'
  financialAuthority: 'NONE'
  canSign: false
  canExecute: false
  canAuthorizeLive: false
  spendableBalanceMinor: null
}>
type Fetcher = typeof fetch
type RecordValue = Record<string, unknown>
const addressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const hex64 = /^[0-9a-f]{64}$/
// Solana mainnet-beta genesis hash; never accept a balance from devnet/testnet.
export const PHANTOM_AGENT_MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'

export async function verifyPhantomAgentNativeSol(input: Readonly<{
  observation: PhantomAgentObservation
  expectedWalletId: string
  expectedAddress: string
  rpcUrl: string
  now?: string
  fetchFn?: Fetcher
}>): Promise<PhantomAgentVerifiedNativeSol> {
  const { observation: o } = input
  if (!input.expectedWalletId || !addressRegex.test(input.expectedAddress) ||
      o.walletId !== input.expectedWalletId || o.solanaAddress !== input.expectedAddress ||
      o.network !== 'SOLANA' || o.provider !== 'phantom-agent-mcp' ||
      o.authority !== 'OBSERVATION_ONLY' || o.financialAuthority !== 'NONE' ||
      o.canSign !== false || o.canExecute !== false || o.canAuthorizeLive !== false ||
      o.spendableBalanceMinor !== null || !hex64.test(o.balanceEvidenceSha256)) {
    throw new Error('PHANTOM_AGENT_CHAIN_PIN_OR_AUTHORITY_INVALID')
  }
  const now = input.now ?? new Date().toISOString()
  const nowMs = Date.parse(now)
  const observedMs = Date.parse(o.observedAt)
  if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs) ||
      observedMs > nowMs + 30_000 || nowMs - observedMs > 120_000) {
    throw new Error('PHANTOM_AGENT_CHAIN_STALE_MCP_EVIDENCE')
  }
  let url: URL
  try { url = new URL(input.rpcUrl) } catch { throw new Error('PHANTOM_AGENT_CHAIN_RPC_URL_INVALID') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('PHANTOM_AGENT_CHAIN_RPC_HTTPS_REQUIRED')
  }
  const fetchRpc = input.fetchFn ?? fetch
  const genesisResponse = await fetchRpc(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'getGenesisHash', params: [] }),
  })
  if (!genesisResponse.ok) throw new Error('PHANTOM_AGENT_CHAIN_GENESIS_HTTP_ERROR')
  const genesisRaw = await genesisResponse.text()
  if (Buffer.byteLength(genesisRaw,'utf8') > 4096) throw new Error('PHANTOM_AGENT_CHAIN_GENESIS_OVERSIZE')
  let genesis: unknown
  try { genesis = JSON.parse(genesisRaw) }
  catch { throw new Error('PHANTOM_AGENT_CHAIN_GENESIS_INVALID_JSON') }
  if (!genesis || typeof genesis !== 'object' || Array.isArray(genesis)) {
    throw new Error('PHANTOM_AGENT_CHAIN_GENESIS_INVALID')
  }
  const g=genesis as RecordValue
  if (g.jsonrpc !== '2.0' || g.id !== 2 || g.error !== undefined ||
      g.result !== PHANTOM_AGENT_MAINNET_GENESIS) {
    throw new Error('PHANTOM_AGENT_CHAIN_NON_MAINNET_RPC_BLOCKED')
  }
  const response = await (input.fetchFn ?? fetch)(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [input.expectedAddress, { commitment: 'confirmed' }] }),
  })
  if (!response.ok) throw new Error('PHANTOM_AGENT_CHAIN_RPC_HTTP_ERROR')
  const raw = await response.text()
  if (Buffer.byteLength(raw, 'utf8') > 65536) throw new Error('PHANTOM_AGENT_CHAIN_RPC_RESPONSE_OVERSIZE')
  let payload: unknown
  try { payload = JSON.parse(raw) } catch { throw new Error('PHANTOM_AGENT_CHAIN_RPC_INVALID_JSON') }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('PHANTOM_AGENT_CHAIN_RPC_INVALID')
  const resultEnvelope = payload as RecordValue
  if (resultEnvelope.error || resultEnvelope.jsonrpc !== '2.0' || resultEnvelope.id !== 1) throw new Error('PHANTOM_AGENT_CHAIN_RPC_FAILURE')
  const result = resultEnvelope.result
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('PHANTOM_AGENT_CHAIN_RPC_RESULT_INVALID')
  const resultRecord = result as RecordValue
  const context = resultRecord.context
  const slot = context && typeof context === 'object' && !Array.isArray(context) ? (context as RecordValue).slot : null
  const balance = resultRecord.value
  if (typeof slot !== 'number' || !Number.isSafeInteger(slot) || slot <= 0 ||
      typeof balance !== 'number' || !Number.isSafeInteger(balance) || balance < 0) {
    throw new Error('PHANTOM_AGENT_CHAIN_RPC_BALANCE_INVALID')
  }
  const receiptData = JSON.stringify({
    walletId: o.walletId, address: o.solanaAddress, balanceLamports: String(balance),
    slot, observedAt: now, phantomEvidenceHash: o.balanceEvidenceSha256,
  })
  return Object.freeze({
    provider: 'solana-rpc-independent' as const,
    walletId: o.walletId,
    address: o.solanaAddress,
    balanceLamports: String(balance),
    slot,
    commitment: 'confirmed' as const,
    observedAt: now,
    evidenceHash: createHash('sha256').update(receiptData).digest('hex'),
    phantomEvidenceHash: o.balanceEvidenceSha256,
    authority: 'CHAIN_OBSERVATION_ONLY' as const,
    financialAuthority: 'NONE' as const,
    canSign: false as const,
    canExecute: false as const,
    canAuthorizeLive: false as const,
    spendableBalanceMinor: null,
  })
}

/** A SHARK/SHADOW research observation, never an execution signal. */
export function phantomNativeSolToResearchEvidence(snapshot: PhantomAgentVerifiedNativeSol) {
  if (snapshot.authority !== 'CHAIN_OBSERVATION_ONLY' || snapshot.financialAuthority !== 'NONE' ||
      snapshot.canExecute !== false || snapshot.canAuthorizeLive !== false ||
      snapshot.spendableBalanceMinor !== null) throw new Error('PHANTOM_AGENT_RESEARCH_AUTHORITY_INVALID')
  return Object.freeze({
    subjectId: 'wallet:solana:' + snapshot.address,
    kind: 'WALLET_NATIVE_BALANCE_OBSERVATION' as const,
    walletId: snapshot.walletId,
    nativeBalanceLamports: snapshot.balanceLamports,
    observedAt: snapshot.observedAt,
    evidenceIds: Object.freeze([
      'solana-rpc:balance:sha256:' + snapshot.evidenceHash,
      'phantom-agent-mcp:balances:sha256:' + snapshot.phantomEvidenceHash,
    ]),
    canTrade: false as const,
    canApprove: false as const,
    canMoveMoney: false as const,
    authority: 'RESEARCH_EVIDENCE_ONLY' as const,
  })
}
