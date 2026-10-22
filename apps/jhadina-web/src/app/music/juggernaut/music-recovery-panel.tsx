"use client";

import {useCallback,useEffect,useState} from 'react';
import type {MusicRecoveryAssessment} from '@/lib/music/music-juggernaut-recovery';

export function MusicRecoveryPanel(){
  const [data,setData]=useState<MusicRecoveryAssessment|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/music/juggernaut/recovery',{cache:'no-store'});
      const result=await response.json() as {success?:boolean;data?:MusicRecoveryAssessment;error?:string};
      if(!response.ok||!result.success||!result.data) throw new Error(result.error??'Recovery unavailable');
      setData(result.data);
    }catch(error){
      setData(null);setError(error instanceof Error?error.message:'Recovery unavailable');
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);

  return <section aria-label="Music production recovery" className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-5 md:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[.28em] text-white/40">Music-Juggernaut.Recover.01–.08</p>
        <h2 className="mt-2 text-xl font-semibold">Production evidence & blockers</h2>
      </div>
      <button type="button" onClick={()=>void refresh()} disabled={loading}
        className="rounded-full border border-white/20 px-4 py-2 text-xs disabled:opacity-50">
        {loading?'Checking…':'Recheck evidence'}
      </button>
    </div>
    <p className="mt-3 text-sm text-white/55">Read-only, owner-scoped audit. Catalog links are not social access; planning, simulated tests, and completed source checks are not live release certification.</p>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p>}
    {data&&<>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Songs',data.counts.songs],['Released records',data.counts.releases],
          ['Section-ready',data.counts.sectionsReady],
          ['Attributable experiments',data.counts.attributableExperiments],
        ].map(([label,value])=><div key={label} className="rounded-2xl border border-white/10 p-3">
          <p className="text-[11px] text-white/45">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p>
        </div>)}
      </div>
      <ol className="mt-6 space-y-2">
        {data.stages.map(item=><li key={item.id} className="rounded-xl border border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{item.id.slice(-2)} · {item.label}</span>
            <span className={item.state==='data_ready'?'text-emerald-300 text-xs':item.state==='unverified'?'text-amber-200 text-xs':'text-white/50 text-xs'}>
              {item.state==='data_ready'?'Data ready':item.state==='unverified'?'Needs independent proof':'Blocked'}
            </span>
          </div>
          {item.blockers.length>0&&<p className="mt-1 break-words text-xs text-white/45">{item.blockers.join(' · ')}</p>}
        </li>)}
      </ol>
      <p className="mt-4 text-xs text-white/45">
        {data.liveCampaignCertified?'Independent production acceptance recorded.':'Not live-certified: external publishing, rights, provider readbacks and iPhone acceptance require separate verified evidence.'}
      </p>
    </>}
  </section>;
}
