import type { SharkChain } from '../../wallets/MultiChainWallet';
import type {
  ObservationEvidence,
  SharkObservation,
} from '../../observations/SharkObservation';

export interface DexScreenerPair {
  readonly chainId?: string;
  readonly dexId?: string;
  readonly url?: string;
  readonly pairAddress?: string;
  readonly baseToken?: { address?: string; name?: string; symbol?: string };
  readonly quoteToken?: { address?: string; name?: string; symbol?: string };
  readonly priceUsd?: string;
  readonly priceChange?: Readonly<Record<string, number>>;
  readonly volume?: Readonly<Record<string, number>>;
  readonly liquidity?: { usd?: number; base?: number; quote?: number };
  readonly fdv?: number;
  readonly marketCap?: number;
  readonly pairCreatedAt?: number;
  readonly txns?: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface DexScreenerTokenResponse {
  readonly pairs?: readonly DexScreenerPair[];
}

export interface DexScreenerClient {
  getTokenPairs(tokenAddress: string): Promise<DexScreenerTokenResponse>;
}

const CHAIN_MAP: Readonly<Record<string, SharkChain>> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  tron: 'tron',
  bitcoin: 'bitcoin',
  dogecoin: 'dogecoin',
};

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function chainFor(pair: DexScreenerPair): SharkChain | undefined {
  return pair.chainId ? CHAIN_MAP[pair.chainId.toLowerCase()] : undefined;
}

function evidence(pair: DexScreenerPair, observedAt: string): ObservationEvidence {
  return {
    source: 'dex',
    sourceId: pair.pairAddress,
    uri: pair.url,
    observedAt,
    reliability: 0.85,
    data: {
      dexId: pair.dexId,
      chainId: pair.chainId,
      pairAddress: pair.pairAddress,
    },
  };
}

/**
 * Converts an external DexScreener snapshot into canonical SHARK observations.
 * This adapter observes; it never trades, signs, or holds credentials.
 */
export function pairToObservations(
  pair: DexScreenerPair,
  observedAt: string = new Date().toISOString(),
): SharkObservation[] {
  const pairId = pair.pairAddress ?? `${pair.chainId ?? 'unknown'}:${pair.baseToken?.address ?? 'unknown'}`;
  const tokenId = pair.baseToken?.address ?? pairId;
  const ev = evidence(pair, observedAt);
  const observations: SharkObservation[] = [];

  const priceUsd = numberOrNull(pair.priceUsd);
  if (priceUsd !== null) {
    observations.push({
      id: `dex:price:${pairId}:${observedAt}`,
      observedAt,
      chain: chainFor(pair),
      subjectId: tokenId,
      subjectType: 'token',
      kind: 'price',
      value: { priceUsd, pairId },
      evidence: [ev],
      confidence: 0.85,
      novelty: 0.5,
    });
  }

  if (pair.liquidity) {
    observations.push({
      id: `dex:liquidity:${pairId}:${observedAt}`,
      observedAt,
      chain: chainFor(pair),
      subjectId: pairId,
      subjectType: 'pool',
      kind: 'liquidity',
      value: { ...pair.liquidity, pairId },
      evidence: [ev],
      confidence: 0.85,
      novelty: 0.5,
    });
  }

  if (pair.volume) {
    observations.push({
      id: `dex:volume:${pairId}:${observedAt}`,
      observedAt,
      chain: chainFor(pair),
      subjectId: pairId,
      subjectType: 'pool',
      kind: 'volume',
      value: { ...pair.volume, pairId },
      evidence: [ev],
      confidence: 0.85,
      novelty: 0.5,
    });
  }

  if (pair.priceChange) {
    observations.push({
      id: `dex:price-change:${pairId}:${observedAt}`,
      observedAt,
      chain: chainFor(pair),
      subjectId: tokenId,
      subjectType: 'token',
      kind: 'price',
      value: { change: { ...pair.priceChange }, pairId },
      evidence: [ev],
      confidence: 0.85,
      novelty: 0.6,
      tags: ['price_change'],
    });
  }

  return observations;
}

export function createDexScreenerClient(
  fetchImpl: typeof fetch = fetch,
  baseUrl = 'https://api.dexscreener.com',
): DexScreenerClient {
  return {
    async getTokenPairs(tokenAddress: string): Promise<DexScreenerTokenResponse> {
      const response = await fetchImpl(`${baseUrl}/latest/dex/tokens/${encodeURIComponent(tokenAddress)}`);
      if (!response.ok) throw new Error(`DexScreener request failed: ${response.status}`);
      return response.json() as Promise<DexScreenerTokenResponse>;
    },
  };
}
