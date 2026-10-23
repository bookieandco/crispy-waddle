'use client'
import {useState} from 'react'
import Link from 'next/link'
type PublicResult={
 status?:string;error?:string;chainProof?:boolean;canTrade?:boolean;
 observations?:readonly {mint:string;firstSeenAt:string}[];
 pair?:{mint:string;pairAddress:string;dexId:string;priceUsd:number;
 reportedLiquidityUsd:number;receivedAt:string;chainProof:false;executableQuote:false}
}
export default function SniperPaperStatusPage(){
 const [mint,setMint]=useState('')
 const [pair,setPair]=useState('')
 const [busy,setBusy]=useState(false)
 const [result,setResult]=useState<PublicResult|null>(null)
 const [error,setError]=useState('')
 async function inspect(mode:'profiles'|'pair'){
  setBusy(true);setError('');setResult(null)
  const params=new URLSearchParams({mode})
  if(mode==='pair'){params.set('mint',mint.trim());params.set('pair',pair.trim())}
  try{
   const response=await fetch('/api/internal/shark/sniper/public-canary?'+params.toString(),{
    method:'GET',credentials:'same-origin',cache:'no-store',
   })
   const body=await response.json() as PublicResult
   if(!response.ok)throw new Error(body.error??'Read-only feed unavailable')
   setResult(body)
  }catch(e){setError(e instanceof Error?e.message:'Public source unavailable')}
  finally{setBusy(false)}
 }
 return <main className="jh-page"><div className="jh-wrap" style={{maxWidth:760}}>
  <p className="jh-eyebrow">Jhadina · SHARK · Sniper</p>
  <h1 className="jh-title">Sniper Paper Monitor</h1>
  <p className="jh-copy">Manual public-market source check only. This page does not
   run a listener, control Phantom, sign transactions or perform live trading.</p>
  <section className="jh-card" style={{display:'grid',gap:12,marginTop:16}}>
   <h2>Public source canary</h2>
   <p className="jh-copy">Default status: disabled until the private owner canary is commissioned.
    Token profiles are NOT chain launch notifications. DEX prices are NOT executable sell quotes.</p>
   <button type="button" onClick={()=>inspect('profiles')} disabled={busy}>
    {busy?'Checking…':'Check recent public profiles'}
   </button>
   <label htmlFor="sniper-mint">Solana token mint</label>
   <input id="sniper-mint" value={mint} onChange={e=>setMint(e.target.value)}
    placeholder="Paste Solana mint address" autoComplete="off"/>
   <label htmlFor="sniper-pair">Original pair address</label>
   <input id="sniper-pair" value={pair} onChange={e=>setPair(e.target.value)}
    placeholder="Paste original pair address" autoComplete="off"/>
   <button type="button" onClick={()=>inspect('pair')} disabled={busy||!mint.trim()||!pair.trim()}>
    Check original pair · read only
   </button>
   {error&&<p role="alert">{error}</p>}
   {result&&<div role="status" style={{overflowWrap:'anywhere'}}>
    <strong>{result.status??'PUBLIC RESEARCH ONLY'}</strong>
    {result.observations&&<p>Observed profiles: {result.observations.length}.
     Chain-verified launches: none.</p>}
    {result.observations?.slice(0,8).map(x=><p key={x.mint}>
      <code>{x.mint}</code> · received {x.firstSeenAt}
    </p>)}
    {result.pair&&<p>Mint: <code>{result.pair.mint}</code>.
      Pair: <code>{result.pair.pairAddress}</code>.
      Public reported USD price: {result.pair.priceUsd}.
      Reported liquidity: ${result.pair.reportedLiquidityUsd}.
      Received: {result.pair.receivedAt}.
      Executable quote: NO. Chain proof: NO.</p>}
   </div>}
  </section>
  <section className="jh-card" style={{marginTop:16}}>
   <h2>Trading and learning status</h2>
   <p>Research/paper-only code. No authorized real buy/sell orders, 
    profit credited to Purse, autonomous wallet signing or 24/7 host claimed.</p>
   <Link href="/shark/alpha">Back to SHARK Alpha Research</Link>
  </section>
 </div></main>
}
