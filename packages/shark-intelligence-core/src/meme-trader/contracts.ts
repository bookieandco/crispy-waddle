export type EvidenceSource = 'dexscreener' | 'shredstream' | 'wallet' | 'social' | 'kol' | 'meme-radar' | 'network'

export type EvidenceEnvelope<T> = {
  observationId: string
  source: EvidenceSource
  observedAt: string
  receivedAt: string
  chainId: string
  subjectId: string
  payload: T
  sourceRef?: string
  provenance?: Record<string, unknown>
}

export type MarketObservation = {
  liquidityUsd?: number
  volume24hUsd?: number
  buys24h?: number
  sells24h?: number
  anomalyScore?: number
  priceUsd?: number
  pairAgeHours?: number
  marketCount?: number
}

export type SocialObservation = { mentionCount?: number; engagementQuality?: number; sourceCredibility?: number; manipulationScore?: number }
export type WalletObservation = { walletId: string; realizedPnl?: number; holdTimeSeconds?: number; accumulation?: number; distribution?: number; concentration?: number }
export type NetworkHealthObservation = { riskScore?: number }
