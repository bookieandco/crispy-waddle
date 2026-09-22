import type { SharkChain } from '../wallets/MultiChainWallet';
import type { SharkObservation, ObservationEvidence } from '../observations/SharkObservation';

export interface DexScreenerPair {
  readonly chainId?: string;
  readonly dexId?: string;
  readonly pairAddress?: string;
  readonly baseToken?: { readonly address?: string; readonly name?: string; readonly symbol?: string };
  readonly quoteToken?: { readonly address?: string; readonly name?: string; readonly symbol?: string };
  readonly priceUsd?: string;
  readonly liquidity?: { readonly usd?: number; readonly base?: number; readonly quote?: number };
  readonly volume?: { readonly h24?: number; readonly h6?: number; readonly h1?: number; readonly m5?: number };
  readonly priceChange?: { readonly h24?: number; readonly h6?: number; readonly h1?: number; readonly m5?: number };
  readonly txns?: Record<string, { readonly buys?: number; readonly sells?: number }>;
  readonly fdv?: number;
  readonly marketCap?: number;
  readonly pairCreatedAt?: number;
  readonly url?: string;
}

export interface DexScreenerPairsResponse {
  readonly pairs?: readonly DexScreenerPair[];
}

const CHAIN_MAP: Readonly<Record<string, SharkChain>> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  tron: 'tron',
};

function chainOf(pair: DexScreenerPair): SharkChain {
  return CHAIN_MAP[pair.chainId ?? ''] ?? 'other';
}

function evidence(pair: DexScreenerPair, observedAt: string): ObservationEvidence {
  return {
    source: 'dex',
    sourceId: pair.pairAddress,
    uri: pair.url,
    observedAt,
    reliability: 0.85,
    data: { dexId: pair.dexId, chainId: pair.chainId },
  };
}

/** Pure normalization: external DexScreener data becomes canonical SHARK observations. */
export function normalizeDexScreenerPairs(
  response: DexScreenerPairsResponse,
  observedAt: string,
): SharkObservation[] {
  const observations: SharkObservation[] = [];

  for (const pair of response.pairs ?? []) {
    if (!pair.pairAddress || !pair.baseToken?.address) continue;
    const chain = chainOf(pair);
    const pairEvidence = evidence(pair, observedAt);

    observations.push({
      id: `dex:pool:${pair.pairAddress}:${observedAt}`,
      observedAt,
      chain,
      subjectId: pair.pairAddress,
      subjectType: 'pool',
      kind: 'liquidity',
      value: {
        dexId: pair.dexId,
        priceUsd: pair.priceUsd,
        liquidityUsd: pair.liquidity?.usd,
        volume24hUsd: pair.volume?.h24,
        priceChange24hPct: pair.priceChange?.h24,
        txns24h: pair.txns?.h24,
        fdv: pair.fdv,
        marketCap: pair.marketCap,
        pairCreatedAt: pair.pairCreatedAt,
        baseToken: pair.baseToken.address,
        quoteToken: pair.quoteToken?.address,
      },
      evidence: [pairEvidence],
      confidence: 0.85,
      novelty: 0.5,
    });

    observations.push({
      id: `dex:token:${pair.baseToken.address}:${observedAt}`,
      observedAt,
      chain,
      subjectId: pair.baseToken.address,
      subjectType: 'token',
      kind: 'price',
      value: {
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        priceUsd: pair.priceUsd,
        liquidityUsd: pair.liquidity?.usd,
        volume24hUsd: pair.volume?.h24,
        priceChange24hPct: pair.priceChange?.h24,
        fdv: pair.fdv,
        marketCap: pair.marketCap,
        pairAddress: pair.pairAddress,
      },
      evidence: [pairEvidence],
      confidence: 0.85,
      novelty: 0.5,
    });
  }

  return observations;
}

export interface DexScreenerClient {
  readonly getTokenPairs: (tokenAddress: string) => Promise<DexScreenerPairsResponse>;
}

export async function observeDexScreenerToken(
  client: DexScreenerClient,
  tokenAddress: string,
  observedAt = new Date().toISOString(),
): Promise<SharkObservation[]> {
  return normalizeDexScreenerPairs(await client.getTokenPairs(tokenAddress), observedAt);
}
