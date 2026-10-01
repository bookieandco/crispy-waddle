"use client";

import {useEffect,useMemo,useState} from "react";

type Row=Record<string,unknown>;

export function JuggernautSectionSync(props:{
  userId:string;
  caseId:string;
  sourceArtifactId:string;
}){
  const [songs,setSongs]=useState<Row[]>([]);
  const [songId,setSongId]=useState("");
  const [runtimeReady,setRuntimeReady]=useState<boolean|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  useEffect(()=>{
    let cancelled=false;
    void Promise.all([
      fetch("/api/music/juggernaut?artistKey=atwood-bookie",{cache:"no-store"}).then((response)=>response.json()),
      fetch("/api/music/restoration/health",{cache:"no-store"}).then((response)=>response.json()),
    ]).then(([music,health])=>{
      if(cancelled)return;
      setSongs((music?.data?.songs??[]) as Row[]);
      setRuntimeReady(health?.productionReady===true);
    }).catch(()=>{
      if(!cancelled)setRuntimeReady(false);
    });
    return()=>{cancelled=true};
  },[]);

  const selected=useMemo(()=>songs.find((row)=>String(row.id)===songId),[songs,songId]);

  async function sync(){
    if(!songId)return;
    setBusy(true);setStatus("Running measured section perception…");
    try{
      const response=await fetch("/api/music/juggernaut/sections/perceive",{
        method:"POST",
        headers:{"content-type":"application/json","x-jhadina-user-id":props.userId},
        body:JSON.stringify({
          artistKey:"atwood-bookie",
          songId,
          caseId:props.caseId,
          artifactId:props.sourceArtifactId,
          minimumConfidence:0.5,
        }),
      });
      const body=await response.json();
      if(!response.ok||body.success!==true)throw new Error(body.error??"Section sync failed");
      setStatus(
        "Saved "+String(body.data.admittedSectionCount)+" measured sections to "+
        String(selected?.title??selected?.song_key??"the selected song")+
        ". No content was published."
      );
    }catch(error){
      setStatus(error instanceof Error?error.message:"Section sync failed");
    }finally{
      setBusy(false);
    }
  }

  return <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      <label className="min-w-0 flex-1 text-[10px] uppercase tracking-[.16em] text-white/35">
        Send measured sections to Music Juggernaut
        <select value={songId} onChange={(event)=>setSongId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111319] p-3 text-sm normal-case tracking-normal text-white">
          <option value="">Choose Atwood Bookie song</option>
          {songs.map((row)=><option key={String(row.id)} value={String(row.id)}>{String(row.title??row.song_key)}</option>)}
        </select>
      </label>
      <button onClick={()=>void sync()} disabled={!songId||busy||runtimeReady!==true} className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black disabled:opacity-30">
        {busy?"Perceiving…":"Analyze → Juggernaut"}
      </button>
    </div>
    <p className="mt-2 text-xs leading-5 text-white/40">
      {runtimeReady===true
        ?"Uses the source artifact's measured section boundaries. Low-confidence boundaries are rejected; existing manual sections are preserved."
        :runtimeReady===false
          ?"Blocked: the Music Restoration worker is not production-ready yet. The bridge is ready and will fail closed until runtime auth is restored."
          :"Checking Music Restoration runtime…"}
    </p>
    {status&&<p className="mt-2 text-xs text-white/60">{status}</p>}
  </div>;
}
