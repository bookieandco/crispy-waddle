'use client'

import {useEffect,useMemo,useState} from 'react'
import type {EditingAssetManifestEntry} from '@jhadina/director-core'

type Account={
  id:string
  brand:string
  provider:string
  platform:string
  displayName:string
  status:string
}
type Pending={proposalId:string;receiptId:string}
const BRANDS=[
  ['jhadinatv','JhadinaTV'],['jhadina-music','Jhadina Music'],['overageos','OverageOS'],
  ['bookieandco','Bookie & Co.'],['jhadina','Jhadina'],['pupsonstuff','PupsonStuff'],['atwood-bookie','Atwood Bookie'],
] as const

export function WorkstationSocialScheduler({projectId}:{projectId:string}){
  const [assets,setAssets]=useState<EditingAssetManifestEntry[]>([])
  const [accounts,setAccounts]=useState<Account[]>([])
  const [assetId,setAssetId]=useState('')
  const [brand,setBrand]=useState<string>('jhadinatv')
  const [targets,setTargets]=useState<string[]>([])
  const [text,setText]=useState('')
  const [scheduledAt,setScheduledAt]=useState('')
  const [pending,setPending]=useState<Pending|null>(null)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)
  const [finalQcRequired,setFinalQcRequired]=useState(false)
  const [finalQcAdmitted,setFinalQcAdmitted]=useState(false)

  useEffect(()=>{
    let cancelled=false
    void (async()=>{
      try{
        const [assetResponse,accountResponse,finalQcResponse]=await Promise.all([
          fetch('/api/workstation/editing-assets?projectId='+encodeURIComponent(projectId),{cache:'no-store'}),
          fetch('/api/social/profiles',{cache:'no-store'}),
          fetch('/api/workstation/final-qc?projectId='+encodeURIComponent(projectId),{cache:'no-store'}),
        ])
        const assetJson=await assetResponse.json() as {ok?:boolean;assets?:EditingAssetManifestEntry[];error?:string}
        const accountJson=await accountResponse.json() as {success?:boolean;data?:Account[];error?:string}
        const finalQcJson=await finalQcResponse.json() as {
          ok?:boolean
          error?:string
          readiness?:{admissible?:boolean;finalMasterAssetId?:string|null}
        }
        if(!assetResponse.ok||!assetJson.ok)throw new Error(assetJson.error??'Unable to load Director assets')
        if(!accountResponse.ok||!accountJson.success)throw new Error(accountJson.error??'Unable to load Social accounts')
        if(cancelled)return
        const approved=(assetJson.assets??[]).filter(asset=>asset.usable)
        const qcRequired=finalQcResponse.ok&&finalQcJson.ok
        const qcAdmitted=qcRequired&&finalQcJson.readiness?.admissible===true
        const finalMasterId=qcAdmitted?finalQcJson.readiness?.finalMasterAssetId??null:null
        const publishable=qcRequired
          ?approved.filter(asset=>Boolean(finalMasterId)&&asset.assetId===finalMasterId)
          :approved
        setFinalQcRequired(qcRequired)
        setFinalQcAdmitted(qcAdmitted)
        setAssets(publishable)
        setAssetId(current=>publishable.some(asset=>asset.assetId===current)?current:publishable[0]?.assetId||'')
        setAccounts(accountJson.data??[])
      }catch(error){
        if(!cancelled)setStatus(error instanceof Error?error.message:'Unable to load scheduling controls')
      }
    })()
    return()=>{cancelled=true}
  },[projectId])

  const eligible=useMemo(()=>accounts.filter(account=>account.brand===brand&&account.status==='connected'),[accounts,brand])
  useEffect(()=>{setTargets([]);setPending(null)},[brand])

  async function prepare(){
    if(!assetId||!text.trim()||!targets.length)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/workstation/social-proposal',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          projectId,assetId,brand,text:text.trim(),
          scheduledAt:scheduledAt?new Date(scheduledAt).toISOString():undefined,
          targetAccountIds:targets,
        }),
      })
      const data=await response.json() as {
        ok?:boolean
        error?:string
        proposal?:{id:string}
        publicationApproval?:{receiptId:string}
      }
      if(!response.ok||!data.ok||!data.proposal||!data.publicationApproval)throw new Error(data.error??'Unable to prepare Social proposal')
      setPending({proposalId:data.proposal.id,receiptId:data.publicationApproval.receiptId})
      setStatus('Publication proposal prepared. Nothing has published yet.')
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to prepare Social proposal')
    }finally{setBusy(false)}
  }

  async function approve(){
    if(!pending)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/social/posts/'+encodeURIComponent(pending.proposalId)+'/approve',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({approvalReceiptId:pending.receiptId}),
      })
      const data=await response.json() as {success?:boolean;error?:string}
      if(!response.ok||!data.success)throw new Error(data.error??'Social approval failed')
      setPending(null)
      setStatus(scheduledAt?'Approved. Provider scheduling is now governed by the exact approved time.':'Approved. Provider dispatch was requested through Social.')
    }catch(error){
      setStatus(error instanceof Error?error.message:'Social approval failed')
    }finally{setBusy(false)}
  }

  return <section className="rounded-xl border bg-background p-4">
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Director → Social</p>
      <h2 className="font-semibold">Schedule an approved cut</h2>
      <p className="text-xs text-muted-foreground">Short-form uses the approved whole-video path. Faceless/music/film projects expose only the QC-admitted final master here. Social still requires a separate publication approval.</p>
      {finalQcRequired&&!finalQcAdmitted?<p className="mt-1 text-xs text-muted-foreground">Final QC has not admitted this production yet, so no long-form asset is publishable.</p>:null}
    </div>

    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <label className="text-xs">Approved asset
        <select className="mt-1 w-full rounded border bg-background p-2 text-sm" value={assetId} disabled={busy} onChange={event=>{setAssetId(event.target.value);setPending(null)}}>
          <option value="">Choose asset</option>
          {assets.map(asset=><option key={asset.assetId} value={asset.assetId}>{asset.kind} · {asset.assetId.slice(0,18)}…</option>)}
        </select>
      </label>
      <label className="text-xs">Brand
        <select className="mt-1 w-full rounded border bg-background p-2 text-sm" value={brand} disabled={busy} onChange={event=>setBrand(event.target.value)}>
          {BRANDS.map(([value,label])=><option value={value} key={value}>{label}</option>)}
        </select>
      </label>
    </div>

    <div className="mt-3 rounded-lg border p-3">
      <p className="text-xs font-medium">Connected destinations</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {eligible.length?eligible.map(account=><label key={account.id} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
          <input type="checkbox" checked={targets.includes(account.id)} disabled={busy} onChange={event=>setTargets(current=>event.target.checked?[...current,account.id]:current.filter(id=>id!==account.id))}/>
          {account.platform} · {account.displayName}
        </label>):<span className="text-xs text-muted-foreground">No connected accounts for this brand.</span>}
      </div>
    </div>

    <textarea className="mt-3 min-h-24 w-full rounded border p-2 text-sm" placeholder="Caption / post copy…" value={text} disabled={busy} onChange={event=>{setText(event.target.value);setPending(null)}}/>
    <label className="mt-3 block text-xs">Optional scheduled publish time
      <input className="mt-1 block rounded border bg-background p-2 text-sm" type="datetime-local" value={scheduledAt} disabled={busy} min={new Date(Date.now()+60_000).toISOString().slice(0,16)} onChange={event=>{setScheduledAt(event.target.value);setPending(null)}}/>
    </label>

    <div className="mt-3 flex flex-wrap gap-2">
      <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy||!assetId||!text.trim()||!targets.length||!!pending} onClick={()=>void prepare()}>
        {busy?'Working…':'Prepare publication approval'}
      </button>
      {pending?<button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40" disabled={busy} onClick={()=>void approve()}>
        {scheduledAt?'Approve & schedule':'Approve & publish'}
      </button>:null}
    </div>
    {status?<p className="mt-2 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
