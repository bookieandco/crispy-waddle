"use client";
import { useCallback,useEffect,useMemo,useRef,useState,
  type PointerEvent as ReactPointerEvent } from "react";
import { initializeMusicDawSession,insertMusicDawPlugin,splitMusicDawClip,
  moveMusicDawClip, duplicateMusicDawClip, trimMusicDawClipStart,
  validateMusicDawSession,MUSIC_DAW_WEB_EFFECTS,
  renderMusicDawBrowserDryWav,buildRestorationZip,sampleMusicDawClipWaveform,
  type MusicDawAsset,type MusicDawClip,type MusicDawSession,type MusicDawTrack,
  type MusicDawPluginFormat,type MusicDawWaveformEnvelope } from "@jhadina/music-core";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { MusicDawBrowserPreview } from "@/lib/music/music-daw-browser-preview";
import { renderLocalInstalledDawEffect } from "@/lib/music/music-daw-native-client";
import { loadVerifiedMusicDawWaveform } from "@/lib/music/music-daw-waveform-client";

type View="tracks"|"mixer"|"effects";
type Case={id:string;title:string;status:string};
type InstalledPlugin={pluginId:string;name:string;format:"vst3"|"au";status:string};
type Data={document:MusicDawSession;assets:MusicDawAsset[];
  urls:Array<{artifactId:string;downloadUrl:string}>;title:string;persisted:boolean};
const time=(v:number)=>Number.isFinite(v)?new Date(Math.max(0,v)*1000).toISOString().slice(14,19):"00:00";
const round=(v:number)=>Math.round(v*100)/100;
const color=["#42bdcf","#a28afa","#e9a66b","#9ddd7e","#dfa7e6"];
const copy=(d:MusicDawSession)=>JSON.parse(JSON.stringify(d)) as MusicDawSession;
function ClipWaveform({clip,envelope,loading,unavailable}:{
 clip:MusicDawClip;envelope?:MusicDawWaveformEnvelope;loading:boolean;unavailable:boolean;
}){
 if(!envelope)return <span className="absolute bottom-0.5 left-2 truncate text-[9px] opacity-60">
  {loading?"Reading audio…":unavailable?"WAV waveform unavailable":"Select to load waveform"}</span>;
 const bars=sampleMusicDawClipWaveform(envelope,clip,96);
 return <svg aria-label="SHA-verified source waveform" className="pointer-events-none absolute inset-x-0 bottom-0.5 h-8 w-full opacity-75"
   viewBox="0 0 96 36" preserveAspectRatio="none">{bars.map((v,i)=>
   <line key={i} x1={i+.5} x2={i+.5}
     y1={18-Math.max(0,v.high)*16}
     y2={Math.max(19-Math.max(0,v.high)*16,18-Math.min(0,v.low)*16)}
     stroke="currentColor" strokeWidth=".8"/>)}</svg>;
}

export default function MusicDawPage(){
  const [uid,setUid]=useState("");
  const [cases,setCases]=useState<Case[]>([]);
  const [caseId,setCaseId]=useState("");
  const [data,setData]=useState<Data|null>(null);
  const [session,setSession]=useState<MusicDawSession|null>(null);
  const [selected,setSelected]=useState("");
  const [selectedClip,setSelectedClip]=useState("");
  const [view,setView]=useState<View>("tracks");
  const [snapMode,setSnapMode]=useState<"off"|"beat"|"eighth"|"sixteenth">("off");
  const [playhead,setPlayhead]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [busy,setBusy]=useState(false);
  const [bouncing,setBouncing]=useState(false);
  const [quickExport,setQuickExport]=useState<{url:string;fileName:string}|null>(null);
  const quickObjectUrl=useRef<string|null>(null);
  const [dirty,setDirty]=useState(false);
  const [status,setStatus]=useState("");
  const [ignorePortrait,setIgnorePortrait]=useState(false);
  const [nativeName,setNativeName]=useState("");
  const [nativeFormat,setNativeFormat]=useState<"vst3"|"au">("vst3");
  const [companionToken,setCompanionToken]=useState("");
  const [nativeCatalog,setNativeCatalog]=useState<InstalledPlugin[]>([]);
  const [catalogStatus,setCatalogStatus]=useState("Native VST host not commissioned");
  const [nativeRenderReady,setNativeRenderReady]=useState(false);
  const [nativeApproval,setNativeApproval]=useState(false);
  const [nativeSelectedSlotId,setNativeSelectedSlotId]=useState("");
  const [nativeBusy,setNativeBusy]=useState(false);
  const [nativeCandidate,setNativeCandidate]=useState<{
    wav:Blob;receipt:Record<string,unknown>;sourceSha256:string;
    outputSha256:string;pluginId:string;parentId:string;
  }|null>(null);
  const [privateImportApproved,setPrivateImportApproved]=useState(false);
  const [waveforms,setWaveforms]=useState<Record<string,MusicDawWaveformEnvelope>>({});
  const [waveUnavailable,setWaveUnavailable]=useState<Record<string,boolean>>({});
  const [waveLoading,setWaveLoading]=useState<string[]>([]);
  const waveCache=useRef<Map<string,MusicDawWaveformEnvelope>>(new Map());
  const clipPointer=useRef<{clipId:string;trackId:string;pointerId:number;
    x:number;y:number;startSeconds:number}|null>(null);
  const suppressClickAfterDrag=useRef(false);

  const undo=useRef<MusicDawSession[]>([]);
  const player=useRef<MusicDawBrowserPreview|null>(null);
  const track=session?.tracks.find(t=>t.artifactId===selected);
  const clip=track?.clips.find(c=>c.id===selectedClip);
  const duration=useMemo(()=>Math.max(1,...(session?.tracks.flatMap(t=>t.clips.map(c=>c.endSeconds))??[])),[session]);
  const width=Math.min(9500,Math.max(900,Math.round(duration*19)));
  const urls=useMemo(()=>Object.fromEntries((data?.urls??[]).map(x=>[x.artifactId,x.downloadUrl])),[data]);
  useEffect(()=>()=>{void player.current?.stop();
    if(quickObjectUrl.current)URL.revokeObjectURL(quickObjectUrl.current);
  },[]);

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
      setNativeCandidate(null);setNativeApproval(false);setPrivateImportApproved(false);
      if(quickObjectUrl.current)URL.revokeObjectURL(quickObjectUrl.current);
      quickObjectUrl.current=null;setQuickExport(null);
      waveCache.current.clear();setWaveforms({});setWaveUnavailable({});setWaveLoading([]);
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

  useEffect(()=>{
    if(!data)return;
    let alive=true;
    const abort=new AbortController();
    const targets=[...new Set([selected,...data.assets.filter(a=>["audio/wav","audio/x-wav"]
      .includes(a.mimeType.toLowerCase())).slice(0,4).map(a=>a.id)])].filter(Boolean);
    void (async()=>{
      for(const id of targets){
        if(!alive)break;
        if(waveCache.current.has(id))continue;
        const asset=data.assets.find(a=>a.id===id);
        const url=data.urls.find(u=>u.artifactId===id)?.downloadUrl;
        if(!asset||!url||!["audio/wav","audio/x-wav"].includes(asset.mimeType.toLowerCase())){
          if(alive)setWaveUnavailable(prev=>({...prev,[id]:true}));
          continue;
        }
        setWaveLoading(prev=>prev.includes(id)?prev:[...prev,id]);
        try{
          const envelope=await loadVerifiedMusicDawWaveform(asset,url,abort.signal);
          if(!alive)break;
          waveCache.current.set(id,envelope);
          setWaveforms(prev=>({...prev,[id]:envelope}));
        }catch{
          if(alive&&!abort.signal.aborted)setWaveUnavailable(prev=>({...prev,[id]:true}));
        }finally{
          if(alive)setWaveLoading(prev=>prev.filter(x=>x!==id));
        }
      }
    })();
    return ()=>{alive=false;abort.abort()};
  },[data,selected]);

  function edit(fn:(document:MusicDawSession)=>MusicDawSession){
    if(!session||!data)return;
    const old=copy(session),next=fn(copy(session));
    try{validateMusicDawSession(next,session.caseId,data.assets)}
    catch(e){setStatus(e instanceof Error?e.message:"Invalid edit");return}
    undo.current=[...undo.current.slice(-29),old];
    if(quickObjectUrl.current)URL.revokeObjectURL(quickObjectUrl.current);
    quickObjectUrl.current=null;setQuickExport(null);
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
  async function quickDryBounce(){
    if(!session||!data||dirty||busy||bouncing||session.revision<1){
      setStatus("Save the current revision before exporting its dry mix.");
      return;
    }
    setBouncing(true);
    if(quickObjectUrl.current)URL.revokeObjectURL(quickObjectUrl.current);
    quickObjectUrl.current=null;setQuickExport(null);
    try{
      const solo=session.tracks.some(t=>t.solo&&!t.mute);
      const audible=session.tracks.filter(t=>!t.mute&&(!solo||t.solo)&&t.clips.length>0);
      if(!audible.length||audible.length>8)
        throw new Error("Quick bounce supports up to eight audible stems. Use the laptop's full-length renderer for larger mixes.");
      const sourceBytes:Record<string,Uint8Array>={};
      let total=0;
      for(const track of audible){
        const url=urls[track.artifactId];
        if(!url)throw new Error("Missing private WAV download for "+track.name);
        const response=await fetch(url,{cache:"no-store"});
        if(!response.ok)throw new Error("Private audio download failed; reopen your project to renew its signed link.");
        const claimed=Number(response.headers.get("content-length")||0);
        if(claimed>32*1024*1024-total)throw new Error("Too much audio for phone memory; use laptop full-length export.");
        const bytes=new Uint8Array(await response.arrayBuffer());
        total+=bytes.byteLength;
        if(total>32*1024*1024)throw new Error("Phone memory budget exceeded; use laptop full-length export.");
        sourceBytes[track.artifactId]=bytes;
      }
      const {bytes,receipt}=await renderMusicDawBrowserDryWav(session,data.assets,sourceBytes);
      const contents=buildRestorationZip([
        {path:"dry-mix.wav",data:bytes},
        {path:"dry-mix-receipt.json",data:JSON.stringify(receipt,null,2)+"\n"},
        {path:"READ-ME.txt",data:"Jhadina DAW local dry bounce — real FLOAT32 WAV audio\n"+
          "All input stems were SHA-256 checked against this saved edit revision.\n"+
          "Only time edits, gain/pan, fades, mute/solo and gain/pan keyframe automation are rendered.\n"+
          "No plugin, EQ or compressor was run. Active DSP prevents this export.\n"+
          "The original files remain unchanged. Audition before using or sharing this mix.\n"},
      ]);
      const ab=new ArrayBuffer(contents.byteLength);
      new Uint8Array(ab).set(contents);
      const blob=new Blob([ab],{type:"application/zip"});
      const address=URL.createObjectURL(blob);
      quickObjectUrl.current=address;
      // An explicit second tap is essential on iOS Safari, which may block
      // downloads initiated after awaited fetch / rendering work.
      setQuickExport({url:address,fileName:"jhadina-dry-mix-rev-"+session.revision+".zip"});
      setStatus("Rendered a real WAV locally. Tap Download rendered WAV ZIP. SHA "+receipt.outputSha256.slice(0,14)+
        "… · peak "+receipt.peak.toFixed(3)+
        (receipt.peakAboveFullScale?" · WARNING peak above digital full scale":"")+
        ". Listen and review before using. Nothing was uploaded.");
    }catch(error){
      setStatus(error instanceof Error?error.message:"Local dry bounce failed");
    }finally{setBouncing(false)}
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
  function clipPointerDown(e:ReactPointerEvent<HTMLButtonElement>,trackId:string,c:MusicDawClip){
    if(e.pointerType==="mouse"&&e.button!==0)return;
    suppressClickAfterDrag.current=false;
    clipPointer.current={pointerId:e.pointerId,clipId:c.id,trackId,
      x:e.clientX,y:e.clientY,startSeconds:c.startSeconds};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function clipPointerUp(e:ReactPointerEvent<HTMLButtonElement>,trackId:string,c:MusicDawClip){
    const initial=clipPointer.current;
    clipPointer.current=null;
    if(!initial||initial.pointerId!==e.pointerId||initial.trackId!==trackId||
       initial.clipId!==c.id)return;
    const dx=e.clientX-initial.x,dy=e.clientY-initial.y;
    if(Math.abs(dx)<9 || Math.abs(dy)>Math.max(60,Math.abs(dx)*1.5))return;
    suppressClickAfterDrag.current=true;
    const stem=session?.tracks.find(t=>t.artifactId===trackId);
    const rate=data?.assets.find(a=>a.id===trackId)?.sampleRate;
    if(!stem||!rate)return;
    const snap=session?.tempoBpm&&snapMode!=="off"
      ? 60/session.tempoBpm/(snapMode==="beat"?1:snapMode==="eighth"?2:4):0;
    try{
      const position=Math.max(0,initial.startSeconds+(dx/width)*duration);
      const moved=moveMusicDawClip(stem,c.id,position,rate,snap);
      editTrack(trackId,()=>moved);
      setSelected(trackId);setSelectedClip(c.id);
      setStatus("Clip moved on the "+(snapMode==="off"?"sample grid":snapMode+" grid")+
        ". Original stem audio remains unchanged. Save to sync this arrangement.");
    }catch(error){
      setStatus(error instanceof Error?error.message:"Clip move blocked by overlap or source boundary");
    }
  }

  function positionClip(action:"move"|"copy"|"trim"){
    if(!track||!clip||!data)return;
    const sr=data.assets.find(x=>x.id===track.artifactId)?.sampleRate;
    if(!sr){setStatus("Stem sample rate is missing");return}
    const snap=session?.tempoBpm&&snapMode!=="off"
      ? 60/session.tempoBpm/(snapMode==="beat"?1:snapMode==="eighth"?2:4)
      : 0;
    try{
      let updated:MusicDawTrack;
      let nextId=clip.id;
      if(action==="move")updated=moveMusicDawClip(track,clip.id,playhead,sr,snap);
      else if(action==="copy"){
        nextId="copy:"+crypto.randomUUID();
        updated=duplicateMusicDawClip(track,clip.id,nextId,playhead,sr,snap);
      }else updated=trimMusicDawClipStart(track,clip.id,playhead,sr);
      editTrack(track.artifactId,()=>updated);
      setSelectedClip(nextId);
      setStatus((action==="move"?"Moved":action==="copy"?"Duplicated":"Trimmed")+" clip at playhead without changing original stem bytes.");
    }catch(error){
      setStatus(error instanceof Error?error.message:"Invalid clip edit");
    }
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
        ||typeof result.nativeAudioExecutionAvailable!=="boolean"||!Array.isArray(result.plugins)){
        throw new Error("Untrusted local plugin scanner receipt");
      }
      const installed=(result.plugins as InstalledPlugin[]).filter(x=>
        /^native-installed:[a-f0-9]{40}$/.test(x.pluginId)&&
        ["vst3","au"].includes(x.format)&&x.status==="discovered-not-executable");
      setNativeCatalog(installed);
      setNativeRenderReady(result.renderReady===true&&result.nativeAudioExecutionAvailable===true);
      setCatalogStatus(installed.length+" installed plugin bundles detected. "+
        (result.renderReady===true?"Optional owner-installed render engine enabled; use only trusted plugins.":"Native DSP not yet enabled on this laptop."));
    }catch(error){
      setNativeCatalog([]);
      setNativeRenderReady(false);
      setCatalogStatus("Laptop scanner not connected or blocked. Run the laptop companion locally with approved app origin.");
    }
  }
  async function addNewSeparatedStems(){
    if(!uid||!session||!data)return;
    try{
      const response=await fetch("/api/music/daw/session?caseId="+encodeURIComponent(session.caseId),{
        headers:{"x-jhadina-user-id":uid},cache:"no-store",
      });
      const latest=await response.json() as Data&{success:boolean;error?:string};
      if(!response.ok)throw new Error(latest.error??"Unable to refresh stems");
      if(latest.document.revision!==session.revision){
        throw new Error("Another device saved a new revision. Save or reconcile your current edit before importing.");
      }
      const known=new Set(session.tracks.map(t=>t.artifactId));
      const missing=latest.assets.filter(a=>a.mimeType.startsWith("audio/")&&
        !["audio/midi","audio/x-midi"].includes(a.mimeType.toLowerCase())&&!known.has(a.id));
      if(!missing.length){setStatus("All available separated audio stems are already in your project.");return}
      const fresh=initializeMusicDawSession(session.caseId,missing).tracks.map(t=>({...t,mute:true}));
      const next={...session,tracks:[...session.tracks,...fresh]};
      validateMusicDawSession(next,session.caseId,latest.assets);
      undo.current=[...undo.current.slice(-29),copy(session)];
      setData({...latest});setSession(next);setDirty(true);
      setStatus(missing.length+" newly separated stem(s) imported muted. Unmute and mix, then save to sync devices.");
    }catch(e){setStatus(e instanceof Error?e.message:"Stem import blocked")}
  }
  async function renderLocalPlugin(){
    if(!track||!nativeApproval||!nativeRenderReady||!data)return;
    const plugin=(track.pluginRack??[]).find(p=>p.enabled&&
      p.id===nativeSelectedSlotId&&/^native-installed:[a-f0-9]{40}$/.test(p.pluginId));
    if(!plugin){setStatus("Select a track with an installed scanned VST3/AU plugin.");return}
    const asset=data.assets.find(x=>x.id===track.artifactId);
    if(asset?.mimeType!=="audio/wav"){
      setStatus("Only source-bound WAV stems are admitted for local native rendering.");return}
    const url=urls[track.artifactId];
    if(!url){setStatus("Private source URL unavailable");return}
    setNativeBusy(true);
    try{
      const output=await renderLocalInstalledDawEffect({
        url,sourceSha256:track.sourceSha256,plugin,
        companionToken,ownerApproved:true,
      });
      setNativeCandidate({...output,parentId:track.artifactId});
      setNativeApproval(false);setPrivateImportApproved(false);
      setStatus("Local plugin render complete and SHA verified. Audition/download candidate, or separately approve private case import.");
    }catch(e){setStatus(e instanceof Error?e.message:"Native render unavailable")}
    finally{setNativeBusy(false)}
  }
  function downloadCandidate(){
    if(!nativeCandidate)return;
    const url=URL.createObjectURL(nativeCandidate.wav);
    const a=document.createElement("a");a.href=url;a.download="Jhadina-native-fx-candidate.wav";
    a.click();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function importNativeCandidate(){
    if(!nativeCandidate||!session||!uid||!privateImportApproved||dirty)return;
    setNativeBusy(true);
    try{
      const form=new FormData();
      form.set("audio",nativeCandidate.wav,"plugin-processed.wav");
      form.set("caseId",session.caseId);
      form.set("parentArtifactId",nativeCandidate.parentId);
      form.set("pluginId",nativeCandidate.pluginId);
      form.set("sourceSha256",nativeCandidate.sourceSha256);
      form.set("renderedSha256",nativeCandidate.outputSha256);
      form.set("ownerApproved","YES");
      form.set("localReceipt",JSON.stringify(nativeCandidate.receipt));
      const response=await fetch("/api/music/daw/native-render",{
        method:"POST",headers:{"x-jhadina-user-id":uid},body:form,
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error??"Private processed-stem import failed");
      setNativeCandidate(null);setPrivateImportApproved(false);
      setStatus("Processed stem saved privately as an unverified candidate. Select + New stems to bring it into the edit timeline.");
    }catch(e){setStatus(e instanceof Error?e.message:"Import failed")}
    finally{setNativeBusy(false)}
  }

  function insertAutomation(lane:"gainDb"|"pan"){
    if(!track)return;
    const value=lane==="gainDb"?track.gainDb:track.pan;
    const atSeconds=round(playhead);
    editTrack(track.artifactId,t=>{
      const old=t.automation?.[lane]??[];
      const points=[...old.filter(p=>Math.abs(p.atSeconds-atSeconds)>.00001),
                    {atSeconds,value}].sort((a,b)=>a.atSeconds-b.atSeconds);
      return {...t,automation:{...t.automation,[lane]:points}};
    });
    setStatus("Automation keyframe added at "+time(atSeconds)+". Saved edit renders with sample-time interpolation.");
  }
  function editAutomation(lane:"gainDb"|"pan",index:number,
    point:{atSeconds:number;value:number}|null){
    if(!track)return;
    editTrack(track.artifactId,t=>{
      const list=[...(t.automation?.[lane]??[])];
      if(point===null)list.splice(index,1);
      else list[index]=point;
      list.sort((a,b)=>a.atSeconds-b.atSeconds);
      return {...t,automation:{...t.automation,[lane]:list}};
    });
  }

  function addFx(format:MusicDawPluginFormat,id:string,name:string){
    if(!track)return;
    try{
      const slotId="slot:"+crypto.randomUUID();
      editTrack(track.artifactId,t=>insertMusicDawPlugin(t,{
        id:slotId,pluginId:id,name,format,
      }));
      setNativeApproval(false);
      if(format!=="web-audio")setNativeSelectedSlotId(slotId);
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
    {!ignorePortrait&&<div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-[#090b12] p-8 text-center xl:hidden landscape:hidden">
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
      <button onClick={()=>void quickDryBounce()} disabled={!session||busy||dirty||bouncing}
        title="CPU-only dry WAV with verified source SHA and output receipt. Maximum 60 seconds and eight stems; active DSP blocks export."
        className="rounded-lg border border-cyan-400/40 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-100 disabled:opacity-30">
        {bouncing?"Rendering…":"Quick dry WAV"}
      </button>
      {quickExport&&<a href={quickExport.url} download={quickExport.fileName}
        className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-[#06131b]">
        Download rendered WAV ZIP ↓
      </a>}
      <button onClick={()=>void addNewSeparatedStems()} disabled={!session||busy} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">+ New stems</button>
      <button onClick={split} disabled={!clip||busy} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">Split ✂</button>
      <button onClick={()=>positionClip("move")} disabled={!clip||busy} className="rounded-lg border border-white/15 px-2 py-2 text-xs disabled:opacity-30">Move → Playhead</button>
      <button onClick={()=>positionClip("copy")} disabled={!clip||busy} className="rounded-lg border border-white/15 px-2 py-2 text-xs disabled:opacity-30">Copy → Playhead</button>
      <button onClick={()=>positionClip("trim")} disabled={!clip||busy} className="rounded-lg border border-white/15 px-2 py-2 text-xs disabled:opacity-30">Trim left</button>
      <button onClick={()=>{const v=undo.current.pop();if(v){
        if(quickObjectUrl.current)URL.revokeObjectURL(quickObjectUrl.current);
        quickObjectUrl.current=null;setQuickExport(null);
        setSession(v);setDirty(true)}}} disabled={!undo.current.length||busy} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-30">↶ Undo</button>
      {session&&<a href={"/music/restoration?caseId="+encodeURIComponent(session.caseId)}
        className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs text-cyan-200"
        title="Export a saved DAW revision with source-bound stems. Use the bundle or split-export controls in Restoration Studio.">Bundle / dry render kit ↓</a>}
      <button onClick={()=>void save()} disabled={!dirty||busy} className="ml-auto rounded-lg bg-[#8979e9] px-4 py-2 text-xs font-semibold disabled:opacity-35">{dirty?"Save ●":"Saved ✓"}</button>
    </header>
    <div className="flex items-center justify-between border-b border-white/10 bg-[#111521] px-4 py-2 text-xs">
      <div className="flex gap-1">{(["tracks","mixer","effects"] as View[]).map(v=><button key={v} onClick={()=>setView(v)}
        className={"rounded-lg px-3 py-2 capitalize "+(view===v?"bg-[#39465b]":"text-white/50")}>{v}</button>)}</div>
      <div className="flex items-center gap-2 text-[11px] text-white/55">
        <label>BPM <input aria-label="Project tempo in beats per minute" type="number" min="25" max="300" step="1"
          value={session?.tempoBpm??""} placeholder="—"
          onChange={e=>edit(d=>({...d,tempoBpm:e.target.value?Number(e.target.value):null}))}
          className="ml-1 w-14 rounded bg-[#252c3b] px-1.5 py-1.5 text-white" /></label>
        <label>Snap <select value={snapMode} onChange={e=>setSnapMode(e.target.value as typeof snapMode)}
          aria-label="Clip snap grid" className="ml-1 rounded bg-[#252c3b] px-1.5 py-1.5 text-white">
          <option value="off">Off</option><option value="beat">Beat</option>
          <option value="eighth">⅛</option><option value="sixteenth">⅟16</option>
        </select></label>
      </div>
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
                  <button className="min-w-0 flex-1 text-left" onClick={()=>{setSelected(t.artifactId);setSelectedClip(t.clips[0]?.id??"");setNativeApproval(false);setNativeCandidate(null)}}>
                    <span className="block truncate text-xs font-medium">{t.name}</span><span className="text-[10px] text-white/40">{waveforms[t.artifactId]?"Verified waveform":waveUnavailable[t.artifactId]?"WAV waveform unavailable":heard(t)?"Audio":"Muted"}</span>
                  </button>
                  <button onClick={()=>editTrack(t.artifactId,x=>({...x,mute:!x.mute}))} className={"rounded p-1 text-[10px] "+(t.mute?"bg-amber-500 text-black":"bg-white/10")}>M</button>
                  <button onClick={()=>editTrack(t.artifactId,x=>({...x,solo:!x.solo}))} className={"rounded p-1 text-[10px] "+(t.solo?"bg-cyan-400 text-black":"bg-white/10")}>S</button>
                </div>
                <div className="relative bg-[repeating-linear-gradient(to_right,transparent_0,transparent_79px,rgba(255,255,255,.04)_80px)]" style={{width}}>
                  {t.clips.map(c=><button key={c.id}
                    onPointerDown={e=>clipPointerDown(e,t.artifactId,c)}
                    onPointerUp={e=>clipPointerUp(e,t.artifactId,c)}
                    onPointerCancel={()=>{clipPointer.current=null}}
                    onClick={e=>{
                      if(suppressClickAfterDrag.current){suppressClickAfterDrag.current=false;e.preventDefault();return}
                      setSelected(t.artifactId);setSelectedClip(c.id);setPlayhead(round(c.startSeconds))
                    }}
                    style={{left:c.startSeconds/duration*100+"%",width:(c.endSeconds-c.startSeconds)/duration*100+"%",background:color[i%color.length],touchAction:"none"}}
                    className={"absolute inset-y-2 overflow-hidden rounded border-2 px-2 text-left text-xs text-[#101423] "+(selected===t.artifactId&&selectedClip===c.id?"border-white":"border-transparent")}
                    title={t.name+" "+time(c.startSeconds)+"-"+time(c.endSeconds)+" · drag to move"}>
                    <span className="relative z-10 block truncate font-medium">{t.name}</span>
                    <ClipWaveform clip={c} envelope={waveforms[t.artifactId]}
                      loading={waveLoading.includes(t.artifactId)} unavailable={!!waveUnavailable[t.artifactId]}/>
                  </button>)}
                  <span className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-white/70" style={{left:playhead/duration*100+"%"}}/>
                </div>
              </div>)}
            </div>
          </div>}
          {view==="mixer"&&<div className="flex min-h-[310px] gap-2 overflow-x-auto p-3">
            {session.tracks.map((t,i)=><div key={t.artifactId} className={"flex w-28 shrink-0 flex-col items-center rounded-xl border p-3 "+(selected===t.artifactId?"border-cyan-400/70 bg-[#263045]":"border-white/10 bg-[#181d29]")}>
              <button onClick={()=>{setSelected(t.artifactId);setNativeApproval(false);setNativeCandidate(null)}} className="w-full truncate text-center text-xs">{t.name}</button>
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
            <div className="space-y-3 rounded-lg border border-cyan-400/15 bg-[#121923] p-3">
              <h3 className="text-sm font-semibold">Optional local VST/AU render</h3>
              <p className="text-xs text-white/55">Only on a laptop with an approved installed effect and opt-in DawDreamer renderer. This processes an owner-scoped WAV locally, never overwrites its source, and requires separate consent for private cloud import.</p>
              <select value={nativeSelectedSlotId} onChange={e=>{setNativeSelectedSlotId(e.target.value);setNativeApproval(false)}}
                className="w-full rounded bg-[#252c3b] p-2 text-xs">
                <option value="">Select an installed plugin on this track</option>
                {(track?.pluginRack??[]).filter(x=>x.format!=="web-audio"&&/^native-installed:[a-f0-9]{40}$/.test(x.pluginId)).map(x=>
                  <option key={x.id} value={x.id}>{x.name} · {x.format.toUpperCase()}</option>)}
              </select>
              <label className="flex items-start gap-2 text-xs text-white/65">
                <input type="checkbox" checked={nativeApproval} onChange={e=>setNativeApproval(e.target.checked)}/>
                I authorize the selected installed plugin to execute locally and process this WAV. I trust its publisher and have the rights to use it.
              </label>
              <button onClick={()=>void renderLocalPlugin()}
                disabled={!nativeApproval||!nativeSelectedSlotId||!nativeRenderReady||nativeBusy||!track}
                className="rounded bg-cyan-400 px-3 py-2 text-xs font-semibold text-[#07151c] disabled:opacity-30">
                {nativeBusy?"Working…":"Process selected stem with installed VST/AU"}
              </button>
              {nativeCandidate&&<div className="space-y-2 border-t border-white/10 pt-3">
                <p className="text-xs text-white/70">Local processed WAV candidate · not certified.</p>
                <button onClick={downloadCandidate} className="rounded border border-white/20 px-3 py-2 text-xs">Download WAV ↓</button>
                <label className="flex items-start gap-2 text-xs text-white/60">
                  <input type="checkbox" checked={privateImportApproved}
                    onChange={e=>setPrivateImportApproved(e.target.checked)}/>
                  I separately authorize uploading this processed WAV to my private restoration case for further editing.
                </label>
                <button onClick={()=>void importNativeCandidate()}
                  disabled={!privateImportApproved||dirty||nativeBusy}
                  className="rounded border border-cyan-400/40 px-3 py-2 text-xs disabled:opacity-30">
                  Import candidate to private case
                </button>
                {dirty&&<p className="text-xs text-amber-200">Save project changes before importing a plugin result.</p>}
              </div>}
            </div>
            <p className="text-xs text-amber-200">Native DSP is opt-in, never automatic. Browser Web Audio still handles built-in effects; only a separately approved laptop plugin host can run VST3/AU binaries.</p>
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
            <div className="rounded-lg border border-white/10 p-3">
              <h3 className="text-xs font-semibold">Volume / pan automation</h3>
              <p className="mt-1 text-[11px] text-white/45">Move the playhead on the ruler, then add a keyframe. Values are absolute, interpolated between points, and included in the saved offline dry WAV bounce.</p>
              {(["gainDb","pan"] as const).map(lane=><div key={lane} className="mt-2 border-t border-white/10 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs">{lane==="gainDb"?"Fader (dB)":"Pan (L/R)"}</span>
                  <button type="button" onClick={()=>insertAutomation(lane)} className="rounded border border-cyan-400/30 px-2 py-1 text-[11px] text-cyan-300">+ Keyframe at {time(playhead)}</button>
                </div>
                {(track.automation?.[lane]??[]).map((point,i)=><div key={i} className="mt-2 flex items-center gap-2">
                  <label className="flex-1 text-[10px] text-white/45">Time (s)
                    <input aria-label={lane+" keyframe time"} type="number" min="0" step=".01"
                      value={point.atSeconds} onChange={e=>editAutomation(lane,i,{...point,atSeconds:Number(e.target.value)})}
                      className="mt-1 w-full rounded bg-[#252c3b] p-1.5 text-[11px]"/>
                  </label>
                  <label className="flex-1 text-[10px] text-white/45">Value
                    <input aria-label={lane+" keyframe value"} type="number"
                      min={lane==="gainDb"?-60:-1} max={lane==="gainDb"?12:1}
                      step={lane==="gainDb"?.5:.05}
                      value={point.value} onChange={e=>editAutomation(lane,i,{...point,value:Number(e.target.value)})}
                      className="mt-1 w-full rounded bg-[#252c3b] p-1.5 text-[11px]"/>
                  </label>
                  <button type="button" onClick={()=>editAutomation(lane,i,null)} className="mt-4 text-xs text-rose-300" title="Remove automation point">×</button>
                </div>)}
              </div>)}
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
          <div className="rounded-lg border border-cyan-400/15 p-3 text-[11px] leading-5 text-white/55">
            <div className="font-semibold text-white/80">Full-song dry WAV export</div>
            For a short section (up to 60 seconds / 8 audible stems), save and select <strong>Quick dry WAV</strong> to create a real FLOAT32 WAV and SHA receipt entirely on this device. For full songs or larger projects, save this revision, then open <strong>Bundle / dry render kit</strong> to download all registered stems and their edit/source mapping. On your laptop, use the included <code>DAW-DRY-BOUNCE.txt</code> instructions to export either a stereo mix or <strong>each edited stem as a full-length aligned WAV</strong>. The resulting edited stem set is independently recombined and null-checked against the mix before release. All exports remain non-destructive; active plugins, EQ or compression block dry export until separately rendered.
          </div>
          <p className="border-t border-white/10 pt-3 text-[11px] leading-5 text-white/45">Non-destructive source-bound edits. Web audio preview is not a final rendered master. Native plugins require host and licensing proofs. Save to continue on another device.</p>
        </aside>
      </div>}
  </main>;
}
