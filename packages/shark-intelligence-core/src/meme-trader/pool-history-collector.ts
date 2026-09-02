import type { TokenLaunch } from './wallet-launch-pipeline'
import type { PoolDiscoverySource } from './pool-discovery'
import { collectPoolHistory, type PoolAccountDiscoverySource, type PoolTransactionHistorySource } from './solana-pool-history'
import { reconstructPoolLiquidity, type PoolLiquidityDecoder, type ReconstructedPoolLiquidity } from './pool-liquidity-reconstruction'

export type PoolHistoryCollectionResult = { launchId: string; pools: Array<{ poolAddress: string; liquidity?: ReconstructedPoolLiquidity; status: 'complete' | 'missing' | 'error'; error?: string }> }

export async function collectLaunchPoolHistory(input: { launch: TokenLaunch; discovery: PoolDiscoverySource; accounts: PoolAccountDiscoverySource; transactions: PoolTransactionHistorySource; decoder: PoolLiquidityDecoder; from?: string; to?: string }): Promise<PoolHistoryCollectionResult> {
  const pools = await input.discovery.discoverPools(input.launch)
  const from = input.from ?? input.launch.launchedAt
  const results: PoolHistoryCollectionResult['pools'] = []
  for (const pool of pools) {
    try {
      const accounts = await input.accounts.discoverAccounts(pool)
      if (!accounts.length) { results.push({ poolAddress: pool.poolAddress, status: 'missing' }); continue }
      const history = await collectPoolHistory({ pool, accounts, transactions: input.transactions, from, to: input.to })
      const liquidity = reconstructPoolLiquidity({ history, decoder: input.decoder })
      results.push({ poolAddress: pool.poolAddress, liquidity, status: 'complete' })
    } catch (error) {
      results.push({ poolAddress: pool.poolAddress, status: 'error', error: error instanceof Error ? error.message : 'pool-history-failed' })
    }
  }
  return { launchId: input.launch.launchId, pools: results }
}
