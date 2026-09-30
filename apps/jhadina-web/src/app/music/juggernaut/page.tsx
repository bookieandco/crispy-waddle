"use client";

import {useCallback,useEffect,useMemo,useState} from "react";

type Row=Record<string,unknown>;
type Outlier={experimentId:string;relativeLift:number;confidence:number;status:"insufficient_sample"|"interesting"|"validated";reasons:string[]};
type Venue={city:string;recommendedCapacity:number;confidence:number;reasons:string[]};
type RankedSong={id:string;title:string;status:string;rightsState:string;evidenceRefs:string[]};
type Certification={passed:boolean;version:string;checks:{name:string;passed:boolean}[]};
type Projection={
  project:Row;songs:Row[];experiments:Row[];observations:Row[];cityDemand:Row[];rights:Row[];learning:Row[];
  outliers:Outlier[];mode:"SEARCH"|"ATTACK";rankedSongs:RankedSong[];venues:Venue[];certification:Certification;dataWarnings:string[];
};

const DEFAULT_ARTIST_KEY="atwood-bookie";
const DEFAULT_ARTIST_NAME="Atwood Bookie";

export default function MusicJuggernautPage(){
  const [artistKey,setArtistKey]=useState(DEFAULT_ARTIST_KEY);
  const [data,setData]=useState<Projection|null>(null);
  const [loading,setLoading]=useState(true);
  const [status,setStatus]=useState("");

  const load=useCallback(async(key=artistKey)=>{
    setLoading(true);setStatus("");
    try{
      const response=await fetch("/api/music/juggernaut?artistKey="+encodeURIComponent(key),{cache:"no-store"});
      const body=await response.json();
      if(!response.ok||body.success!==true)throw new Error(body.error??"Unable to load");
      setData(body.data??null);
    }catch(error){setStatus(error instanceof Error?error.message:"Unable to load Music Juggernaut");}
    finally{setLoading(false);}
  },[artistKey]);

  useEffect(()=>{void load(DEFAULT_ARTIST_KEY);},[load]);

  async function initialize(){
    setStatus("Initializing internal artist-growth project…");
    const response=await fetch("/api/music/juggernaut",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({operation:"upsert_project",payload:{artistKey,name:DEFAULT_ARTIST_NAME,mode:"SEARCH",metadata:{createdFrom:"music-juggernaut-ui"}}}),
    });
    const body=await response.json();
    if(!response.ok||body.success!==true){setStatus(body.error??"Initialization failed");return;}
    setStatus("Artist-growth project ready.");
    await load(artistKey);
  }

  const validated=useMemo(()=>data?.outliers.filter((item)=>item.status==="validated")??[],[data]);
  const topSong=data?.rankedSongs[0];
  const topVenue=useMemo(()=>[...(data?.venues??[])].sort((a,b)=>b.confidence-a.confidence)[0],[data]);
  const rightsReview=useMemo(()=>data?.rights.filter((row)=>
    row.master_ownership_known!==true||row.publishing_known!==true||row.sample_status==="review_required"||row.third_party_usage_status==="review_required"||row.sample_status==="blocked"||row.third_party_usage_status==="blocked"
  )??[],[data]);
  const validatedLearning=useMemo(()=>data?.learning.filter((row)=>row.status==="validated")??[],[data]);

  return <main className="min-h-screen bg-[#07080b] text-white">
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-7 md:px-10 md:pt-10">
      <header className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[.35em] text-white/35">Jhadina Music</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">Juggernaut</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">Search when we do not know. Attack when evidence replicates. Every song, creative, fan, city and dollar stays auditable.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/music" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60 hover:bg-white/[.05]">Music</a>
          <a href="/growth" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60 hover:bg-white/[.05]">Growth</a>
          <a href="/ask-jhadina?surface=music&route=%2Fmusic%2Fjuggernaut" className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black">Ask Jhadina</a>
        </div>
      </header>

      <section className="mt-8 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[.035] p-5 md:flex-row md:items-center">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[.28em] text-white/30">Artist project</p>
          <div className="mt-2 flex gap-2">
            <input value={artistKey} onChange={(event)=>setArtistKey(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none focus:border-white/25" />
            <button onClick={()=>void load()} className="rounded-xl border border-white/10 px-4 py-3 text-sm hover:bg-white/[.06]">Load</button>
          </div>
        </div>
        <div className="md:w-72">
          <p className="text-[10px] uppercase tracking-[.28em] text-white/30">Core certification</p>
          <p className="mt-2 text-sm">{data?.certification?.passed?"Core checks passing":"Not yet certified"}</p>
          <p className="mt-1 text-xs text-white/35">{data?.certification?.version??"No projection loaded"}</p>
        </div>
      </section>

      {status&&<p className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white/65">{status}</p>}
      {loading&&<div className="mt-10 text-sm text-white/40">Loading Music Juggernaut…</div>}
      {!loading&&!data&&<section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[.04] p-8">
        <h2 className="text-2xl font-medium">Initialize the artist-growth brain.</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">This creates internal owner-scoped planning state only. It does not publish, spend, contact fans, book venues or grant rights.</p>
        <button onClick={()=>void initialize()} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black">Initialize {DEFAULT_ARTIST_NAME}</button>
      </section>}

      {data&&<>
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Metric label="Mode" value={data.mode} detail={data.mode==="ATTACK"?"Concentrate on validated signal":"Maximize learning; keep spend light"} />
          <Metric label="Catalog priority" value={topSong?.title??"Need evidence"} detail={topSong?"Current evidence rank, not artistic judgment":"Ingest songs + observations"} />
          <Metric label="Validated outliers" value={String(validated.length)} detail={data.outliers.length+" scored experiment signal(s)"} />
          <Metric label="Validated learnings" value={String(validatedLearning.length)} detail="Durable, evidence-backed campaign memory" />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Panel title="Catalog decision set" kicker="SONGS">
            {data.rankedSongs.length?data.rankedSongs.slice(0,8).map((song,index)=><RowLine key={song.id} title={(index+1)+". "+song.title} meta={song.status+" · rights "+song.rightsState} />):<Empty text="No songs are in the growth warehouse yet."/>}
          </Panel>
          <Panel title="Experiment intelligence" kicker="SEARCH → ATTACK">
            {data.outliers.length?data.outliers.slice(0,8).map((item)=><RowLine key={item.experimentId} title={item.experimentId} meta={item.status+" · lift "+item.relativeLift.toFixed(2)+"× · confidence "+Math.round(item.confidence*100)+"%"} />):<Empty text="No scored observations yet. Jhadina should explore before scaling."/>}
          </Panel>
          <Panel title="Live demand" kicker="GEOGRAPHY">
            {data.venues.length?data.venues.slice(0,8).map((venue)=><RowLine key={venue.city} title={venue.city} meta={"≈"+venue.recommendedCapacity+" cap · confidence "+Math.round(venue.confidence*100)+"%"} />):<Empty text="No city-demand snapshots yet."/>}
            {topVenue&&<a href={"/ask-jhadina?surface=music&route=%2Fmusic%2Fjuggernaut&prompt="+encodeURIComponent("Audit where I should perform next based on my music demand")} className="mt-4 inline-flex text-xs text-white/55 underline decoration-white/20 underline-offset-4">Ask Jhadina to audit live markets</a>}
          </Panel>
          <Panel title="Rights & scale gate" kicker="PROTECT">
            {rightsReview.length?rightsReview.slice(0,8).map((row)=><RowLine key={String(row.id)} title={String(row.asset_key??row.id)} meta={"sample "+String(row.sample_status??"unknown")+" · third party "+String(row.third_party_usage_status??"unknown")} />):<Empty text={data.rights.length?"No stored blocking/review state in the current rights rows.":"No rights records yet—map ownership before aggressive scale."}/>}
          </Panel>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <Panel title="Durable learning" kicker="MEMORY">
            {data.learning.length?data.learning.slice(0,10).map((row)=><RowLine key={String(row.id)} title={String(row.finding??row.learning_key)} meta={String(row.status)+" · confidence "+Math.round(Number(row.confidence??0)*100)+"%"} />):<Empty text="No campaign learning has been admitted yet."/>}
          </Panel>
          <Panel title="System integrity" kicker="AUDIT">
            <RowLine title="No fake growth" meta="Bots, fake UGC and manufactured social proof are not learning-eligible." />
            <RowLine title="No silent spend" meta="Paid scale stays behind existing approved-budget and paid-ad authority." />
            <RowLine title="No silent rights grants" meta="Contracts, rights and venue commitments remain human-authorized." />
            <RowLine title="Human relationship stays human" meta="Jhadina surfaces supporters; she does not impersonate personal care." />
          </Panel>
        </section>

        {data.dataWarnings.length>0&&<section className="mt-8 rounded-3xl border border-amber-200/15 bg-amber-200/[.035] p-6">
          <p className="text-[10px] uppercase tracking-[.28em] text-amber-100/50">Data quality</p>
          <div className="mt-3 space-y-2">{data.dataWarnings.map((warning)=><p key={warning} className="text-sm text-white/55">{warning}</p>)}</div>
        </section>}
      </>}
    </div>
  </main>;
}

function Metric({label,value,detail}:{label:string;value:string;detail:string}){return <article className="rounded-3xl border border-white/10 bg-white/[.035] p-5"><p className="text-[10px] uppercase tracking-[.28em] text-white/30">{label}</p><p className="mt-3 truncate text-2xl font-medium">{value}</p><p className="mt-2 text-xs leading-5 text-white/35">{detail}</p></article>;}
function Panel({title,kicker,children}:{title:string;kicker:string;children:React.ReactNode}){return <section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6"><p className="text-[10px] uppercase tracking-[.28em] text-white/30">{kicker}</p><h2 className="mt-2 text-xl font-medium">{title}</h2><div className="mt-5 divide-y divide-white/5">{children}</div></section>;}
function RowLine({title,meta}:{title:string;meta:string}){return <div className="py-3 first:pt-0 last:pb-0"><p className="text-sm text-white/80">{title}</p><p className="mt-1 text-xs leading-5 text-white/35">{meta}</p></div>;}
function Empty({text}:{text:string}){return <p className="py-4 text-sm leading-6 text-white/35">{text}</p>;}
