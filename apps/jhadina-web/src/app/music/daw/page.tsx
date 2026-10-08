"use client";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { insertMusicDawPlugin,splitMusicDawClip,
  validateMusicDawSession,MUSIC_DAW_WEB_EFFECTS,
  type MusicDawAsset,type MusicDawClip,type MusicDawSession,type MusicDawTrack,
  type MusicDawPluginFormat } from "@jhadina/music-core";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { MusicDawBrowserPreview } from "@/lib/music/music-daw-browser-preview";

type View="tracks"|"mixer"|"effects";
type Case={id:string;title:string;status:string};
type InstalledPlugin={pluginId:string;name:string;format:"vst3"|"au";status:string};
type Data={document:MusicDawSession;assets:MusicDawAsset[];
  urls:Array<{artifactId:string;downloadUrl:string}>;title:string;persisted:boolean};
const time=(v:number)=>Number.isFinite(v)?new Date(Math.max(0,v)*1000).toISOString().slice(14,19):"00:00";
const round=(v:number)=>Math.round(v*100)/100;
const color=["#42bdcf","#a28afa","#e9a66b","#9ddd7e","#dfa7e6"];
const copy=(d:MusicDawSession)=>JSON.parse(JSON.stringify(d)) as MusicDawSession;

export default function MusicDawPage(){
  const [uid,setUid]=useState("");
  const [cases,setCases]=useState<Case[]>([]);
  const [caseId,setCaseId]=useState("");
  const [data,setData]=useState<Data|null>(null);
  const [session,setSession]=useState<MusicDawSession|null>(null);
  const [selected,setSelected]=useState("");
  const [selectedClip,setSelectedClip]=useState("");
  const [view,setView]=useState<View>("tracks");
  const [playhead,setPlayhead]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [status,setStatus]=useState("");
  const [ignorePortrait,setIgnorePortrait]=useState(false);
  const [nativeName,setNativeName]=useState("");
  const [nativeFormat,setNativeFormat]=useState<"vst3"|"au">("vst3");
  const [companionToken,setCompanionToken]=useState("");
  const [nativeCatalog,setNativeCatalog]=useState<InstalledPlugin[]>([]);
  const [catalogStatus,setCatalogStatus]=useState("Native VST host not commissioned");

  const undo=useRef<MusicDawSession[]>([]);
  const player=useRef<MusicDawBrowserPreview|null>(null);
  const track=session?.tracks.find(t=>t.artifactId===selected);
  const clip=track?.clips.find(c=>c.id===selectedClip);
  const duration=useMemo(()=>Math.max(1,...(session?.tracks.flatMap(t=>t.clips.map(c=>c.endSeconds))??[])),[session]);
  const width=Math.min(9500,Math.max(900,Math.round(duration*19)));
  const urls=useMemo(()=>Object.fromEntries((data?.urls??[]).map(x=>[x.artifactId,x.downloadUrl])),[data]);
  useEffect(()=>()=>{void player.current?.stop()},[]);

  const load=useCallback(async(id:string,user:string)=>{
    if(!id)return;
    setBusy(true);
    try{
      const res=await fetch("/api/music/daw/session?caseId="+encodeURIComponent(id),{
        headers:{"x-jhadina-user-id":user},cache:"no-store",
      });
      const body=await res.json();
      if(!res.ok)throw new Error(body.error??"DAW unavailable");
      const next=body as Data;
      setData(next);setSession(next.document);setSelected(next.document.tracks[0]?.artifactId??"");
      setSelectedClip("");undo.current=[];setDirty(false);setPlayhead(0);setCaseId(id);
      setStatus(next.persisted?"Synced latest project revision.":"New edit session. Save to sync your laptop and phone.");
    }catch(e){setStatus(e instanceof Error?e.message:"Unable to open");setSession(null)}
    finally{setBusy(false)}
  },[]);
  useEffect(()=>{
    let alive=true;
    void (async()=>{
      const user=await getCurrentUserId();
      if(!alive)return;
      if(!user){setStatus("Sign in to use your DAW.");return}
      setUid(user);
      try{
        const res=await fetch("/api/music/restoration/studio",{
          headers:{"x-jhadina-user-id":user},cache:"no-store",
        });
        const body=await res.json();
        if(!res.ok)throw new Error(body.error??"Case list unavailable");
        const list=(body.cases??[]) as Case[];
        if(!alive)return;
        setCases(list);
        const requested=new URLSearchParams(window.location.search).get("caseId");
        const chosen=requested&&list.some(c=>c.id===requested)?requested:list[0]?.id;
        if(chosen)await load(chosen,user);
        else setStatus("Import a recording into Restoration Studio first.");
      }catch(e){setStatus(e instanceof Error?e.message:"Could not load projects")}
    })();
    return()=>{alive=false};
  },[load]);

  function edit(fn:(document:MusicDawSession)=>MusicDawSession){
    if(!session||!data)return;
    const old=copy(session),next=fn(copy(session));
    try{validateMusicDawSession(next,session.caseId,data.assets)}
    catch(e){setStatus(e instanceof Error?e.message:"Invalid edit");return}
    undo.current=[...undo.current.slice(-29),old];
    setSession(next);setDirty(true);player.current?.updateSession(next);
  }
  function editTrack(id:string,fn:(t:MusicDawTrack)=>MusicDawTrack){
    edit(d=>({...d,tracks:d.tracks.map(t=>t.artifactId===id?fn(t):t)}));
  }
  function field<K extends keyof MusicDawTrack>(key:K,val:MusicDawTrack[K]){
    if(track)editTrack(track.artifactId,t=>({...t,[key]:val}));
  }
  function clipEdit(fn:(c:MusicDawClip)=>MusicDawClip){
    if(!track||!clip)return;
    editTrack(track.artifactId,t=>({...t,clips:t.clips.map(c=>c.id===clip.id?fn(c):c)}));
  }
  async function save(){
    if(!uid||!session)return;
    setBusy(true);
    try{
      const res=await fetch("/api/music/daw/session",{
        method:"POST",headers:{"content-type":"application/json","x-jhadina-user-id":uid},
        body:JSON.stringify({caseId:session.caseId,expectedRevision:session.revision,
          mutationId:"music-daw:"+crypto.randomUUID(),document:session}),
      });
      const body=await res.json();
      if(!res.ok)throw new Error(body.error??"Save failed");
      setSession(body.document);setDirty(false);
      setStatus("Saved revision "+body.document.revision+" — reopen this project from another device.");
    }catch(e){setStatus(e instanceof Error?e.message:"Save failed; unsaved edits are still here.")}
    finally{setBusy(false)}
  }
  async function play(){
    if(!session)return;
    if(playing){await player.current?.stop();setPlaying(false);return}
    const engine=player.current??new MusicDawBrowserPreview();player.current=engine;
    try{
      await engine.play(session,urls,playhead,(sec,running)=>{setPlayhead(round(sec));setPlaying(running)});
      setPlaying(true);setStatus("Web Audio audition. Restart playback after FX changes. Native plugin slots require a commissioned laptop host.");
    }catch(e){setPlaying(false);setStatus(e instanceof Error?e.message:"Audio preview unavailable")}
  }
  function split(){
    if(!track||!clip)return;
    try{
      const replacement=splitMusicDawClip(track,clip.id,playhead);
      editTrack(track.artifactId,()=>replacement);
      setStatus("Split clip at "+time(playhead)+" without modifying source audio.");
    }catch(e){setStatus(e instanceof Error?e.message:"Select a clip and move the playhead inside it.")}
  }
  async function discoverNativePlugins(){
    if(companionToken.length<24){setCatalogStatus("Enter the laptop companion token locally.");return}
    try{
      // Direct laptop loopback only. Token is never sent to the Jhadina server
      // or persisted into the project/ChatGPT conversation.
      const response=await fetch("http://127.0.0.1:47471/v1/plugins",{
        headers:{"Authorization":"Bearer "+companionToken},cache:"no-store",
      });
      const result=await response.json();
      if(!response.ok||result.schema!=="jhadina-music-daw-local-plugin-scanner/v1"
        ||result.nativeAudioExecutionAvailable!==false||!Array.isArray(result.plugins)){
        throw new Error("Untrusted local plugin scanner receipt");
      }
      const installed=(result.plugins as InstalledPlugin[]).filter(x=>
        /^native-installed:[a-f0-9]{40}$/.test(x.pluginId)&&
        ["vst3","au"].includes(x.format)&&x.status==="discovered-not-executable");
      setNativeCatalog(installed);
      setCatalogStatus(installed.length+" installed plugin bundles detected. DSP execution not commissioned.");
    }catch(error){
      setNativeCatalog([]);
      setCatalogStatus("Laptop scanner not connected or blocked. Run the read-only companion locally and allow its exact app origin.");
    }
  }
  function addFx(format:MusicDawPluginFormat,id:string,name:string){
    if(!track)return;
    try{
      editTrack(track.artifactId,t=>insertMusicDawPlugin(t,{
        id:"slot:"+crypto.randomUUID(),pluginId:id,name,format,
      }));
      setNativeName("");
      setStatus(format==="web-audio"?"Web effect added. Restart audition to hear it.":"Native plugin slot saved. VST3/AU execution needs an approved desktop companion, not a browser.");
    }catch(e){setStatus(e instanceof Error?e.message:"Plugin rejected")}
  }
  function rack(index:number,fn:(p:NonNullable<MusicDawTrack["pluginRack"]>[number])=>
    NonNullable<MusicDawTrack["pluginRack"]>[number]){
    if(!track)return;
    editTrack(track.artifactId,t=>({...t,pluginRack:(t.pluginRack??[]).map((p,i)=>i===index?fn(p):p)}));
  }
  const maxSolo=session?.tracks.some(t=>t.solo&&!t.mute)??false;
  const heard=(t:MusicDawTrack)=>!t.mute&&(!maxSolo||t.solo);

  return <main className="min-h-[100dvh] bg-[#090b12] text-[#ecf0f8]">
    {!ignorePortrait&&<div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-[#090b12] p-8 text-center md:hidden landscape:hidden">
      <div className="text-5xl">↻</div><h2 className="text-2xl font-semibold">Rotate to landscape</h2>
      <p className="max-w-sm text-sm text-white/60">Jhadina’s BandLab-style phone/tablet DAW is designed to be used horizontally, with a larger Logic-style workspace on laptop.</p>
      <button onClick={()=>setIgnorePortrait(true)} className="rounded-xl border border-white/20 px-4 py-2 text-xs">Continue portrait temporarily</button>
    </div>}
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#141825] px-3 py-2 lg:px-6">
      <a href="/music/restoration" className="text-xs text-white/55">← Restoration</a>
      <span className="mr-2 border-l border-white/15 pl-3 text-xs font-semibold">JHADINA <span className="text-cyan-300">DAW</span></span>
      <select value={caseId} onChange={e=>{void player.current?.stop();setPlaying(false);void load(e.target.value,uid)}} className="max-w-48 rounded-lg bg-[#252b3c] px-2 py-2 text-xs">
        {cases.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}
      </select>
      <button onClick={()=>void play()} disabled={!session||busy} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#09111c] disabled:opacity-30">{playing?"Pause":"▶ Play"}</button>
      <button onClick={()=>{void player.current?.stop();setPlaying(false);setPlayhead(0)}} className="rounded-lg border border-white/15 px-2 py-2 text-xs">■</button>
      <span className="font-mono text-sm">{time(playhead)}</span>
      <button onClick={split} disabled={!clip||busy} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">Split ✂</button>
      <button onClick={()=>{const v=undo.current.pop();if(v){setSession(v);setDirty(true)}}} disabled={!undo.current.length||busy} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">↶ Undo</button>
      <button onClick={()=>void save()} disabled={!dirty||busy} className="ml-auto rounded-lg bg-[#8979e9] px-4 py-2 text-xs font-semibold disabled:opacity-35">{dirty?"Save ●":"Saved ✓"}</button>
    </header>
    <div className="flex items-center justify-between border-b border-white/10 bg-[#111521] px-4 py-2 text-xs">
      <div className="flex gap-1">{(["tracks","mixer","effects"] as View[]).map(v=><button key={v} onClick={()=>setView(v)}
        className={"rounded-lg px-3 py-2 capitalize "+(view===v?"bg-[#39465b]":"text-white/50")}>{v}</button>)}</div>
      <span className="truncate text-white/45">{data?.title??"Select a recording"} · revision {session?.revision??0} · {session?.tracks.length??0} channels</span>
    </div>
    {status&&<p role="status" className="border-b border-white/10 bg-[#15202c] px-4 py-2 text-xs text-cyan-200/85">{status}</p>}
    {!session?<section className="p-8 text-sm text-white/60">Open an existing restoration project. No source will be overwritten.</section>:
      <div className="flex flex-col lg:flex-row">
        <section className="min-w-0 flex-1">
          {view==="tracks"&&<div className="max-h-[62dvh] overflow-auto bg-[#0e111a] lg:max-h-[calc(100dvh-165px)]">
            <div style={{width:width+200}}>
              <div className="sticky top-0 z-20 flex h-9 bg-[#202534]">
                <div className="sticky left-0 z-30 w-[200px] shrink-0 border-r border-white/10 bg-[#202534] px-3 py-2 text-[11px] text-white/50">Track controls</div>
                <button style={{width}} className="relative cursor-crosshair text-left" onClick={e=>{
                  const b=e.currentTarget.getBoundingClientRect();
                  setPlayhead(round((e.clientX-b.left)/b.width*duration));
                }}>
                  {Array.from({length:11},(_,i)=><span key={i} className="absolute top-2 text-[10px] text-white/45" style={{left:i*10+"%"}}>{time(duration*i/10)}</span>)}
                </button>
              </div>
              {session.tracks.map((t,i)=><div className="flex h-16 border-b border-white/[.06]" key={t.artifactId}>
                <div className={"sticky left-0 z-10 flex w-[200px] shrink-0 items-center gap-2 px-2 "+(selected===t.artifactId?"bg-[#29334a]":"bg-[#181d29]")}>
                  <button className="min-w-0 flex-1 text-left" onClick={()=>{setSelected(t.artifactId);setSelectedClip(t.clips[0]?.id??"")}}>
                    <span className="block truncate text-xs font-medium">{t.name}</span><span className="text-[10px] text-white/40">{heard(t)?"Audio":"Muted"}</span>
                  </button>
                  <button onClick={()=>editTrack(t.artifactId,x=>({...x,mute:!x.mute}))} className={"rounded p-1 text-[10px] "+(t.mute?"bg-amber-500 text-black":"bg-white/10")}>M</button>
                  <button onClick={()=>editTrack(t.artifactId,x=>({...x,solo:!x.solo}))} className={"rounded p-1 text-[10px] "+(t.solo?"bg-cyan-400 text-black":"bg-white/10")}>S</button>
                </div>
                <div className="relative bg-[repeating-linear-gradient(to_right,transparent_0,transparent_79px,rgba(255,255,255,.04)_80px)]" style={{width}}>
                  {t.clips.map(c=><button key={c.id} onClick={()=>{setSelected(t.artifactId);setSelectedClip(c.id);setPlayhead(round(c.startSeconds))}}
                    style={{left:c.startSeconds/duration*100+"%",width:(c.endSeconds-c.startSeconds)/duration*100+"%",background:color[i%color.length]}}
                    className={"absolute inset-y-2 overflow-hidden rounded border-2 px-2 text-left text-xs text-[#101423] "+(selected===t.artifactId&&selectedClip===c.id?"border-white":"border-transparent")}
                    title={t.name+" "+time(c.startSeconds)+"-"+time(c.endSeconds)}>
                    <span className="block truncate font-medium">{t.name}</span><span className="text-[10px]">▥▥▥▥▥▥▥▥▥</span>
                  </button>)}
                  <span className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-white/70" style={{left:playhead/duration*100+"%"}}/>
                </div>
              </div>)}
            </div>
          </div>}
          {view==="mixer"&&<div className="flex min-h-[310px] gap-2 overflow-x-auto p-3">
            {session.tracks.map((t,i)=><div key={t.artifactId} className={"flex w-28 shrink-0 flex-col items-center rounded-xl border p-3 "+(selected===t.artifactId?"border-cyan-400/70 bg-[#263045]":"border-white/10 bg-[#181d29]")}>
              <button onClick={()=>setSelected(t.artifactId)} className="w-full truncate text-center text-xs">{t.name}</button>
              <div className="mt-2 h-1 w-full rounded" style={{background:color[i%color.length]}}/>
              <span className="mt-3 text-xs">{t.gainDb.toFixed(1)} dB</span>
              <input aria-label={t.name+" gain"} type="range" min="-60" max="12" step=".5" value={t.gainDb}
                onChange={e=>editTrack(t.artifactId,x=>({...x,gainDb:Number(e.target.value)}))}
                className="my-4 h-36 w-8 [writing-mode:vertical-lr] [direction:rtl] accent-cyan-400"/>
              <span className="text-[11px] text-white/50">Pan {t.pan.toFixed(1)}</span>
              <div className="mt-2 flex gap-2"><button onClick={()=>editTrack(t.artifactId,x=>({...x,mute:!x.mute}))} className="text-xs">M</button><button onClick={()=>editTrack(t.artifactId,x=>({...x,solo:!x.solo}))} className="text-xs">S</button></div>
            </div>)}
          </div>}
          {view==="effects"&&<div className="space-y-4 p-5">
            <h2 className="text-lg font-semibold">FX rack · {track?.name??"Select track"}</h2>
            <p className="text-sm text-white/55">Built-in web effects run on phone and laptop. VST3/AU slots persist with the project, but need a trusted native desktop host to execute.</p>
            <div className="flex flex-wrap gap-2">{MUSIC_DAW_WEB_EFFECTS.map(x=><button key={x.pluginId} onClick={()=>addFx(x.format,x.pluginId,x.name)} className="rounded-lg border border-cyan-400/40 px-3 py-2 text-sm">+ {x.name}</button>)}</div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 p-3">
              <select value={nativeFormat} onChange={e=>setNativeFormat(e.target.value as "vst3"|"au")} className="rounded bg-[#252c3b] p-2 text-sm"><option value="vst3">VST3</option><option value="au">Audio Unit (Mac)</option></select>
              <input value={nativeName} onChange={e=>setNativeName(e.target.value)} placeholder="Installed plugin name or ID" className="min-w-40 flex-1 rounded bg-[#252c3b] p-2 text-sm"/>
              <button disabled={!nativeName.trim()} onClick={()=>addFx(nativeFormat,nativeName.trim(),nativeName.trim())} className="rounded bg-[#34405b] px-3 py-2 text-sm disabled:opacity-30">Add native slot</button>
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <h3 className="text-sm font-semibold">Discover installed plugins on this laptop</h3>
              <p className="mt-1 text-xs text-white/50">Requires the opt-in loopback-only scanner in services/music-daw-companion. Scan runs on this laptop; the token stays only in this browser session.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input type="password" autoComplete="off" value={companionToken} onChange={e=>setCompanionToken(e.target.value)}
                  placeholder="Companion token (never share)" className="min-w-36 flex-1 rounded bg-[#252c3b] p-2 text-xs"/>
                <button type="button" onClick={()=>void discoverNativePlugins()} className="rounded border border-cyan-400/40 px-3 py-2 text-xs">Scan this laptop</button>
              </div>
              <p className="mt-2 text-xs text-white/50">{catalogStatus}</p>
              <div className="mt-2 flex flex-wrap gap-2">{nativeCatalog.map(p=>
                <button key={p.pluginId} onClick={()=>addFx(p.format,p.pluginId,p.name)}
                  className="rounded border border-white/20 px-3 py-2 text-xs">+ {p.name} · {p.format.toUpperCase()}</button>)}</div>
            </div>
            <p className="text-xs text-amber-200">No VST binary is executed or uploaded by the browser. Native render/scan is a separate commissioning gate.</p>
          </div>}
        </section>
        <aside className="w-full shrink-0 space-y-4 border-t border-white/10 bg-[#171b29] p-4 lg:min-h-[calc(100dvh-165px)] lg:w-[320px] lg:border-l lg:border-t-0">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/55">Channel inspector</h2>
          {track?<>
            <label className="block text-xs text-white/50">Name<input value={track.name} onChange={e=>field("name",e.target.value)} className="mt-1 w-full rounded bg-[#252c3b] p-2 text-sm"/></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-white/50">Gain dB<input type="number" min="-60" max="12" step=".5" value={track.gainDb} onChange={e=>field("gainDb",Number(e.target.value))} className="mt-1 w-full rounded bg-[#252c3b] p-2"/></label>
              <label className="text-xs text-white/50">Pan ±1<input type="number" min="-1" max="1" step=".1" value={track.pan} onChange={e=>field("pan",Number(e.target.value))} className="mt-1 w-full rounded bg-[#252c3b] p-2"/></label>
            </div>
            <div className="grid grid-cols-3 gap-2">{(["lowDb","midDb","highDb"] as const).map(k=><label key={k} className="text-[11px] text-white/55">{k==="lowDb"?"Low":k==="midDb"?"Mid":"High"} EQ<input type="number" min="-18" max="18" step=".5" value={track.eq[k]} onChange={e=>field("eq",{...track.eq,[k]:Number(e.target.value)})} className="mt-1 w-full rounded bg-[#252c3b] p-2 text-xs"/></label>)}</div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={track.compressor.enabled} onChange={e=>field("compressor",{...track.compressor,enabled:e.target.checked})}/> Compressor</label>
            {track.compressor.enabled&&<div className="grid grid-cols-2 gap-2">
              <label className="text-xs">Threshold<input type="number" min="-60" max="0" value={track.compressor.thresholdDb} onChange={e=>field("compressor",{...track.compressor,thresholdDb:Number(e.target.value)})} className="mt-1 w-full rounded bg-[#252c3b] p-2"/></label>
              <label className="text-xs">Ratio<input type="number" min="1" max="12" step=".5" value={track.compressor.ratio} onChange={e=>field("compressor",{...track.compressor,ratio:Number(e.target.value)})} className="mt-1 w-full rounded bg-[#252c3b] p-2"/></label></div>}
            <div className="border-t border-white/10 pt-3"><div className="flex justify-between text-xs font-semibold"><span>Plugins & effects</span><button onClick={()=>setView("effects")} className="text-cyan-300">+ Add</button></div>
              {(track.pluginRack??[]).map((fx,i)=><div key={fx.id} className="mt-2 rounded-lg border border-white/10 p-2">
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={fx.enabled} onChange={e=>rack(i,p=>({...p,enabled:e.target.checked}))}/><span className="min-w-0 flex-1 truncate">{fx.name}</span><span className="text-white/45">{fx.format}</span></label>
                <p className="mt-1 text-[10px] text-white/45">{fx.format==="web-audio"?"Browser ready":"Desktop host needed"}</p>
                {Object.entries(fx.parameters).map(([k,v])=><label key={k} className="mt-1 flex items-center justify-between gap-2 text-[11px]">{k}<input type="number" step=".01" value={v} onChange={e=>rack(i,p=>({...p,parameters:{...p.parameters,[k]:Number(e.target.value)}}))} className="w-20 rounded bg-[#252c3b] p-1.5"/></label>)}
                <button onClick={()=>editTrack(track.artifactId,t=>({...t,pluginRack:(t.pluginRack??[]).filter(p=>p.id!==fx.id)}))} className="mt-2 text-[11px] text-rose-300">Remove slot</button>
              </div>)}
            </div>
            {clip&&<div className="border-t border-white/10 pt-3"><p className="text-xs font-semibold">Clip · non-destructive</p>
              <div className="mt-2 grid grid-cols-2 gap-2">{(["startSeconds","endSeconds","sourceOffsetSeconds","fadeInSeconds","fadeOutSeconds"] as const).map(k=><label key={k} className="text-[11px] text-white/50">{k.replace("Seconds","")}<input type="number" step=".05" min="0" value={round(clip[k])} onChange={e=>clipEdit(c=>({...c,[k]:Number(e.target.value)}))} className="mt-1 w-full rounded bg-[#252c3b] p-2 text-xs"/></label>)}</div>
            </div>}
          </>:<p className="text-xs text-white/50">Select a track or separated stem.</p>}
          <p className="border-t border-white/10 pt-3 text-[11px] leading-5 text-white/45">Non-destructive source-bound edits. Web audio preview is not a final rendered master. Native plugins require host and licensing proofs. Save to continue on another device.</p>
        </aside>
      </div>}
  </main>;
}
