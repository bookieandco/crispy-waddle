import { DexScreenerPoolDiscoverySource } from '../pool-discovery'

describe('DexScreenerPoolDiscoverySource contract', () => {
  const launch = { chainId: 'solana', tokenAddress: 'TOKEN111111111111111111111111111111111111111' } as any

  function response(body: unknown, ok = true, status = 200): Response {
    return { ok, status, json: async () => body } as Response
  }

  it('uses the token-pairs endpoint and preserves only valid pool identity fields', async () => {
    let requested = ''
    const source = new DexScreenerPoolDiscoverySource({
      baseUrl: 'https://example.test',
      now: () => '2026-09-03T12:00:00.000Z',
      fetchImpl: async (url) => {
        requested = String(url)
        return response([
          {
            chainId: 'solana', dexId: 'raydium', pairAddress: 'POOL1',
            baseToken: { address: launch.tokenAddress }, quoteToken: { address: 'SOL' },
            liquidity: { usd: 1234.5 },
          },
        ])
      },
    })

    const pools = await source.discoverPools(launch)
    expect(requested).toBe(`https://example.test/token-pairs/v1/solana/${encodeURIComponent(launch.tokenAddress)}`)
    expect(pools).toEqual([expect.objectContaining({ poolAddress: 'POOL1', dexId: 'raydium', programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', liquidityUsd: 1234.5, observedAt: '2026-09-03T12:00:00.000Z' })])
  })

  it('does not assign an on-chain program to unknown DEXes', async () => {
    const source = new DexScreenerPoolDiscoverySource({
      fetchImpl: async () => response([{ chainId: 'solana', dexId: 'unknown-dex', pairAddress: 'POOL2', baseToken: { address: launch.tokenAddress }, quoteToken: { address: 'SOL' } }]),
    })
    const [pool] = await source.discoverPools(launch)
    expect(pool.dexId).toBe('unknown-dex')
    expect(pool.programId).toBeUndefined()
  })

  it('rejects malformed pairs, wrong-chain pairs, and pairs that do not contain the launch token', async () => {
    const source = new DexScreenerPoolDiscoverySource({
      fetchImpl: async () => response([
        { chainId: 'ethereum', dexId: 'raydium', pairAddress: 'WRONG_CHAIN', baseToken: { address: launch.tokenAddress }, quoteToken: { address: 'SOL' } },
        { chainId: 'solana', dexId: 'raydium', pairAddress: 'WRONG_TOKEN', baseToken: { address: 'OTHER' }, quoteToken: { address: 'SOL' } },
        { chainId: 'solana', dexId: 'raydium', pairAddress: 'MALFORMED', baseToken: {}, quoteToken: {} },
        { chainId: 'solana', dexId: 'raydium', pairAddress: 'VALID', baseToken: { address: 'OTHER' }, quoteToken: { address: launch.tokenAddress } },
      ]),
    })
    const pools = await source.discoverPools(launch)
    expect(pools.map((pool) => pool.poolAddress)).toEqual(['VALID'])
  })

  it('deduplicates repeated pool addresses and ignores invalid liquidity', async () => {
    const source = new DexScreenerPoolDiscoverySource({
      fetchImpl: async () => response([
        { chainId: 'solana', dexId: 'pumpswap', pairAddress: 'POOL3', baseToken: { address: launch.tokenAddress }, quoteToken: { address: 'SOL' }, liquidity: { usd: -1 } },
        { chainId: 'solana', dexId: 'pumpswap', pairAddress: 'POOL3', baseToken: { address: launch.tokenAddress }, quoteToken: { address: 'SOL' }, liquidity: { usd: 99 } },
      ]),
    })
    const pools = await source.discoverPools(launch)
    expect(pools).toHaveLength(1)
    expect(pools[0].liquidityUsd).toBe(99)
    expect(pools[0].programId).toBe('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA')
  })

  it('fails closed on non-2xx responses and non-array payloads', async () => {
    const failing = new DexScreenerPoolDiscoverySource({ fetchImpl: async () => response({}, false, 429) })
    await expect(failing.discoverPools(launch)).rejects.toThrow('429')

    const empty = new DexScreenerPoolDiscoverySource({ fetchImpl: async () => response({ pairs: [] }) })
    await expect(empty.discoverPools(launch)).resolves.toEqual([])
  })
})
