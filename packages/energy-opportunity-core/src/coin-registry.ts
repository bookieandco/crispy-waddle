export type MiningAlgorithm = 'sha256' | 'scrypt' | 'randomx' | 'other';

export interface MiningCoin {
  symbol: string;
  name: string;
  algorithm: MiningAlgorithm;
  mergeMinedWith?: string[];
}

export interface MiningHardwareProfile {
  resourceId: string;
  supportedAlgorithms: MiningAlgorithm[];
}

export interface MiningOpportunity {
  coin: MiningCoin;
  compatible: boolean;
  reasonCodes: string[];
}

export const DEFAULT_MINING_COINS: readonly MiningCoin[] = [
  { symbol: 'BTC', name: 'Bitcoin', algorithm: 'sha256' },
  { symbol: 'DOGE', name: 'Dogecoin', algorithm: 'scrypt', mergeMinedWith: ['LTC'] },
  { symbol: 'LTC', name: 'Litecoin', algorithm: 'scrypt', mergeMinedWith: ['DOGE'] },
  { symbol: 'XMR', name: 'Monero', algorithm: 'randomx' },
];

export function discoverMiningOpportunities(
  hardware: MiningHardwareProfile,
  coins: readonly MiningCoin[] = DEFAULT_MINING_COINS,
): MiningOpportunity[] {
  return coins.map((coin) => {
    const compatible = hardware.supportedAlgorithms.includes(coin.algorithm);
    return {
      coin,
      compatible,
      reasonCodes: compatible ? ['ALGORITHM_SUPPORTED'] : ['ALGORITHM_UNSUPPORTED'],
    };
  });
}
