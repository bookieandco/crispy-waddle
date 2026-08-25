export type MiningEconomicsInput = {
  hashratePerSecond: number;
  networkHashratePerSecond: number;
  blockReward: number;
  blocksPerDay: number;
  coinPrice: number;
  powerWatts: number;
  electricityPricePerKwh: number;
  uptimePct: number;
  poolFeePct: number;
  hardwareCost: number;
  maintenancePerDay: number;
};

export type MiningEconomics = {
  expectedCoinPerDay: number;
  grossRevenuePerDay: number;
  electricityCostPerDay: number;
  poolFeePerDay: number;
  netProfitPerDay: number;
  breakEvenDays: number | null;
  roiPerDay: number;
  profitable: boolean;
};

/**
 * Estimate-only mining economics. This module never starts/stops miners,
 * purchases hardware, sells crypto, or transfers funds.
 */
export function calculateMiningEconomics(input: MiningEconomicsInput): MiningEconomics {
  const network = Math.max(0, input.networkHashratePerSecond);
  const hashrate = Math.max(0, input.hashratePerSecond);
  const uptime = Math.max(0, Math.min(1, input.uptimePct));
  const share = network > 0 ? hashrate / network : 0;
  const expectedCoinPerDay = share * Math.max(0, input.blockReward) * Math.max(0, input.blocksPerDay) * uptime;
  const grossRevenuePerDay = expectedCoinPerDay * Math.max(0, input.coinPrice);
  const electricityCostPerDay = (Math.max(0, input.powerWatts) / 1000) * 24 * Math.max(0, input.electricityPricePerKwh) * uptime;
  const poolFeePerDay = grossRevenuePerDay * Math.max(0, input.poolFeePct);
  const netProfitPerDay = grossRevenuePerDay - electricityCostPerDay - poolFeePerDay - Math.max(0, input.maintenancePerDay);
  const breakEvenDays = netProfitPerDay > 0 && input.hardwareCost > 0 ? input.hardwareCost / netProfitPerDay : null;
  const roiPerDay = input.hardwareCost > 0 ? netProfitPerDay / input.hardwareCost : 0;

  return {
    expectedCoinPerDay,
    grossRevenuePerDay,
    electricityCostPerDay,
    poolFeePerDay,
    netProfitPerDay,
    breakEvenDays,
    roiPerDay,
    profitable: netProfitPerDay > 0,
  };
}
