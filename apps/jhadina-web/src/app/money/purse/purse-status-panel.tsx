'use client'
import {useEffect,useState} from 'react'
type Status=Readonly<{
 charter:null|{mode:string;effectiveAt:string}
 lastPaperCycle:null|{cycleId:string;recordedAt:string;informationCutoff:string}
 storage:string;worker:string;originalLedger:string;driveRestore:string;bankTransfers:string;cryptoTransfers:string
 paperOperation:string;canExecute:false
}>
type Response={success:true;data:Status}|{success:false;error:string}
export function PurseStatusPanel(){
 const [state,setState]=useState<Status|null>(null)
 const [problem,setProblem]=useState('')
 useEffect(()=>{
  const ac=new AbortController()
  fetch('/api/money/purse/status',{credentials:'same-origin',cache:'no-store',signal:ac.signal}).then(async r=>{
   const data=await r.json() as Response
   if(!r.ok||!data.success)throw new Error(data.success?'Purse status unavailable':data.error)
   setState(data.data)
  }).catch(e=>{if(!ac.signal.aborted)setProblem(e instanceof Error?e.message:'Purse status unavailable')})
  return()=>ac.abort()
 },[])
 const cell={border:'1px solid #dce2dd',borderRadius:14,padding:11,display:'grid',gap:5,background:'#f7f9f5'}
 const label={fontSize:11,color:'#526257'} as const
 return <section aria-label="Purse operational status" style={{padding:20,border:'1px solid #dce2dd',borderRadius:22,background:'#fff',display:'grid',gap:12}}>
  <h2 style={{margin:0,fontSize:22}}>Purse operational evidence</h2>
  <p style={{margin:0,fontSize:13,color:'#526257'}}>Bank and Phantom connections never prove transfer authority. All live movement stays gated.</p>
  {problem?<div role="status">Purse status unavailable: {problem}. No live readiness is inferred.</div>:null}
  {!problem&&!state?<div role="status">Checking owner-scoped runtime…</div>:null}
  {state?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:8}}>
   {([
    ['Charter mode',state.charter?.mode??'No charter'],
    ['Paper storage',state.storage],
    ['Paper worker',state.worker],
    ['Original SHADOW ledger',state.originalLedger],
    ['Drive restore',state.driveRestore],
    ['Bank transfer rail',state.bankTransfers],
    ['Solana transfer rail',state.cryptoTransfers],
    ['Paper certification',state.paperOperation]
   ] as const).map(([name,value])=><div key={name} style={cell}><span style={label}>{name}</span><strong style={{fontSize:12,overflowWrap:'anywhere'}}>{value.replaceAll('_',' ')}</strong></div>)}
  </div>:null}
  {state?.lastPaperCycle?<p style={{fontSize:12,color:'#526257'}}>Last database-visible paper cycle: {state.lastPaperCycle.cycleId} — {state.lastPaperCycle.recordedAt}. A row is not proof of continuous, self-learning operation.</p>:null}
  {state?<small style={{color:'#8a5b22'}}>Execution: DISABLED. Independent backup, source recovery, worker OAuth and provider canary evidence remain required.</small>:null}
 </section>
}
