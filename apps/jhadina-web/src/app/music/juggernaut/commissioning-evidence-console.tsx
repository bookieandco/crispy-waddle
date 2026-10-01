"use client";

import {useCallback,useEffect,useMemo,useState} from "react";

type Row=Record<string,unknown>;
type Receipt={stage:string;status:string;details?:Record<string,unknown>};
type Props={
  project:Row;
  songs:Row[];
  experiments:Row[];
  onRefresh:()=>Promise<void>|void;
};

const SECTION_FUNCTIONS=["lyric","melody","emotion","meme","performance","loop"] as const;

export function CommissioningEvidenceConsole({project,songs,experiments,onRefresh}:Props){
  const projectId=String(project.id??"");
  const [receipts,setReceipts]=useState<Receipt[]>([]);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  const [royaltyText,setRoyaltyText]=useState("");
  const [statementRef,setStatementRef]=useState("streaming-dashboard");

  const [experimentId,setExperimentId]=useState("");
  const [observation,setObservation]=useState({exposures:"",views:"",songActions:"",directFanCaptures:"",botRisk:"0",attributionConfidence:"0.8",evidenceRef:""});

  const [city,setCity]=useState({name:"",listeners:"",directFans:"",showInterest:"",priorAttendees:"",repeatFans:"",evidenceRef:""});

  const [rightsSongId,setRightsSongId]=useState("");
  const [rights,setRights]=useState({master:false,publishing:false,sampleStatus:"review_required",thirdPartyStatus:"review_required",evidenceRef:""});

  const [sectionSongId,setSectionSongId]=useState("");
  const [section,setSection]=useState({startSeconds:"",endSeconds:"",label:"",functions:["performance"] as string[],evidenceRef:""});

  const selectedRightsSong=useMemo(()=>songs.find((row)=>String(row.id)===rightsSongId),[songs,rightsSongId]);
  const selectedSectionSong=useMemo(()=>songs.find((row)=>String(row.id)===sectionSongId),[songs,sectionSongId]);

  const loadStatus=useCallback(async()=>{
    const response=await fetch("/api/music/juggernaut/commission",{cache:"no-store"});
    const body=await response.json();
    if(response.ok&&body.success===true){
      setReceipts((body.data?.receipts??[]) as Receipt[]);
    }
  },[]);

  useEffect(()=>{void loadStatus();},[loadStatus]);

  async function recommission(){
    setBusy("commission");setMessage("Recomputing commissioning gates…");
    try{
      const response=await fetch("/api/music/juggernaut/commission",{method:"POST"});
      const body=await response.json();
      if(!response.ok||body.success!==true)throw new Error(body.error??"Commissioning failed");
      setMessage(body.data?.liveProviderDataReady
        ?"Live provider evidence is ready."
        :"Commissioning refreshed; missing evidence remains explicitly gated.");
      await Promise.all([loadStatus(),Promise.resolve(onRefresh())]);
    }catch(error){setMessage(error instanceof Error?error.message:"Commissioning failed");}
    finally{setBusy("");}
  }

  async function importRoyalty(){
    if(!royaltyText.trim()){setMessage("Paste the royalty dashboard text first.");return;}
    setBusy("royalty");setMessage("Importing private royalty evidence…");
    try{
      const response=await fetch("/api/music/juggernaut/royalties",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          statementRef:statementRef.trim()||"streaming-dashboard",
          rawText:royaltyText,
          source:"owner-supplied-streaming-dashboard",
          currency:"USD",
          artistName:"Atwood Bookie",
          observedAt:new Date().toISOString(),
        }),
      });
      const body=await response.json();
      if(!response.ok||body.success!==true)throw new Error(body.error??"Royalty import failed");
      const warnings=(body.parse?.warnings??[]) as string[];
      setMessage("Royalty snapshot saved: "+String(body.parse?.serviceLineCount??0)+" service rows, "+String(body.parse?.songLineCount??0)+" song rows."+(
        warnings.length?" "+warnings.join(" "):""
      ));
      await recommission();
    }catch(error){setMessage(error instanceof Error?error.message:"Royalty import failed");setBusy("");}
  }

  async function saveObservation(){
    if(!experimentId||!observation.evidenceRef.trim()){setMessage("Choose an experiment and add an evidence reference.");return;}
    setBusy("observation");setMessage("Saving social observation…");
    try{
      await postJuggernaut("record_observation",{
        projectId,
        experimentId,
        observationKey:"owner-observation:"+experimentId+":"+Date.now(),
        observedAt:new Date().toISOString(),
        metrics:{
          exposures:num(observation.exposures),views:num(observation.views),
          songActions:num(observation.songActions),directFanCaptures:num(observation.directFanCaptures),
          shares:0,saves:0,comments:0,profileVisits:0,
        },
        botRisk:rate(observation.botRisk),
        attributionConfidence:rate(observation.attributionConfidence),
        evidenceRefs:[observation.evidenceRef.trim()],
      });
      setMessage("Observation saved. Recomputing the baseline…");
      await recommission();
    }catch(error){setMessage(error instanceof Error?error.message:"Observation save failed");setBusy("");}
  }

  async function saveCity(){
    if(!city.name.trim()||!city.evidenceRef.trim()){setMessage("City name and evidence reference are required.");return;}
    setBusy("city");setMessage("Saving city-demand evidence…");
    try{
      await postJuggernaut("upsert_city_demand",{
        projectId,
        cityKey:slug(city.name),
        cityName:city.name.trim(),
        listeners:num(city.listeners),directFans:num(city.directFans),showInterest:num(city.showInterest),
        priorAttendees:num(city.priorAttendees),repeatFans:num(city.repeatFans),
        evidenceRefs:[city.evidenceRef.trim()],
        observedAt:new Date().toISOString(),
      });
      setMessage("City-demand evidence saved.");
      await recommission();
    }catch(error){setMessage(error instanceof Error?error.message:"City-demand save failed");setBusy("");}
  }

  async function saveRights(){
    if(!selectedRightsSong||!rights.evidenceRef.trim()){setMessage("Choose a song and provide the document/evidence reference.");return;}
    setBusy("rights");setMessage("Saving rights evidence…");
    try{
      await postJuggernaut("upsert_rights",{
        projectId,
        assetKey:String(selectedRightsSong.song_key),
        masterOwnershipKnown:rights.master,
        publishingKnown:rights.publishing,
        sampleStatus:rights.sampleStatus,
        thirdPartyUsageStatus:rights.thirdPartyStatus,
        evidenceRefs:[rights.evidenceRef.trim()],
      });
      setMessage("Rights evidence saved. Unknown or review-required rights will still block ATTACK.");
      await recommission();
    }catch(error){setMessage(error instanceof Error?error.message:"Rights save failed");setBusy("");}
  }

  async function saveSection(){
    if(!selectedSectionSong||!section.evidenceRef.trim()||!section.label.trim()||section.functions.length===0){
      setMessage("Choose a song and provide label, function, and evidence.");
      return;
    }
    const start=Math.round(Number(section.startSeconds)*1000);
    const end=Math.round(Number(section.endSeconds)*1000);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start){
      setMessage("Section start/end times are invalid.");
      return;
    }
    setBusy("section");setMessage("Saving evidence-backed song section…");
    try{
      const existing=Array.isArray(selectedSectionSong.sections)?selectedSectionSong.sections:[];
      const evidenceRefs=stringArray(selectedSectionSong.evidence_refs);
      await postJuggernaut("upsert_song",{
        projectId,
        songKey:String(selectedSectionSong.song_key),
        title:String(selectedSectionSong.title),
        releaseStatus:String(selectedSectionSong.release_status??"catalog"),
        campaignState:String(selectedSectionSong.campaign_state??"INGESTED"),
        artistConviction:Number(selectedSectionSong.artist_conviction??0.5),
        rightsState:String(selectedSectionSong.rights_state??"review_required"),
        releaseDate:typeof selectedSectionSong.release_date==="string"?selectedSectionSong.release_date:undefined,
        sections:[...existing,{
          id:"section:"+String(selectedSectionSong.song_key)+":"+start,
          songId:String(selectedSectionSong.id),
          startMs:start,endMs:end,label:section.label.trim(),functions:section.functions,
          evidenceRefs:[section.evidenceRef.trim()],
        }],
        evidenceRefs:[...new Set([...evidenceRefs,section.evidenceRef.trim()])],
      });
      setMessage("Song section saved. Commissioning will only mark section intelligence ready when valid evidence-backed sections exist.");
      await recommission();
    }catch(error){setMessage(error instanceof Error?error.message:"Section save failed");setBusy("");}
  }

  const orderedReceipts=useMemo(()=>[...receipts].sort((a,b)=>stageOrder(a.stage)-stageOrder(b.stage)),[receipts]);

  return <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[.035] p-5 md:p-7">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[.28em] text-white/30">Commissioning evidence</p>
        <h2 className="mt-2 text-2xl font-medium">Finish the live-data gates from your phone</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">These controls only save evidence and rerun analysis. They do not publish content, spend money, contact fans, sign rights, or book venues.</p>
      </div>
      <button disabled={Boolean(busy)} onClick={()=>void recommission()} className="rounded-xl border border-white/10 px-4 py-3 text-sm disabled:opacity-40 hover:bg-white/[.06]">
        {busy==="commission"?"Checking…":"Refresh gates"}
      </button>
    </div>

    {message&&<p className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">{message}</p>}

    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {orderedReceipts.map((receipt)=><div key={receipt.stage} className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <p className="text-[10px] text-white/35">{receipt.stage.replace("MUSIC-COMMISSION.","")}</p>
        <p className={"mt-1 text-xs "+(receipt.status==="complete"?"text-emerald-200/80":"text-amber-100/75")}>{receipt.status}</p>
      </div>)}
    </div>

    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <EvidenceCard title="Royalty statement" detail="Paste the distributor dashboard exactly as shown. Private dollar rows go through the authenticated royalty endpoint.">
        <input value={statementRef} onChange={(e)=>setStatementRef(e.target.value)} placeholder="Statement reference" className={inputClass}/>
        <textarea value={royaltyText} onChange={(e)=>setRoyaltyText(e.target.value)} rows={9} placeholder="Paste Streaming / By service / By song export…" className={inputClass+" resize-y"}/>
        <Action busy={busy==="royalty"} label="Import royalty evidence" onClick={()=>void importRoyalty()}/>
      </EvidenceCard>

      <EvidenceCard title="Social observation" detail="Use an actual platform analytics/post URL, screenshot reference, or provider receipt as evidence.">
        <select value={experimentId} onChange={(e)=>setExperimentId(e.target.value)} className={inputClass}>
          <option value="">Choose experiment</option>
          {experiments.map((row)=><option key={String(row.id)} value={String(row.id)}>{String(row.experiment_key??row.id)}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="Exposures" value={observation.exposures} setValue={(v)=>setObservation({...observation,exposures:v})}/>
          <NumberInput label="Views" value={observation.views} setValue={(v)=>setObservation({...observation,views:v})}/>
          <NumberInput label="Song actions" value={observation.songActions} setValue={(v)=>setObservation({...observation,songActions:v})}/>
          <NumberInput label="Direct fans" value={observation.directFanCaptures} setValue={(v)=>setObservation({...observation,directFanCaptures:v})}/>
          <NumberInput label="Bot risk 0–1" value={observation.botRisk} setValue={(v)=>setObservation({...observation,botRisk:v})} step="0.01"/>
          <NumberInput label="Attribution 0–1" value={observation.attributionConfidence} setValue={(v)=>setObservation({...observation,attributionConfidence:v})} step="0.01"/>
        </div>
        <input value={observation.evidenceRef} onChange={(e)=>setObservation({...observation,evidenceRef:e.target.value})} placeholder="Evidence URL / receipt / screenshot reference" className={inputClass}/>
        <Action busy={busy==="observation"} label="Save observation" onClick={()=>void saveObservation()}/>
      </EvidenceCard>

      <EvidenceCard title="City demand" detail="Add only measured city-level demand; catalog availability by itself is not demand evidence.">
        <input value={city.name} onChange={(e)=>setCity({...city,name:e.target.value})} placeholder="City" className={inputClass}/>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="Listeners" value={city.listeners} setValue={(v)=>setCity({...city,listeners:v})}/>
          <NumberInput label="Direct fans" value={city.directFans} setValue={(v)=>setCity({...city,directFans:v})}/>
          <NumberInput label="Show interest" value={city.showInterest} setValue={(v)=>setCity({...city,showInterest:v})}/>
          <NumberInput label="Prior attendees" value={city.priorAttendees} setValue={(v)=>setCity({...city,priorAttendees:v})}/>
          <NumberInput label="Repeat fans" value={city.repeatFans} setValue={(v)=>setCity({...city,repeatFans:v})}/>
        </div>
        <input value={city.evidenceRef} onChange={(e)=>setCity({...city,evidenceRef:e.target.value})} placeholder="Evidence URL / export reference" className={inputClass}/>
        <Action busy={busy==="city"} label="Save city demand" onClick={()=>void saveCity()}/>
      </EvidenceCard>

      <EvidenceCard title="Rights map" detail="This records what your documents establish. Review-required or unknown fields continue blocking paid ATTACK.">
        <select value={rightsSongId} onChange={(e)=>setRightsSongId(e.target.value)} className={inputClass}>
          <option value="">Choose song</option>
          {songs.map((row)=><option key={String(row.id)} value={String(row.id)}>{String(row.title??row.song_key)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-white/65"><input type="checkbox" checked={rights.master} onChange={(e)=>setRights({...rights,master:e.target.checked})}/> Master ownership documented</label>
        <label className="flex items-center gap-2 text-sm text-white/65"><input type="checkbox" checked={rights.publishing} onChange={(e)=>setRights({...rights,publishing:e.target.checked})}/> Publishing ownership documented</label>
        <select value={rights.sampleStatus} onChange={(e)=>setRights({...rights,sampleStatus:e.target.value})} className={inputClass}>
          <option value="review_required">Samples: review required</option><option value="none">Samples: none</option><option value="cleared">Samples: cleared</option><option value="blocked">Samples: blocked</option>
        </select>
        <select value={rights.thirdPartyStatus} onChange={(e)=>setRights({...rights,thirdPartyStatus:e.target.value})} className={inputClass}>
          <option value="review_required">Third-party usage: review required</option><option value="none">Third-party usage: none</option><option value="cleared">Third-party usage: cleared</option><option value="blocked">Third-party usage: blocked</option>
        </select>
        <input value={rights.evidenceRef} onChange={(e)=>setRights({...rights,evidenceRef:e.target.value})} placeholder="Split sheet / agreement / registration evidence reference" className={inputClass}/>
        <Action busy={busy==="rights"} label="Save rights evidence" onClick={()=>void saveRights()}/>
      </EvidenceCard>

      <EvidenceCard title="Song-section evidence" detail="Use measured timestamps from the audio/perception workflow; this never guesses section timing.">
        <select value={sectionSongId} onChange={(e)=>setSectionSongId(e.target.value)} className={inputClass}>
          <option value="">Choose song</option>
          {songs.map((row)=><option key={String(row.id)} value={String(row.id)}>{String(row.title??row.song_key)}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="Start seconds" value={section.startSeconds} setValue={(v)=>setSection({...section,startSeconds:v})} step="0.01"/>
          <NumberInput label="End seconds" value={section.endSeconds} setValue={(v)=>setSection({...section,endSeconds:v})} step="0.01"/>
        </div>
        <input value={section.label} onChange={(e)=>setSection({...section,label:e.target.value})} placeholder="Hook / verse / beat switch / etc." className={inputClass}/>
        <div className="flex flex-wrap gap-2">
          {SECTION_FUNCTIONS.map((fn)=><button type="button" key={fn} onClick={()=>setSection({...section,functions:toggle(section.functions,fn)})} className={"rounded-full border px-3 py-1.5 text-xs "+(section.functions.includes(fn)?"border-white/30 bg-white/10 text-white":"border-white/10 text-white/40")}>{fn}</button>)}
        </div>
        <input value={section.evidenceRef} onChange={(e)=>setSection({...section,evidenceRef:e.target.value})} placeholder="Perception receipt / waveform evidence reference" className={inputClass}/>
        <div className="flex flex-wrap gap-2">
          <Action busy={busy==="section"} label="Save section" onClick={()=>void saveSection()}/>
          <a href="/music/restoration" className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60 hover:bg-white/[.06]">Open audio perception</a>
        </div>
      </EvidenceCard>
    </div>
  </section>;
}

function EvidenceCard({title,detail,children}:{title:string;detail:string;children:React.ReactNode}){
  return <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
    <h3 className="text-lg font-medium">{title}</h3>
    <p className="mt-1 text-xs leading-5 text-white/40">{detail}</p>
    <div className="mt-4 grid gap-3">{children}</div>
  </div>;
}
function Action({busy,label,onClick}:{busy:boolean;label:string;onClick:()=>void}){
  return <button disabled={busy} onClick={onClick} className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black disabled:opacity-40">{busy?"Saving…":label}</button>;
}
function NumberInput({label,value,setValue,step="1"}:{label:string;value:string;setValue:(value:string)=>void;step?:string}){
  return <label className="text-[10px] uppercase tracking-[.16em] text-white/35">{label}<input type="number" min="0" step={step} value={value} onChange={(e)=>setValue(e.target.value)} className={inputClass+" mt-1 normal-case tracking-normal"}/></label>;
}

const inputClass="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25";

async function postJuggernaut(operation:string,payload:Record<string,unknown>):Promise<Record<string,unknown>>{
  const response=await fetch("/api/music/juggernaut",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operation,payload}),
  });
  const body=await response.json();
  if(!response.ok||body.success!==true)throw new Error(body.error??"Music evidence write failed");
  return body.data as Record<string,unknown>;
}
function num(value:string):number{const n=Number(value);return Number.isFinite(n)&&n>=0?Math.floor(n):0;}
function rate(value:string):number{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function slug(value:string):string{return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"city";}
function stringArray(value:unknown):string[]{return Array.isArray(value)?value.map(String).filter(Boolean):[];}
function toggle(values:string[],value:string):string[]{return values.includes(value)?values.filter((item)=>item!==value):[...values,value];}
function stageOrder(stage:string):number{
  if(stage==="MUSIC-COMMISSION.FINAL")return 10;
  const n=Number(stage.split(".").pop());
  return Number.isFinite(n)?n:99;
}
