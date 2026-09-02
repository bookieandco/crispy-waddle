import { describe, expect, it } from 'vitest'
import { reconstructLPOwnership } from '../lp-position-ownership'

describe('historical LP ownership', () => {
  it('reconstructs LP owner and balance from point-in-time token balances', () => {
    const history = {
      pool: { poolAddress: 'POOL', chainId: 'solana-mainnet', tokenAddress: 'TOKEN' } as any,
      transactions: [{
        signature: 'SIG', observedAt: '2026-01-01T00:00:00Z', accountAddress: 'POOL', evidenceId: 'ev:1',
        raw: { transaction: { message: { accountKeys: ['OWNER_TOKEN_ACCOUNT'] } }, meta: { postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '1234', decimals: 6 } }] } },
      }],
      accounts: [], source: 'test', evidenceIds: ['ev:1'],
    }
    const result = reconstructLPOwnership(history.transactions[0], history.pool, 'LP')
    expect(result[0]).toMatchObject({ owner: 'OWNER', tokenAccount: 'OWNER_TOKEN_ACCOUNT', amountRaw: 1234n, lpMint: 'LP' })
  })

  it('ignores unrelated mints and zero balances', () => {
    const tx: any = { signature: 'SIG', observedAt: '2026-01-01T00:00:00Z', accountAddress: 'POOL', evidenceId: 'ev', raw: { transaction: { message: { accountKeys: ['A', 'B'] } }, meta: { postTokenBalances: [{ accountIndex: 0, mint: 'OTHER', owner: 'O', uiTokenAmount: { amount: '9', decimals: 6 } }, { accountIndex: 1, mint: 'LP', owner: 'O', uiTokenAmount: { amount: '0', decimals: 6 } }] } } }
    expect(reconstructLPOwnership(tx, { poolAddress: 'POOL' } as any, 'LP')).toEqual([])
  })
})
