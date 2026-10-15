'use client'

import { useEffect, useState } from 'react'
import {
  clearJhadinaWatchWallet,
  loadJhadinaWatchWallet,
  saveJhadinaWatchWallet,
  type JhadinaOwnerCreatedWatchWallet,
} from '@/lib/wallet/jhadina-watch-wallet'

const short=(address:string)=>address.slice(0,8)+'…'+address.slice(-8)

/**
 * Owner-created public address. Saving does NOT connect Phantom, verify wallet
 * ownership, grant funds access, register a Coffer signer or launch MCP.
 * Stored only in the current browser until an authenticated import is built.
 */
export function JhadinaDedicatedWatchWalletCard({
  knownWalletAddresses = [],
}: Readonly<{knownWalletAddresses?: readonly string[]}>) {
  const [wallet,setWallet]=useState<JhadinaOwnerCreatedWatchWallet|null>(null)
  const [address,setAddress]=useState('')
  const [error,setError]=useState('')
  const [loaded,setLoaded]=useState(false)
  useEffect(()=>{
    setWallet(loadJhadinaWatchWallet())
    setLoaded(true)
  },[])

  function save() {
    setError('')
    try {
      const next=saveJhadinaWatchWallet({
        address,existingWalletAddresses:knownWalletAddresses,
      })
      setWallet(next)
      setAddress('')
    }catch(cause){
      const code=cause instanceof Error?cause.message:''
      setError(code==='JHADINA_WATCH_WALLET_ROLE_COLLISION'
        ? 'This address is already registered in a different wallet role. No new Jhadina identity was created.'
        : 'Enter the public Solana address only (32-byte Base58). Never enter a seed phrase or private key.')
    }
  }
  function clear() {
    clearJhadinaWatchWallet()
    setWallet(null)
    setAddress('')
    setError('')
  }
  return (
    <article style={{padding:20,borderRadius:24,background:'rgba(255,255,255,.72)',border:'1px solid #dce2dd',display:'grid',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'#77847c'}}>Jhadina Purse · Owner-created wallet</div>
          <h3 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:24,margin:'5px 0 0'}}>Dedicated Solana wallet</h3>
        </div>
        <span style={{fontSize:11,padding:'6px 10px',borderRadius:999,background:'#edf2ed',color:'#56665d'}}>
          {wallet?'WATCH ONLY':'UNREGISTERED'}
        </span>
      </div>
      {!loaded?<p>Checking local wallet registry…</p>:wallet?(
        <>
          <strong style={{overflowWrap:'anywhere',fontSize:15}}>{short(wallet.address)}</strong>
          <p style={{color:'#718078',fontSize:13,lineHeight:1.6,margin:0}}>
            Saved on this device. Owner-created wallet identity is unverified; it is not the Phantom MCP agent
            wallet or Coffer execution wallet. Balance monitoring is not connected.
          </p>
          <a href={'https://explorer.solana.com/address/'+wallet.address} target="_blank" rel="noopener noreferrer"
            style={{color:'#34443c',textDecoration:'underline',fontSize:13}}>
            View public address in Solana Explorer
          </a>
          <button type="button" onClick={clear} style={secondaryButton}>
            Remove from this device
          </button>
        </>
      ):(
        <>
          <label htmlFor="jhadina-watch-only-address" style={{fontSize:13,color:'#34443c'}}>
            Public Solana wallet address
          </label>
          <input id="jhadina-watch-only-address" type="text" value={address}
            onChange={event=>setAddress(event.target.value)}
            placeholder="Paste Jhadina’s public Solana address"
            autoComplete="off" autoCapitalize="none" spellCheck={false}
            style={{border:'1px solid #ccd5cf',borderRadius:12,padding:12,fontSize:14,
              width:'100%',maxWidth:'100%',boxSizing:'border-box'}}/>
          <button type="button" disabled={!address.trim()} onClick={save} style={primaryButton}>
            Save public address on this device
          </button>
          <p style={{color:'#718078',fontSize:12,lineHeight:1.5,margin:0}}>
            This is a private-to-this-browser watch-only record. It does not connect a wallet,
            synchronize across devices, confirm ownership, enable transfers or authorize trades.
          </p>
        </>
      )}
      {error&&<p role="alert" style={{color:'#743b36',fontSize:12,margin:0}}>{error}</p>}
      <small style={{color:'#7b867f',fontSize:11,lineHeight:1.5}}>
        Do not paste a recovery phrase, secret key, or Phantom authentication token.
        No signing, swaps, payouts, trading, or money movement is enabled.
      </small>
    </article>
  )
}
const primaryButton={border:'1px solid #34443c',background:'#34443c',
  color:'#f8f6f1',borderRadius:999,padding:'10px 14px',cursor:'pointer'}
const secondaryButton={border:'1px solid #ccd5cf',background:'transparent',
  color:'#34443c',borderRadius:999,padding:'10px 14px',cursor:'pointer'}
