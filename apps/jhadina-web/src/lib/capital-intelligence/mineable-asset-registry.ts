import type { CapitalDomain } from './taxonomy';

export type MiningHardware = 'asic' | 'gpu' | 'cpu' | 'fpga';

export type MineableAsset = {
  id: string;
  symbol: string;
  name: string;
  domain: Extract<CapitalDomain, 'crypto'>;
  network: string;
  algorithm: string;
  hardware: MiningHardware[];
  mergeMinedWith?: string[];
  active: boolean;
  source: 'curated' | 'provider';
  observedAt: string;
};

/**
 * Registry metadata only. It does not claim that an asset is profitable or
 * currently mineable. Profitability must be calculated from fresh network,
 * market, pool and electricity data.
 */
export type MineableAssetRegistry = {
  assets: MineableAsset[];
  updatedAt: string;
};

export function createMineableAssetRegistry(
  assets: MineableAsset[],
  updatedAt: string,
): MineableAssetRegistry {
  const deduped = new Map<string, MineableAsset>();
  for (const asset of assets) {
    if (!asset.id || !asset.symbol || !asset.network || !asset.algorithm) continue;
    deduped.set(asset.id, {
      ...asset,
      hardware: [...new Set(asset.hardware)],
      mergeMinedWith: asset.mergeMinedWith ? [...new Set(asset.mergeMinedWith)] : undefined,
    });
  }
  return { assets: [...deduped.values()], updatedAt };
}

export function findMineableAssets(
  registry: MineableAssetRegistry,
  hardware: MiningHardware,
  algorithm?: string,
): MineableAsset[] {
  return registry.assets.filter((asset) =>
    asset.active &&
    asset.hardware.includes(hardware) &&
    (!algorithm || asset.algorithm.toLowerCase() === algorithm.toLowerCase()),
  );
}
