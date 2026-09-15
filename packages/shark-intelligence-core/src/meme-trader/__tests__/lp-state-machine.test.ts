import { describe, expect, it } from 'vitest'
import { SolanaLPStateMachine } from '../lp-state-machine'

const pool = { poolAddress: 'POOL', chainId: 'solana-mainnet', tokenAddress: 'TOKEN' } as any
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const LEGACY_TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const WRONG_PROGRAM = '11111111111111111111111111111111'
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function base58(bytes: number[]): string { let value = 0n; for (const byte of bytes) value = value * 256n + BigInt(byte); const out: string[] = []; while (value > 0n) { out.unshift(alphabet[Number(value % 58n)]); value /= 58n }; for (const byte of bytes) { if (byte === 0) out.unshift('1'); else break }; return out.join('') }
function u64(value: bigint): number[] { const bytes: number[] = []; for (let i = 0; i < 8; i++) { bytes.push(Number(value & 255n)); value >>= 8n }; return bytes }
function tx(meta: Record<string, unknown>, instructions: unknown[] = []): any { return { signature: 'SIG', observedAt: '2026-01-01T00:00:00Z', accountAddress: 'POOL', evidenceId: 'ev:lp', raw: { transaction: { message: { accountKeys: ['LP_ACCOUNT', 'OWNER', 'OTHER_ACCOUNT', 'LP'], instructions } }, meta } } }

describe('Solana LP state machine', () => {
  it('classifies a corroborated LP burn and preserves the pre-withdrawal owner', () => {
    const result = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '1000', decimals: 6 } }], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '0', decimals: 6 } }], innerInstructions: [{ index: 0, instructions: [{ program: 'spl-token', parsed: { type: 'burn', info: { account: 'LP_ACCOUNT', mint: 'LP', amount: '1000' } } }] }] }), pool, 'LP')
    expect(result[0]).toMatchObject({ kind: 'BURN', tokenAccount: 'LP_ACCOUNT', signature: 'SIG', from: 'OWNER', amountRaw: 1000n, confidence: 1 })
  })
  it('does not call a new 0-to-X account a mint without corroborating evidence', () => {
    const result = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '1000', decimals: 6 } }], innerInstructions: [] }), pool, 'LP')
    expect(result[0]).toMatchObject({ kind: 'UNKNOWN', to: 'OWNER', amountRaw: 1000n })
  })
  it('classifies a corroborated transfer out from the pre-state owner', () => {
    const result = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER_A', uiTokenAmount: { amount: '1000', decimals: 6 } }], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER_A', uiTokenAmount: { amount: '400', decimals: 6 } }], innerInstructions: [{ index: 0, instructions: [{ program: 'spl-token', parsed: { type: 'transfer', info: { source: 'LP_ACCOUNT', destination: 'OTHER_ACCOUNT', mint: 'LP', amount: '600' } } }] }] }), pool, 'LP')
    expect(result[0]).toMatchObject({ kind: 'TRANSFER', tokenAccount: 'LP_ACCOUNT', from: 'OWNER_A', amountRaw: 600n, confidence: 1 })
  })
  it('records owner changes without falsely classifying them as transfers', () => {
    const result = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER_A', uiTokenAmount: { amount: '1000', decimals: 6 } }], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER_B', uiTokenAmount: { amount: '1000', decimals: 6 } }], innerInstructions: [] }), pool, 'LP')
    expect(result[0]).toMatchObject({ kind: 'UNKNOWN', tokenAccount: 'LP_ACCOUNT', from: 'OWNER_A', to: 'OWNER_B', amountRaw: 0n, confidence: 0.35 })
  })
  it('uses compiled legacy SPL burn data when parsed CPI is unavailable', () => {
    const data = base58([8, ...u64(500n)])
    const result = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '500', decimals: 6 } }], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '0', decimals: 6 } }], innerInstructions: [] }, [{ programId: LEGACY_TOKEN, accounts: [0, 3], data }]), pool, 'LP')
    expect(result[0]).toMatchObject({ kind: 'BURN', tokenAccount: 'LP_ACCOUNT', amountRaw: 500n, confidence: 1 })
  })
  it('uses compiled Token-2022 checked transfer data only when the encoded mint matches', () => {
    const data = base58([12, ...u64(600n), 6])
    const result = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '1000', decimals: 6 } }], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '400', decimals: 6 } }], innerInstructions: [] }, [{ programId: TOKEN_2022, accounts: [0, 3, 1], data }]), pool, 'LP')
    expect(result[0]).toMatchObject({ kind: 'TRANSFER', tokenAccount: 'LP_ACCOUNT', amountRaw: 600n, confidence: 1 })

    const mismatch = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '1000', decimals: 6 } }], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '400', decimals: 6 } }], innerInstructions: [] }, [{ programId: TOKEN_2022, accounts: [0, 2, 1], data }]), pool, 'LP')
    expect(mismatch[0]).toMatchObject({ kind: 'UNKNOWN', tokenAccount: 'LP_ACCOUNT', amountRaw: 600n })
  })
  it('rejects raw instructions from unrelated programs', () => {
    const data = base58([8, ...u64(500n)])
    const result = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '500', decimals: 6 } }], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '0', decimals: 6 } }], innerInstructions: [] }, [{ programId: WRONG_PROGRAM, accounts: [0, 3], data }]), pool, 'LP')
    expect(result[0]).toMatchObject({ kind: 'UNKNOWN', tokenAccount: 'LP_ACCOUNT', amountRaw: 500n })
  })
  it('rejects malformed raw instruction data without upgrading the event', () => {
    const result = new SolanaLPStateMachine().decode(tx({ preTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '500', decimals: 6 } }], postTokenBalances: [{ accountIndex: 0, mint: 'LP', owner: 'OWNER', uiTokenAmount: { amount: '0', decimals: 6 } }], innerInstructions: [] }, [{ programId: TOKEN_2022, accounts: [0, 3], data: 'not-base58!' }]), pool, 'LP')
    expect(result[0]).toMatchObject({ kind: 'UNKNOWN', tokenAccount: 'LP_ACCOUNT', amountRaw: 500n })
  })
})
