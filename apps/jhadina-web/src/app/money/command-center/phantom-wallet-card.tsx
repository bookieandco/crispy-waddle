'use client'

import {useCallback,useEffect,useState} from 'react'
import {
 connectPhantomSolana,disconnectPhantomSolana,getPhantomSolanaProvider,
 openMoneyInPhantom,signPhantomOwnershipMessage,trustedPhantomSolanaAddress,
} from '@/lib/money/phantom-wallet'

type SavedConnection={address:string;status:'ACTIVE'|'DISCONNECTED'|'REVOKED'}
type WalletReply={
 success:boolean
 data?:{connections?:SavedConnection[];challengeId?:string;message?:string;expiresAt?:string;address?:string}
 error?:string
}
async function walletRequest(path:string,init?:RequestInit):Promise<NonNullable<WalletReply['data']>>{
 const headers=new Headers(init?.headers)
 headers.set('content-type','application/json')
 const response=await fetch(path,{
  ...init,credentials:'same-origin',cache:'no-store',headers,
 })
 const result=await response.json() as WalletReply
 if(!response.ok||!result.success)throw new Error(result.error??'Wallet request failed')
 return result.data??{}
}
const short=(x:string)=>x.length>16?x.slice(0,7)+'…'+x.slice(-7):x
const readable=(code:string)=>{
 if(code==='MONEY_PHANTOM_NOT_INSTALLED')return 'Open Jhadina inside the Phantom mobile app browser to connect.'
 if(code==='MONEY_WALLET_SESSION_REQUIRED')return 'Your Jhadina session has expired. Sign in and retry.'
 if(code==='MONEY_PHANTOM_ACCOUNT_CHANGED')return 'Phantom switched accounts. Reconnect and verify the new address.'
 if(code==='MONEY_PHANTOM_PROOF_INVALID')return 'Phantom signature verification failed. Nothing was connected.'
 return code
}

export function PhantomWalletCard({savedConnection}:{savedConnection?:SavedConnection}){
 const [saved,setSaved]=useState<string|null>(savedConnection?.status==='ACTIVE'?savedConnection.address:null)
 const [active,setActive]=useState<string|null>(null)
 const [providerAvailable,setProviderAvailable]=useState(false)
 const [initializing,setInitializing]=useState(true)
 const [busy,setBusy]=useState(false)
 const [stage,setStage]=useState('')
 const [error,setError]=useState('')
 const connected=Boolean(saved&&active===saved)

 const refresh=useCallback(async()=>{
  const provider=getPhantomSolanaProvider()
  setProviderAvailable(Boolean(provider))
  const [wallets,local]=await Promise.all([
   walletRequest('/api/money/wallet-connections'),
   trustedPhantomSolanaAddress(),
  ])
  const stored=wallets.connections?.find(x=>x.status==='ACTIVE')
  setSaved(stored?.address??null)
  setActive(local??null)
 },[])

 useEffect(()=>{
  let mounted=true
  const provider=getPhantomSolanaProvider()
  setProviderAvailable(Boolean(provider))
  const update=()=>{void trustedPhantomSolanaAddress().then(address=>{
   if(mounted)setActive(address??null)
  })}
  const disconnected=()=>{if(mounted)setActive(null)}
  provider?.on?.('connect',update)
  provider?.on?.('accountChanged',update)
  provider?.on?.('disconnect',disconnected)
  const onFocus=()=>{if(mounted)void refresh().catch(()=>{})}
  window.addEventListener('focus',onFocus)
  void refresh().catch(e=>{if(mounted)setError(e instanceof Error?readable(e.message):'Could not load wallet status')})
   .finally(()=>{if(mounted)setInitializing(false)})
  return()=>{
   mounted=false
   window.removeEventListener('focus',onFocus)
   provider?.removeListener?.('connect',update)
   provider?.removeListener?.('accountChanged',update)
   provider?.removeListener?.('disconnect',disconnected)
  }
 },[refresh])

 const connect=async()=>{
  setBusy(true);setError('')
  try{
   setStage('Requesting connection from Phantom')
   const connection=await connectPhantomSolana()
   setStage('Requesting one-time ownership challenge')
   const challenge=await walletRequest('/api/money/wallet-connections/challenge',{
    method:'POST',body:JSON.stringify({provider:'phantom',network:'SOLANA',address:connection.address}),
   })
   if(!challenge.challengeId||!challenge.message)throw new Error('MONEY_PHANTOM_CHALLENGE_MISSING')
   setStage('Approve message signing in Phantom (not a transaction)')
   const signatureBase64=await signPhantomOwnershipMessage(challenge.message,connection.address)
   setStage('Verifying wallet ownership')
   await walletRequest('/api/money/wallet-connections',{
    method:'POST',body:JSON.stringify({
     provider:'phantom',network:'SOLANA',address:connection.address,
     challengeId:challenge.challengeId,signatureBase64,
    }),
   })
   setSaved(connection.address);setActive(connection.address)
  }catch(e){setError(readable(e instanceof Error?e.message:'Could not verify Phantom'))}
  finally{setStage('');setBusy(false)}
 }

 const disconnect=async()=>{
  if(!saved)return
  setBusy(true);setError('')
  try{
   // Remove the server-side connection even if Phantom is unavailable here.
   await walletRequest('/api/money/wallet-connections',{
    method:'DELETE',body:JSON.stringify({address:saved}),
   })
   if(active===saved)await disconnectPhantomSolana().catch(()=>{})
   setSaved(null);setActive(null)
  }catch(e){setError(readable(e instanceof Error?e.message:'Could not disconnect Phantom'))}
  finally{setBusy(false)}
 }

 const open=()=>{try{openMoneyInPhantom()}catch(e){setError(readable(e instanceof Error?e.message:'Open your deployed HTTPS Jhadina site inside Phantom.'))}}
 const label=initializing?'Checking':connected?'Connected and verified':saved?'Saved — reconnect required':'Not connected'

 return <article style={cardStyle}>
  <div style={rowStyle}>
   <div><div style={eyebrow}>Owner wallet · read-only</div><h3 style={h3}>Phantom · Solana</h3></div>
   <span style={pill} aria-live="polite">{label}</span>
  </div>
  {saved?<p style={muted}>Verified wallet: {short(saved)}</p>:
   <p style={muted}>Prove ownership by approving a one-time message in Phantom. This does not authorize transactions.</p>}
  {saved&&!connected&&<p style={muted}>The wallet is recorded in Jhadina, but the matching Phantom account is not connected in this browser. Reconnect to use it.</p>}
  {active&&saved&&active!==saved&&<p style={alert}>A different Phantom account is active: {short(active)}. It must pass its own ownership verification.</p>}
  {stage&&<p style={muted} role="status">{stage}</p>}
  {error&&<p role="alert" style={alert}>{error}</p>}
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   {providerAvailable&&<button type="button" onClick={connect} disabled={busy||initializing} style={button}>
    {busy?'Working…':connected?'Reverify Phantom':'Connect & verify Phantom'}
   </button>}
   {saved&&<button type="button" onClick={disconnect} disabled={busy||initializing} style={secondaryButton}>Disconnect</button>}
   {!providerAvailable&&<button type="button" onClick={open} disabled={busy} style={secondaryButton}>Open in Phantom</button>}
  </div>
  <small style={fine}>On iPhone, open Jhadina inside Phantom's in-app browser. Your seed phrase stays in Phantom. Money Core cannot sign, trade, or move funds from this connection.</small>
 </article>
}
const cardStyle={padding:20,borderRadius:24,background:'rgba(255,255,255,.72)',border:'1px solid #dce2dd',display:'grid',gap:12}
const rowStyle={display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}
const eyebrow={fontSize:10,letterSpacing:'.16em',textTransform:'uppercase' as const,color:'#77847c'}
const h3={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:24,margin:'5px 0 0'}
const pill={fontSize:11,padding:'6px 10px',borderRadius:999,background:'#edf2ed',color:'#56665d'}
const muted={color:'#718078',fontSize:13,lineHeight:1.6,margin:0}
const fine={color:'#7b867f',fontSize:11,lineHeight:1.5}
const alert={padding:10,borderRadius:12,background:'#f3e4e1',color:'#743b36',fontSize:12}
const button={border:'1px solid #34443c',background:'#34443c',color:'#f8f6f1',borderRadius:999,padding:'10px 14px',cursor:'pointer'}
const secondaryButton={border:'1px solid #ccd5cf',background:'transparent',color:'#34443c',borderRadius:999,padding:'10px 14px',cursor:'pointer'}
