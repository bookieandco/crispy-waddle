"use client";

import {useCallback,useEffect,useState} from 'react';
import type {MusicCrossCorePlan} from '@/lib/music/music-cross-core-bridge';

type SongOption={id:string;song_key?:unknown;title?:unknown};
type DirectorOption={id:string;title:string;status:string};
type Preview={success:boolean;data?:MusicCrossCorePlan;directorProjects?:DirectorOption[];
  directorProjectOptionsState?:'ready'|'unavailable';error?:string};
type Staging={success:boolean;data?:{createdSocialDraftIds:string[];
  preservedSocialDraftIds:string[];directorBriefs:unknown[];
  publicationAuthority:'NONE';adSpendAuthority:'NONE';
  externalActionsStarted:false};error?:string};

export function MusicCrossCorePanel({songs}:{songs:SongOption[]}){
  const options=songs.filter(s=>typeof s.song_key==='string'&&/^catalog:[a-z0-9-]+$/.test(s.song_key));
  const [songKey,setSongKey]=useState('catalog:moments');
  const [directorProjectId,setDirectorProjectId]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);

  const reload=useCallback(async ()=>{
    setState('loading');setMessage('');
    try{
      const q=new URLSearchParams({songKey});
      if(directorProjectId)q.set('directorProjectId',directorProjectId);
      const response=await fetch('/api/music/juggernaut/creative-workspace?'+q.toString(),{cache:'no-store'});
      const body=await response.json() as Preview;
      if(!response.ok||!body.success||!body.data)throw new Error(body.error||'Preview unavailable');
      setPreview(body);setState('ready');
    }catch(error){
      setState('error');setPreview(null);
      setMessage(error instanceof Error?error.message:'Unable to load creative workspace');
    }
  },[songKey,directorProjectId]);

  useEffect(()=>{void reload();},[reload]);

  async function stageDrafts(){
    setSaving(true);setMessage('');
    try{
      const response=await fetch('/api/music/juggernaut/creative-workspace',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({songKey,...(directorProjectId?{directorProjectId}:{})}),
      });
      const body=await response.json() as Staging;
      if(!response.ok||!body.success||!body.data)throw new Error(body.error||'Draft staging failed');
      setMessage('Social drafts: '+body.data.createdSocialDraftIds.length+
        ' created, '+body.data.preservedSocialDraftIds.length+
        ' preserved. No post or paid campaign started.');
    }catch(error){setMessage(error instanceof Error?error.message:'Draft staging unavailable');}
    finally{setSaving(false);}
  }

  return <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-5 md:p-7"
      aria-label="Music Director Social Ads campaign pipeline">
    <p className="text-[11px] uppercase tracking-[.28em] text-white/40">One catalog · Three connected cores</p>
    <h2 className="mt-2 text-xl font-semibold">Creative campaign workspace</h2>
    <p className="mt-2 text-sm text-white/50">Choose a song, review three differentiated concepts, and save owner-only Social drafts. Director and ads stay behind independent approvals.</p>
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <label className="text-xs text-white/65">Catalog song
        <select value={songKey} onChange={e=>setSongKey(e.target.value)}
          className="mt-2 block w-full rounded-xl border border-white/20 bg-[#12131a] px-3 py-3 text-sm text-white">
          {options.map(s=><option key={s.id} value={String(s.song_key)}>{String(s.title||s.song_key)}</option>)}
        </select>
      </label>
      <label className="text-xs text-white/65">Owned Director project (optional)
        <select value={directorProjectId} onChange={e=>setDirectorProjectId(e.target.value)}
          className="mt-2 block w-full rounded-xl border border-white/20 bg-[#12131a] px-3 py-3 text-sm text-white">
          <option value="">Unbound — concepts only</option>
          {(preview?.directorProjects??[]).map(p=><option key={p.id} value={p.id}>{p.title} ({p.status})</option>)}
        </select>
      </label>
    </div>
    {preview?.directorProjectOptionsState==='unavailable'&&
      <p className="mt-2 text-xs text-amber-200">Director project permission could not be verified; the plan stays unbound.</p>}
    {state==='loading'&&<p className="mt-4 text-sm text-white/45">Checking owner-scoped campaign sources…</p>}
    {preview?.data&&<div className="mt-5 grid gap-3 lg:grid-cols-3">
      {preview.data.variants.map(v=><article key={v.family} className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs text-white/40">{v.family.replaceAll('_',' ')}</p>
        <h3 className="mt-1 text-sm font-medium">{v.label}</h3>
        <p className="mt-2 text-xs leading-5 text-white/60">{v.hypothesis}</p>
        <p className="mt-2 text-xs leading-5 text-white/40">{v.brief.hook}</p>
        <p className="mt-3 text-[11px] text-white/45">{v.directorBrief?'Director brief ready for preview preparation':'Director project required for production brief'}</p>
      </article>)}
    </div>}
    {preview?.data&&<p className="mt-4 text-xs text-amber-200">
      {preview.data.rightsCleared?'Rights evidence present':'Rights require review'} ·
      {preview.data.sectionsReady?' Real song sections available':' Song sections not analyzed'} ·
      {preview.data.directorProjectBound?' Director bound':' Director not bound'} ·
      No publishing/spending authorization
    </p>}
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="button" onClick={()=>void stageDrafts()} disabled={state!=='ready'||saving}
        className="rounded-xl bg-white px-4 py-3 text-xs font-medium text-black disabled:opacity-50">
        {saving?'Saving…':'Save 3 private Social drafts'}
      </button>
      <a href="/director" className="text-xs text-white/60 underline">Director</a>
      <a href="/social" className="text-xs text-white/60 underline">Social</a>
      <a href="/growth/ads" className="text-xs text-white/60 underline">Ad Core</a>
    </div>
    {message&&<p role="status" className="mt-3 text-sm text-white/65">{message}</p>}
  </section>;
}
