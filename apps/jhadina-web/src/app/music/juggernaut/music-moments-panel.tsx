"use client";
import {useCallback,useEffect,useState} from 'react';
import type {MomentsPilot} from '@jhadina/growth-core';

export function MusicMomentsPanel(){
  const [pilot,setPilot]=useState<MomentsPilot|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/music/juggernaut/moments',{cache:'no-store'});
      const payload=await response.json() as {success?:boolean;data?:MomentsPilot;error?:string};
      if(!response.ok||!payload.success||!payload.data)throw new Error(payload.error??'Moments unavailable');
      setPilot(payload.data);
    }catch(failure){
      setPilot(null);setError(failure instanceof Error?failure.message:'Moments unavailable');
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  return <section aria-label="Moments pilot" className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-5 md:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[.28em] text-white/40">Music-Juggernaut.Moments.01–.05</p>
        <h2 className="mt-2 text-xl font-semibold">Moments · one-song campaign lab</h2>
        <p className="mt-2 text-xs text-white/45">Atwood Bookie · Boo Hefner Spring 2022 · Search mode</p>
      </div>
      <button type="button" onClick={()=>void refresh()} disabled={loading}
        className="rounded-full border border-white/20 px-4 py-2 text-xs disabled:opacity-50">
        {loading?'Checking…':'Recheck'}
      </button>
    </div>
    <p className="mt-3 text-sm leading-6 text-white/55">Creative previews and handoff drafts only. Source certification is not audio clearance, a finished Director render, a connected publishing account, or an approved ad budget.</p>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p>}
    {pilot&&<>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {pilot.stages.map(stage=><li key={stage.id} className="rounded-xl border border-white/10 p-4">
          <p className="text-sm font-medium">{stage.id.slice(-2)} · {stage.title}</p>
          <p className="mt-1 text-xs text-white/45">
            {stage.state==='verified'?'Evidence recorded':stage.state==='unverified'?'Independent proof needed':'Blocked'}
          </p>
          {stage.blockers.length>0&&<p className="mt-2 break-words text-xs leading-5 text-white/35">{stage.blockers.join(' · ')}</p>}
        </li>)}
      </ol>
      {pilot.sectionRangeMs?<p className="mt-4 text-xs text-white/55">
        Measured section: {(pilot.sectionRangeMs.start/1000).toFixed(1)}s–{(pilot.sectionRangeMs.end/1000).toFixed(1)}s
      </p>:<p className="mt-4 text-xs text-white/55">No verifiable source audio section to cut yet. No timestamps invented.</p>}
      <p className="mt-5 text-xs text-white/45">The creative workspace above owns the three mini-video, raw-performance and meme variants. This panel checks their proof chain; it cannot render, publish or authorize ads.</p>
      <p className="mt-5 text-xs text-white/45">
        Social: {pilot.socialDraft?'Proposal-ready only; account and child approval still required.':'Awaiting approved Director asset.'}
        {' '}Growth Ads: {pilot.growthAdsDraft?'Unfunded concept only; canonical Growth approval required.':'Awaiting measured section and verified rights.'}
        {' '}Learning: {pilot.validatedLearning?'Qualified evidence in pilot input; canonical admission still required.':'No qualified replicated outcome.'}
      </p>
      <p className="mt-2 text-xs text-white/45">
        {pilot.pilotEvidenceMatched?'Pilot evidence matched; independent live provider and device acceptance remain outstanding.':'Not live-certified. No posting, spending, outbound fan messages, or rendering was started.'}
      </p>
    </>}
  </section>;
}
