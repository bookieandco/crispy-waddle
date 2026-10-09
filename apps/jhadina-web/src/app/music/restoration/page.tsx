"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { JuggernautSectionSync } from "./juggernaut-section-sync";

type StudioCase = {
  id:string; title:string; status:string; source_artifact_id:string;
  current_version_id:string; created_at:string; updated_at:string;
};
type StudioArtifact = {
  id:string; kind:string; role?:string; sha256:string; sampleRate:number; channels:number;
  sampleCount:number; durationSeconds:number; parentArtifactId?:string; createdAt:string;
  runtimeReceiptId?:string; sizeBytes:number; mimeType:string; downloadUrl:string;
};
type Marker = {id:string;label:string;kind?:string;sample:number;sampleRate:number;confidence?:number};
type Snapshot = {
  restorationCase:StudioCase;
  artifacts:StudioArtifact[];
  evidence:Array<Record<string,unknown>>;
  markers:Marker[];
  versions:Array<Record<string,unknown>>;
  reconstructions:Array<Record<string,unknown>>;
  vocalRepairs:Array<Record<string,unknown>>;
  jobs:Array<Record<string,unknown>>;
  executionReceipts:Array<Record<string,unknown>>;
  reviews:Array<Record<string,unknown>>;
  manifest:{tracks:Array<{artifactId:string;name:string;role:string;fileName:string}>};
};
type RuntimeOptionalModels = {
  deepDrums:boolean; basicPitchMidi:boolean; demucs6s:boolean; ddspTimbre:boolean; vocalAdlibs:boolean;
};
type RuntimeStatus = {
  configured:boolean; status:string; health?:{optionalModels?:RuntimeOptionalModels};
};
type LargeBundlePlan = {
  totalSourceBytes: number;
  partByteLimit: number;
  parts: Array<{ number:number;sourceBytes:number;count:number }>;
  directArtifacts: Array<{
    artifactId:string;sourceBytes:number;fileName:string;downloadUrl:string|null;
  }>;
};
type HistoryDisplayRow = Record<string,unknown> & {_type:string};
type FinalDecision = {
  status:"certified"|"blocked";
  checks:Array<{id:string;passed:boolean;reason:string}>;
  reasons:string[];
};

function roleLabel(artifact:StudioArtifact):string {
  if(artifact.role==="vocals")return "Vocals";
  if(artifact.role==="drums")return "Drums";
  if(artifact.role?.startsWith("drums."))return "Drums / "+artifact.role.slice(6);
  if(artifact.role?.startsWith("midi."))return "Creative MIDI / "+artifact.role.slice(5);
  if(artifact.role?.startsWith("vocal-reviewed."))return "Reviewed vocal region / "+artifact.role.slice(15);
  if(artifact.role==="guitar")return "Guitar";
  if(artifact.role==="piano")return "Piano";
  if(artifact.role==="bass")return "Bass";
  if(artifact.role==="other")return "Other";
  if(artifact.role==="vocal-restoration")return "Vocals restored";
  if(artifact.role?.startsWith("reconstructed-"))return "Reconstructed "+artifact.role.slice(14).replace(/-/g," ");
  if(artifact.kind==="source")return "Original source";
  return (artifact.role??artifact.kind).replace(/-/g," ");
}

function Waveform({url,markers,duration}:{url?:string;markers:Marker[];duration:number}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [state,setState]=useState<"idle"|"loading"|"ready"|"error">("idle");

  useEffect(()=>{
    if(!url){setState("idle");return}
    let cancelled=false;
    setState("loading");
    void (async()=>{
      try{
        const response=await fetch(url,{cache:"no-store"});
        if(!response.ok)throw new Error("waveform fetch failed");
        const bytes=await response.arrayBuffer();
        const context=new AudioContext();
        const audio=await context.decodeAudioData(bytes.slice(0));
        const channel=audio.getChannelData(0);
        const bars=360;
        const step=Math.max(1,Math.floor(channel.length/bars));
        const peaks:number[]=[];
        for(let i=0;i<bars;i++){
          const start=i*step;
          const end=Math.min(channel.length,start+step);
          let peak=0;
          for(let j=start;j<end;j++)peak=Math.max(peak,Math.abs(channel[j]??0));
          peaks.push(peak);
        }
        await context.close();
        if(cancelled)return;
        const canvas=canvasRef.current;
        if(!canvas)return;
        const ratio=window.devicePixelRatio||1;
        const width=Math.max(320,canvas.clientWidth);
        const height=120;
        canvas.width=Math.floor(width*ratio);
        canvas.height=Math.floor(height*ratio);
        const ctx=canvas.getContext("2d");
        if(!ctx)return;
        ctx.scale(ratio,ratio);
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle="rgba(255,255,255,.08)";
        ctx.fillRect(0,0,width,height);
        ctx.fillStyle="rgba(255,255,255,.72)";
        const barWidth=width/peaks.length;
        peaks.forEach((peak,index)=>{
          const h=Math.max(1,peak*(height-18));
          ctx.fillRect(index*barWidth,(height-h)/2,Math.max(1,barWidth*.72),h);
        });
        ctx.fillStyle="rgba(250,204,21,.9)";
        for(const marker of markers){
          const seconds=marker.sample/marker.sampleRate;
          if(duration<=0||seconds<0||seconds>duration)continue;
          const x=(seconds/duration)*width;
          ctx.fillRect(x,0,1,height);
        }
        setState("ready");
      }catch{
        if(!cancelled)setState("error");
      }
    })();
    return()=>{cancelled=true};
  },[url,markers,duration]);

  return <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
    <canvas ref={canvasRef} className="block h-[120px] w-full"/>
    {state==="loading"&&<div className="absolute inset-0 grid place-items-center text-xs text-white/45">Decoding waveform…</div>}
    {state==="error"&&<div className="absolute inset-0 grid place-items-center text-xs text-amber-200/70">Waveform unavailable; audio remains playable.</div>}
  </div>;
}

export default function RestorationStudioPage(){
  const [userId,setUserId]=useState<string|null>(null);
  const [cases,setCases]=useState<StudioCase[]>([]);
  const [selectedCaseId,setSelectedCaseId]=useState("");
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [aId,setAId]=useState("");
  const [bId,setBId]=useState("");
  const [finalDecision,setFinalDecision]=useState<FinalDecision|null>(null);
  const [runtimeStatus,setRuntimeStatus]=useState<RuntimeStatus|null>(null);
  const [bundlePlan,setBundlePlan]=useState<LargeBundlePlan|null>(null);
  const [vocalRegionRole,setVocalRegionRole]=useState("ad-lib");
  const [vocalRegionStart,setVocalRegionStart]=useState("0");
  const [vocalRegionEnd,setVocalRegionEnd]=useState("2");
  const [vocalRegionReviewed,setVocalRegionReviewed]=useState(false);

  const loadCases=useCallback(async(uid:string)=>{
    const response=await fetch("/api/music/restoration/studio",{cache:"no-store",headers:{"x-jhadina-user-id":uid}});
    const body=await response.json();
    if(!response.ok)throw new Error(body.error||"Unable to load restoration cases");
    setCases(body.cases??[]);
    return body.cases??[];
  },[]);

  const loadCase=useCallback(async(uid:string,caseId:string)=>{
    const response=await fetch("/api/music/restoration/studio?caseId="+encodeURIComponent(caseId),{
      cache:"no-store",headers:{"x-jhadina-user-id":uid},
    });
    const body=await response.json();
    if(!response.ok)throw new Error(body.error||"Unable to load restoration case");
    const next=body as Snapshot;
    setSnapshot(next);
    setFinalDecision(null);
    setBundlePlan(null);
    const playable=next.artifacts.filter(item=>item.downloadUrl&&item.mimeType!=="audio/midi");
    setAId(current=>playable.some(item=>item.id===current)?current:(playable[0]?.id??""));
    setBId(current=>playable.some(item=>item.id===current)?current:(playable.at(-1)?.id??""));
  },[]);

  useEffect(()=>{
    let active=true;
    void fetch("/api/music/restoration/health",{cache:"no-store"})
      .then(response=>response.json())
      .then((body:RuntimeStatus)=>{if(active)setRuntimeStatus(body)})
      .catch(()=>{if(active)setRuntimeStatus({configured:false,status:"unavailable"})});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    void (async()=>{
      const uid=await getCurrentUserId();
      setUserId(uid);
      if(!uid){setStatus("Sign in to use Restoration Studio.");return}
      try{
        const loaded=await loadCases(uid);
        // Round trip from the DAW export workflow must preserve the case.
        const requested=new URLSearchParams(window.location.search).get("caseId");
        const chosen=(requested&&loaded.find((item:{id:string})=>String(item.id)===requested))||loaded[0];
        if(chosen?.id){
          setSelectedCaseId(String(chosen.id));
          await loadCase(uid,String(chosen.id));
        }
      }catch(error){setStatus(error instanceof Error?error.message:"Unable to load studio")}
    })();
  },[loadCases,loadCase]);

  async function upload(){
    if(!userId||!file)return;
    setBusy(true);setStatus("Ingesting immutable source…");
    try{
      const form=new FormData();form.append("file",file);
      const response=await fetch("/api/music/restoration/ingest",{
        method:"POST",headers:{"x-jhadina-user-id":userId},body:form,
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Ingest failed");
      const caseId=String(body.restorationCase.id);
      setSelectedCaseId(caseId);
      await loadCases(userId);
      await loadCase(userId,caseId);
      setStatus("Source ingested. Run analysis to create stems and evidence.");
    }catch(error){setStatus(error instanceof Error?error.message:"Ingest failed")}
    finally{setBusy(false)}
  }

  async function analyze(){
    if(!userId||!snapshot)return;
    const sourceId=String(snapshot.restorationCase.source_artifact_id);
    setBusy(true);setStatus("Running perception and stem separation…");
    try{
      const response=await fetch("/api/music/restoration/analyze",{
        method:"POST",
        headers:{"content-type":"application/json","x-jhadina-user-id":userId},
        body:JSON.stringify({caseId:snapshot.restorationCase.id,artifactId:sourceId,separate:true}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Analysis failed");
      await loadCase(userId,snapshot.restorationCase.id);
      setStatus("Analysis complete. Audition stems and compare candidates.");
    }catch(error){setStatus(error instanceof Error?error.message:"Analysis failed")}
    finally{setBusy(false)}
  }

  async function splitDrums(parentArtifactId:string){
    if(!userId||!snapshot)return;
    setBusy(true);setStatus("Separating individual drums (optional CPU model)…");
    try{
      const response=await fetch("/api/music/restoration/deep-stems",{
        method:"POST",
        headers:{"content-type":"application/json","x-jhadina-user-id":userId},
        body:JSON.stringify({caseId:snapshot.restorationCase.id,parentArtifactId}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Individual drum separation unavailable");
      await loadCase(userId,snapshot.restorationCase.id);
      setStatus("Individual drums saved. Audition the residual and full mix before approval.");
    }catch(error){setStatus(error instanceof Error?error.message:"Deep drum separation failed")}
    finally{setBusy(false)}
  }

  async function transcribeMidi(parentArtifactId:string){
    if(!userId||!snapshot)return;
    setBusy(true);setStatus("Transcribing isolated instrument to editable MIDI…");
    try{
      const response=await fetch("/api/music/restoration/midi",{
        method:"POST",
        headers:{"content-type":"application/json","x-jhadina-user-id":userId},
        body:JSON.stringify({caseId:snapshot.restorationCase.id,parentArtifactId}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"MIDI transcription unavailable");
      await loadCase(userId,snapshot.restorationCase.id);
      setStatus("MIDI candidate saved. Review notes/timing in your DAW; this is creative reconstruction, not recovered original MIDI.");
    }catch(error){setStatus(error instanceof Error?error.message:"MIDI transcription failed")}
    finally{setBusy(false)}
  }

  async function renderVocalRegion(parentArtifactId:string){
    if(!userId||!snapshot||!vocalRegionReviewed)return;
    const startMs=Number(vocalRegionStart)*1000;
    const endMs=Number(vocalRegionEnd)*1000;
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<0||endMs-startMs<50){
      setStatus("Enter a valid reviewed start/end range in seconds.");return;
    }
    setBusy(true);setStatus("Extracting time-aligned vocal region with residual…");
    try{
      const response=await fetch("/api/music/restoration/reviewed-vocals",{
        method:"POST",
        headers:{"content-type":"application/json","x-jhadina-user-id":userId},
        body:JSON.stringify({
          caseId:snapshot.restorationCase.id,parentArtifactId,
          regions:[{role:vocalRegionRole,startMs,endMs}],
        }),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Vocal region render failed");
      await loadCase(userId,snapshot.restorationCase.id);
      setVocalRegionReviewed(false);
      setStatus("Reviewed vocal timeline track and complementary residual saved. Overlapping singers remain together; this is not automatic ad-lib separation.");
    }catch(error){setStatus(error instanceof Error?error.message:"Vocal region render failed")}
    finally{setBusy(false)}
  }

  async function prepareLargeExport(){
    if(!userId||!snapshot)return;
    setBusy(true);
    try{
      const response=await fetch(
        "/api/music/restoration/export?caseId="+encodeURIComponent(snapshot.restorationCase.id)+"&format=bundle-plan",
        {headers:{"x-jhadina-user-id":userId},cache:"no-store"},
      );
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Export plan unavailable");
      setBundlePlan(body as LargeBundlePlan);
      setStatus("Large archive plan ready. Download all ZIP parts and any oversized direct stems; extract ZIPs into one folder.");
    }catch(error){setStatus(error instanceof Error?error.message:"Export plan unavailable")}
    finally{setBusy(false)}
  }

  async function downloadExport(format:"bundle"|"manifest"|"reaper"|"markers"|"logic",part?:number){
    if(!userId||!snapshot)return;
    const response=await fetch(
      "/api/music/restoration/export?caseId="+encodeURIComponent(snapshot.restorationCase.id)+"&format="+format+(part===undefined?"":"&part="+encodeURIComponent(String(part))),
      {headers:{"x-jhadina-user-id":userId}},
    );
    if(!response.ok){
      const body=await response.json().catch(()=>({}));
      if(format==="bundle"&&response.status===413) {
        await prepareLargeExport();
        return;
      }
      setStatus(body.error||"Export failed");return;
    }
    const blob=await response.blob();
    const disposition=response.headers.get("content-disposition")??"";
    const match=disposition.match(/filename="([^"]+)"/);
    const name=match?.[1]??("restoration-"+format);
    const href=URL.createObjectURL(blob);
    const anchor=document.createElement("a");anchor.href=href;anchor.download=name;anchor.click();
    window.setTimeout(()=>URL.revokeObjectURL(href),60_000);
  }

  async function finalCertification(certify:boolean){
    if(!userId||!snapshot)return;
    setBusy(true);
    setStatus(certify?"Running MUSIC-RESTORE.FINAL certification…":"Checking FINAL readiness…");
    try{
      const endpoint="/api/music/restoration/final";
      const response=certify
        ? await fetch(endpoint,{
            method:"POST",
            headers:{"content-type":"application/json","x-jhadina-user-id":userId},
            body:JSON.stringify({caseId:snapshot.restorationCase.id,certify:true}),
          })
        : await fetch(endpoint+"?caseId="+encodeURIComponent(snapshot.restorationCase.id),{
            cache:"no-store",
            headers:{"x-jhadina-user-id":userId},
          });
      const body=await response.json();
      if(body.decision)setFinalDecision(body.decision as FinalDecision);
      if(!response.ok&&response.status!==409)throw new Error(body.error||"FINAL certification check failed");
      if(body.decision?.status==="certified"){
        setStatus("MUSIC-RESTORE.FINAL certified for the current version.");
      }else{
        const first=body.decision?.reasons?.[0];
        setStatus(first?("FINAL blocked: "+first):"FINAL remains blocked.");
      }
    }catch(error){setStatus(error instanceof Error?error.message:"FINAL certification failed")}
    finally{setBusy(false)}
  }

  async function review(decision:"approved"|"rejected"){
    if(!userId||!snapshot||!bId)return;
    if(aId===bId){setStatus("Choose different A and B artifacts before review.");return}
    setBusy(true);
    setStatus(decision==="approved"?"Approving B after verified QC…":"Recording rejection…");
    try{
      const response=await fetch("/api/music/restoration/review",{
        method:"POST",
        headers:{"content-type":"application/json","x-jhadina-user-id":userId},
        body:JSON.stringify({
          caseId:snapshot.restorationCase.id,
          artifactId:bId,
          comparisonArtifactId:aId||undefined,
          decision,
        }),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Review failed");
      await Promise.all([
        loadCase(userId,snapshot.restorationCase.id),
        loadCases(userId),
      ]);
      setStatus(decision==="approved"
        ?"B approved and promoted as the current restoration version."
        :"B rejected; the source and other versions remain unchanged.");
    }catch(error){setStatus(error instanceof Error?error.message:"Review failed")}
    finally{setBusy(false)}
  }

  const a=snapshot?.artifacts.find(item=>item.id===aId);
  const b=snapshot?.artifacts.find(item=>item.id===bId);
  const markers=snapshot?.markers??[];
  const historyRows:HistoryDisplayRow[]=snapshot?[
    ...snapshot.versions.map((item):HistoryDisplayRow=>({...item,_type:"version"})),
    ...snapshot.reconstructions.map((item):HistoryDisplayRow=>({...item,_type:"instrument reconstruction"})),
    ...snapshot.vocalRepairs.map((item):HistoryDisplayRow=>({...item,_type:"vocal restoration"})),
  ].sort((x,y)=>String(x.created_at??"").localeCompare(String(y.created_at??""))):[];

  return <main className="min-h-screen bg-[#07080b] text-white">
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-7 md:px-8">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <a href="/music" className="text-xs text-white/40 hover:text-white/70">← Music</a>
          <p className="mt-4 text-[11px] uppercase tracking-[.32em] text-white/35">Jhadina Music</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">Restoration Studio</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">Preserve the source. Analyze first. Repair locally. Audition every consequential change.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {snapshot&&<a href={"/music/daw?caseId="+encodeURIComponent(snapshot.restorationCase.id)}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-[#06131a]">Open Jhadina DAW ↗</a>}
          <button onClick={()=>downloadExport("bundle")} disabled={!snapshot||busy} className="rounded-xl bg-white px-4 py-2 text-xs font-medium text-black disabled:opacity-30">DAW Bundle ↓</button>
          <button onClick={()=>void prepareLargeExport()} disabled={!snapshot||busy} className="rounded-xl border border-white/10 px-4 py-2 text-xs disabled:opacity-30">Large / split export</button>
          <button onClick={()=>downloadExport("reaper")} disabled={!snapshot} className="rounded-xl border border-white/10 px-4 py-2 text-xs disabled:opacity-30">Reaper .rpp</button>
          <button onClick={()=>downloadExport("logic")} disabled={!snapshot} className="rounded-xl border border-white/10 px-4 py-2 text-xs disabled:opacity-30">Logic guide</button>
          <button onClick={()=>downloadExport("markers")} disabled={!snapshot} className="rounded-xl border border-white/10 px-4 py-2 text-xs disabled:opacity-30">Markers CSV</button>
          <button onClick={()=>downloadExport("manifest")} disabled={!snapshot} className="rounded-xl border border-white/10 px-4 py-2 text-xs disabled:opacity-30">Manifest</button>
        </div>
      </header>

      {bundlePlan&&<section className="mt-6 rounded-xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="text-sm font-medium">Large DAW export — {bundlePlan.parts.length} ZIP parts</h2>
        <p className="mt-1 text-xs text-white/50">Download every part and any direct oversized recordings. Extract the ZIPs together to preserve one synchronized project; each file retains its original bytes.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {bundlePlan.parts.map(item=><button key={item.number}
            onClick={()=>void downloadExport("bundle",item.number)}
            disabled={busy}
            className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-30"
          >Part {item.number} · {item.count} tracks</button>)}
          {bundlePlan.directArtifacts.map(item=><a key={item.artifactId}
            href={item.downloadUrl??undefined} download={item.fileName}
            className="rounded-lg border border-white/20 px-3 py-2 text-xs"
          >Direct stem · {item.fileName}</a>)}
        </div>
        {bundlePlan.directArtifacts.length>0&&<p className="mt-2 text-xs text-amber-200/65">Oversized recordings are direct file downloads, not included inside the ZIPs. They must be placed in the stems folder under their original filenames.</p>}
      </section>}
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <p className="text-xs uppercase tracking-[.24em] text-white/35">New restoration</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="file" accept="audio/*" onChange={event=>setFile(event.target.files?.[0]??null)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/>
            <button onClick={upload} disabled={!file||!userId||busy} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-30">Ingest source</button>
          </div>
          <p className="mt-3 text-xs text-white/40">
            Worker: {runtimeStatus?.status??"checking"} ·
            Individual drums: {runtimeStatus?.health?.optionalModels?.deepDrums?"available":"not commissioned"} ·
            MIDI: {runtimeStatus?.health?.optionalModels?.basicPitchMidi?"available":"not commissioned"} ·
            DDSP: {runtimeStatus?.health?.optionalModels?.ddspTimbre?"available":"not commissioned"} ·
            Ad-libs: {runtimeStatus?.health?.optionalModels?.vocalAdlibs?"available":"not commissioned"}
          </p>
          {status&&<p className="mt-3 text-sm text-white/55">{status}</p>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <p className="text-xs uppercase tracking-[.24em] text-white/35">Case</p>
          <select value={selectedCaseId} onChange={event=>{
            const id=event.target.value;setSelectedCaseId(id);
            if(userId&&id)void loadCase(userId,id);
          }} className="mt-4 w-full rounded-xl border border-white/10 bg-[#111319] p-3 text-sm">
            <option value="">Select a restoration</option>
            {cases.map(item=><option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}
          </select>
          <button onClick={analyze} disabled={!snapshot||busy} className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm disabled:opacity-30">Analyze + separate stems</button>
        </div>
      </section>

      {snapshot&&<>
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[.24em] text-white/35">Case</p>
              <h2 className="mt-2 text-2xl font-medium">{snapshot.restorationCase.title}</h2>
            </div>
            <div className="text-right text-xs text-white/40">
              <p>{snapshot.restorationCase.status}</p>
              <p className="mt-1">Current {snapshot.restorationCase.current_version_id}</p>
            </div>
          </div>
        </section>

        {userId&&<JuggernautSectionSync
          userId={userId}
          caseId={snapshot.restorationCase.id}
          sourceArtifactId={snapshot.restorationCase.source_artifact_id}
        />}

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.24em] text-white/35">Audio assets</p><h2 className="mt-1 text-xl font-medium">Stems & versions</h2></div><span className="text-xs text-white/35">{snapshot.artifacts.length} artifacts</span></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.artifacts.map(item=><article key={item.id} className="rounded-2xl border border-white/8 bg-white/[.03] p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-medium capitalize">{roleLabel(item)}</p><p className="mt-1 text-xs text-white/35">{item.kind} · {item.sampleRate} Hz · {item.channels}ch</p></div><a href={item.downloadUrl} download className="text-xs text-white/50 hover:text-white">{item.mimeType==="audio/midi"?"MIDI ↓":"Audio ↓"}</a></div>
              {item.mimeType!=="audio/midi"
                ?<audio controls preload="metadata" src={item.downloadUrl} className="mt-4 w-full"/>
                :<p className="mt-4 text-xs text-amber-200/65">Creative note transcription; import into a DAW and audition with a licensed instrument. Not source recovery.</p>}

              {item.role==="vocals"&&<div className="mt-4 space-y-2 rounded-xl border border-white/10 p-3">
                <p className="text-xs text-white/55">Owner-reviewed vocal time masks · not isolated speakers</p>
                <div className="flex flex-wrap gap-2">
                  <select value={vocalRegionRole} onChange={event=>{setVocalRegionRole(event.target.value);setVocalRegionReviewed(false)}}
                    className="rounded-lg bg-[#111319] px-2 py-1 text-xs">
                    {["lead","backing","double","harmony","ad-lib","spoken","shout","response","effect","breath"].map(role=><option key={role} value={role}>{role}</option>)}
                  </select>
                  <label className="text-xs text-white/60">Start (s)
                    <input type="number" min="0" step=".05" value={vocalRegionStart}
                      onChange={event=>{setVocalRegionStart(event.target.value);setVocalRegionReviewed(false)}}
                      className="ml-2 w-20 rounded-lg bg-[#111319] p-1" />
                  </label>
                  <label className="text-xs text-white/60">End (s)
                    <input type="number" min="0" step=".05" value={vocalRegionEnd}
                      onChange={event=>{setVocalRegionEnd(event.target.value);setVocalRegionReviewed(false)}}
                      className="ml-2 w-20 rounded-lg bg-[#111319] p-1" />
                  </label>
                </div>
                <label className="flex items-start gap-2 text-xs text-white/55">
                  <input type="checkbox" checked={vocalRegionReviewed} onChange={event=>setVocalRegionReviewed(event.target.checked)}/>
                  I listened to this time range and reviewed the proposed layer label.
                </label>
                <button type="button" onClick={()=>void renderVocalRegion(item.id)}
                  disabled={busy||!vocalRegionReviewed||runtimeStatus?.configured!==true}
                  className="w-full rounded-xl border border-white/15 px-3 py-2 text-xs disabled:opacity-35">
                  Extract reviewed vocal timeline region
                </button>
                <p className="text-xs text-amber-200/60">This masks a time interval only. If lead, harmony and ad-libs overlap, they remain mixed until a verified separator is commissioned.</p>
              </div>}
              {["guitar","piano","bass","other"].includes(item.role??"")&&<button type="button"
                disabled={busy||runtimeStatus?.health?.optionalModels?.basicPitchMidi!==true||snapshot.artifacts.some(child=>child.parentArtifactId===item.id&&child.role==="midi."+item.role)}
                onClick={()=>void transcribeMidi(item.id)}
                className="mt-3 w-full rounded-xl border border-white/15 px-3 py-2 text-sm disabled:opacity-35"
              >{snapshot.artifacts.some(child=>child.parentArtifactId===item.id&&child.role==="midi."+item.role)?"MIDI already transcribed":"Transcribe to MIDI (creative)"}</button>}
              {item.role==="drums"&&<button type="button"
                disabled={busy||runtimeStatus?.health?.optionalModels?.deepDrums!==true||snapshot.artifacts.some(child=>child.parentArtifactId===item.id&&child.role?.startsWith("drums."))}
                onClick={()=>void splitDrums(item.id)}
                className="mt-3 w-full rounded-xl border border-white/15 px-3 py-2 text-sm disabled:opacity-35"
              >{snapshot.artifacts.some(child=>child.parentArtifactId===item.id&&child.role?.startsWith("drums."))?"Individual drums already extracted":"Split into kick / snare / hats / cymbals / toms"}</button>}
              <p className="mt-3 truncate font-mono text-[10px] text-white/25">{item.sha256}</p>
            </article>)}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <p className="text-xs uppercase tracking-[.24em] text-white/35">A/B audition</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[["A",aId,setAId,a],["B",bId,setBId,b] as const].map(entry=>{
              const label=entry[0] as string;const id=entry[1] as string;const setter=entry[2] as (value:string)=>void;const artifact=entry[3] as StudioArtifact|undefined;
              return <div key={label} className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-semibold text-black">{label}</span><select value={id} onChange={event=>setter(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#111319] p-2 text-sm">{snapshot.artifacts.map(item=><option key={item.id} value={item.id}>{roleLabel(item)}</option>)}</select></div>
                <div className="mt-4"><Waveform url={artifact?.downloadUrl} markers={markers} duration={artifact?.durationSeconds??0}/></div>
                {artifact&&<audio controls preload="metadata" src={artifact.downloadUrl} className="mt-3 w-full"/>}
              </div>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={()=>review("approved")} disabled={busy||!b||b.kind==="source"||aId===bId} className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-black disabled:opacity-30">Approve B</button>
            <button onClick={()=>review("rejected")} disabled={busy||!b||b.kind==="source"||aId===bId} className="rounded-xl border border-rose-300/30 px-4 py-2 text-xs text-rose-100 disabled:opacity-30">Reject B</button>
            <span className="text-xs text-white/35">Approval requires a passed, hash-bound QC receipt; rejection never mutates the source.</span>
          </div>
          <p className="mt-3 text-xs text-white/35">Yellow lines are canonical-source evidence markers. Compare aligned material before approving any restoration for release.</p>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
            <div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.24em] text-white/35">Evidence</p><h2 className="mt-1 text-xl">Markers & observations</h2></div><span className="text-xs text-white/35">{snapshot.evidence.length}</span></div>
            <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
              {snapshot.evidence.map((item,index)=><div key={String(item.id??index)} className="rounded-xl border border-white/7 bg-black/20 p-3"><div className="flex justify-between gap-3"><p className="text-sm">{String(item.kind??"evidence")}</p><p className="text-xs text-white/35">{Math.round(Number(item.confidence??0)*100)}%</p></div><p className="mt-1 truncate font-mono text-[10px] text-white/25">{String(item.id??"")}</p></div>)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
            <div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.24em] text-white/35">History</p><h2 className="mt-1 text-xl">Restoration lineage</h2></div><span className="text-xs text-white/35">{snapshot.versions.length+snapshot.reconstructions.length+snapshot.vocalRepairs.length}</span></div>
            <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
              {historyRows.map((item,index)=><div key={String(item.id??index)} className="rounded-xl border border-white/7 bg-black/20 p-3"><div className="flex justify-between gap-3"><p className="text-sm capitalize">{String(item._type)}</p><p className="text-xs text-white/35">{String(item.created_at??"").slice(0,16).replace("T"," ")}</p></div><p className="mt-1 truncate font-mono text-[10px] text-white/25">{String(item.output_artifact_id??item.id??"")}</p></div>)}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.24em] text-white/35">MUSIC-RESTORE.FINAL</p>
              <h2 className="mt-1 text-xl">Real-song certification</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/40">Fail-closed proof of live runtime, source/stem/perception receipts, consequential repair, passed QC, human approval, artifact hashes and the exact DAW bundle.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>finalCertification(false)} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2 text-xs disabled:opacity-30">Preflight FINAL</button>
              <button onClick={()=>finalCertification(true)} disabled={busy} className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-black disabled:opacity-30">Certify FINAL</button>
            </div>
          </div>
          {finalDecision&&<div className="mt-5 grid gap-2 md:grid-cols-2">
            {finalDecision.checks.map(item=><div key={item.id} className={"rounded-xl border p-3 "+(item.passed?"border-emerald-300/15 bg-emerald-300/[.04]":"border-amber-300/15 bg-amber-300/[.04]")}><div className="flex items-center justify-between gap-3"><p className="text-sm capitalize">{item.id.replace(/-/g," ")}</p><span className={item.passed?"text-xs text-emerald-200":"text-xs text-amber-200"}>{item.passed?"PASS":"BLOCKED"}</span></div><p className="mt-1 text-xs leading-5 text-white/40">{item.reason}</p></div>)}
          </div>}
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
            <div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.24em] text-white/35">Jobs</p><h2 className="mt-1 text-xl">Runtime activity</h2></div><span className="text-xs text-white/35">{snapshot.jobs.length}</span></div>
            <div className="mt-4 max-h-[320px] space-y-2 overflow-auto pr-1">
              {snapshot.jobs.length===0&&<p className="text-sm text-white/35">No restoration jobs yet.</p>}
              {snapshot.jobs.slice().reverse().map((item,index)=><div key={String(item.id??index)} className="rounded-xl border border-white/7 bg-black/20 p-3"><div className="flex justify-between gap-3"><p className="text-sm capitalize">{String(item.kind??"job").replace(/-/g," ")}</p><p className="text-xs text-white/45">{String(item.status??"unknown")}</p></div>{Boolean(item.error)&&<p className="mt-1 text-xs text-rose-200/70">{String(item.error)}</p>}</div>)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
            <div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.24em] text-white/35">Human review</p><h2 className="mt-1 text-xl">Approval ledger</h2></div><span className="text-xs text-white/35">{snapshot.reviews.length}</span></div>
            <div className="mt-4 max-h-[320px] space-y-2 overflow-auto pr-1">
              {snapshot.reviews.length===0&&<p className="text-sm text-white/35">No human review decisions yet.</p>}
              {snapshot.reviews.slice().reverse().map((item,index)=><div key={String(item.id??index)} className="rounded-xl border border-white/7 bg-black/20 p-3"><div className="flex justify-between gap-3"><p className="text-sm capitalize">{String(item.decision??"review")}</p><p className="text-xs text-white/35">{String(item.reviewed_at??"").slice(0,16).replace("T"," ")}</p></div><p className="mt-1 truncate font-mono text-[10px] text-white/25">{String(item.artifact_id??"")}</p></div>)}
            </div>
          </div>
        </section>
      </>}
    </div>
  </main>;
}
