import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createJhadinaWatchWallet, isSolanaPublicAddress,
  loadJhadinaWatchWallet, saveJhadinaWatchWallet,
  clearJhadinaWatchWallet, JHADINA_WATCH_STORAGE_KEY,
} from './jhadina-watch-wallet'

const SYSTEM_PROGRAM='11111111111111111111111111111111'
const WRAPPED_SOL_MINT='So11111111111111111111111111111111111111112'

describe('Jhadina owner-created public wallet address boundary',()=>{
  afterEach(()=>vi.unstubAllGlobals())

  it('validates 32-byte Solana Base58 and rejects bad lengths or secrets',()=>{
    expect(isSolanaPublicAddress(SYSTEM_PROGRAM)).toBe(true)
    expect(isSolanaPublicAddress(WRAPPED_SOL_MINT)).toBe(true)
    expect(isSolanaPublicAddress('0'.repeat(44))).toBe(false)
    expect(isSolanaPublicAddress('z'.repeat(44))).toBe(false)
    expect(isSolanaPublicAddress('1'.repeat(31))).toBe(false)
    expect(isSolanaPublicAddress('1'.repeat(33))).toBe(false)
    expect(isSolanaPublicAddress('secret seed phrase should not be stored')).toBe(false)
  })

  it('creates an owner-controlled observation-disabled wallet, never a Phantom MCP or signer',()=>{
    const row=createJhadinaWatchWallet({address:' '+WRAPPED_SOL_MINT+' ',registeredAt:'2026-10-14T21:00:00.000Z'})
    expect(row.address).toBe(WRAPPED_SOL_MINT)
    expect(row.status).toBe('LOCAL_WATCH_ONLY_UNVERIFIED')
    expect(row.custody).toBe('OWNER_CREATED_UNVERIFIED')
    expect(row.observationEnabled).toBe(false)
    expect(row.verifiedControl).toBe(false)
    expect(row.phantomMcpConnected).toBe(false)
    expect(row.canSign).toBe(false)
    expect(row.canExecute).toBe(false)
    expect(row.canMoveMoney).toBe(false)
  })

  it('forbids silently reassigning an existing owner/coffer/agent wallet identity',()=>{
    expect(()=>createJhadinaWatchWallet({
      address:WRAPPED_SOL_MINT,existingWalletAddresses:[WRAPPED_SOL_MINT],
    })).toThrow('JHADINA_WATCH_WALLET_ROLE_COLLISION')
  })

  it('stores only the public watch record locally, reloads with zero authority and removes cleanly',()=>{
    const entries=new Map<string,string>()
    const storage={
      getItem:(key:string)=>entries.get(key)??null,
      setItem:(key:string,value:string)=>{entries.set(key,value)},
      removeItem:(key:string)=>{entries.delete(key)},
    }
    vi.stubGlobal('window',{localStorage:storage})
    const saved=saveJhadinaWatchWallet({address:WRAPPED_SOL_MINT,registeredAt:'2026-10-14T21:00:00.000Z'})
    expect(loadJhadinaWatchWallet()).toEqual(saved)
    expect(entries.get(JHADINA_WATCH_STORAGE_KEY)).not.toContain('privateKey')
    entries.set(JHADINA_WATCH_STORAGE_KEY,JSON.stringify({
      ...saved,canExecute:true,canSign:true,canMoveMoney:true,
      verifiedControl:true,phantomMcpConnected:true,observationEnabled:true,
    }))
    const reloaded=loadJhadinaWatchWallet()
    expect(reloaded?.canExecute).toBe(false)
    expect(reloaded?.canSign).toBe(false)
    expect(reloaded?.canMoveMoney).toBe(false)
    expect(reloaded?.phantomMcpConnected).toBe(false)
    expect(reloaded?.observationEnabled).toBe(false)
    clearJhadinaWatchWallet()
    expect(loadJhadinaWatchWallet()).toBeNull()
  })
})
