import { ingestTokenLaunch, type TokenLaunchIngestResult, type TokenLaunchObservation } from './token-launch-ingest'

export type HeliusLaunchWebhookEvent = {
  type?: string
  signature?: string
  timestamp?: number
  slot?: number
  description?: string
  source?: string
  feePayer?: string
  tokenTransfers?: Array<{ mint?: string; fromUserAccount?: string; toUserAccount?: string; tokenAmount?: number }>
  events?: { token?: { mint?: string; decimals?: number; amount?: number; authority?: string } }
}

export type SolanaLaunchCollectorConfig = {
  chainId?: 'solana-mainnet' | 'solana-devnet'
  source?: string
  minInitialLiquidityUsd?: number
}

export type SolanaLaunchCollection = {
  observation: TokenLaunchObservation
  ingested: TokenLaunchIngestResult
  signature?: string
  slot?: number
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0
const timestamp = (seconds?: number) => seconds && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString()

/**
 * Normalizes live Helius webhook deliveries into the canonical launch-ingestion contract.
 * It deliberately refuses to infer a launch from arbitrary transactions: callers must
 * configure Helius for token-mint/program events and provide a mint in the payload.
 */
export function collectHeliusLaunch(event: HeliusLaunchWebhookEvent, config: SolanaLaunchCollectorConfig = {}): SolanaLaunchCollection | null {
  const mint = event.events?.token?.mint ?? event.tokenTransfers?.find(t => t.mint)?.mint
  if (!mint) return null
  const observedAt = timestamp(event.timestamp)
  const observationId = event.signature ? `helius:${event.signature}:${mint}` : `helius:${mint}:${observedAt}`
  const initialLiquidityUsd = event.tokenTransfers?.reduce((sum, transfer) => sum + (finite(transfer.tokenAmount) ? transfer.tokenAmount : 0), 0)
  if (config.minInitialLiquidityUsd !== undefined && (initialLiquidityUsd ?? 0) < config.minInitialLiquidityUsd) return null

  const evidenceIds = [observationId, ...(event.signature ? [`solana-signature:${event.signature}`] : [])]
  const observation: TokenLaunchObservation = {
    observationId,
    chainId: config.chainId ?? 'solana-mainnet',
    tokenAddress: mint,
    observedAt,
    deployerWalletId: event.feePayer,
    initialLiquidityUsd,
    evidenceIds,
    source: config.source ?? 'helius-webhook',
  }
  return { observation, ingested: ingestTokenLaunch(observation), signature: event.signature, slot: event.slot }
}

export type SolanaLaunchCollector = {
  ingestWebhook(event: HeliusLaunchWebhookEvent): SolanaLaunchCollection | null
}

export function createSolanaLaunchCollector(config: SolanaLaunchCollectorConfig = {}): SolanaLaunchCollector {
  return { ingestWebhook: event => collectHeliusLaunch(event, config) }
}
