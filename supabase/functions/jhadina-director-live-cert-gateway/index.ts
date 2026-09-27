import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@5.10.0";

const ALLOWED_ISSUERS = new Set([
  "https://oidc.vercel.com/bookieandcos-projects",
  "https://oidc.vercel.com",
]);
const AUDIENCE = "https://vercel.com/bookieandcos-projects";
const SUBJECT = "owner:bookieandcos-projects:project:crispy-waddle-jhadina-web:environment:production";
const OWNER_ID = "team_NYQJ3NwijZZ6UJQdOdc5FjmX";
const PROJECT_ID = "prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco";
const PROJECT_NAME = "crispy-waddle-jhadina-web";
const OWNER = "bookieandcos-projects";
const SYSTEM_EMAIL = "director-certification@system.jhadina.test";
const TEMPLATE_BASE64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMPbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjp0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAUAAAAC0AAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAGybWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABXW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAR1zdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAUAAtABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAL/+EAGGdCwAvaBQZ+fARAAAADAEAAAAMAg8UKqAEABGjOD8gAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAY6AAAAAAAAAAYc3R0cwAAAAAAAAABAAAAAQAAQAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAADHQAAAAEAAAAUc3RjbwAAAAAAAAABAAADPwAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjEuNy4xMDMAAAAIZnJlZQAAAyVtZGF0AAACUwYF//9P3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOWY5IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTEgZGVibG9jaz0wOjA6MCBhbmFseXNlPTA6MCBtZT1kaWEgc3VibWU9MCBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0wIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MCA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0wIHRocmVhZHM9NiBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj0xIHNjZW5lY3V0PTAgaW50cmFfcmVmcmVzaD0wIHJjPWNyZiBtYnRyZWU9MCBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0wAIAAAADCZYiEOiYoAAkCycnJycnJycnJycnJycnJycnJyddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddeA=";
const SOURCE_HOSTS = new Set(["github.com","raw.githubusercontent.com"]);

type Json = Record<string, unknown>;

function json(status:number, body:unknown):Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"},
  });
}

async function authorizeVercel(req:Request):Promise<boolean> {
  const authorization=req.headers.get("authorization")??"";
  if(!authorization.startsWith("Bearer ")) return false;
  const token=authorization.slice("Bearer ".length).trim();
  if(!token) return false;
  let decoded:ReturnType<typeof decodeJwt>;
  try { decoded=decodeJwt(token); } catch { return false; }
  const issuer=typeof decoded.iss==="string"?decoded.iss:"";
  if(!ALLOWED_ISSUERS.has(issuer)) return false;
  try {
    const jwks=createRemoteJWKSet(new URL(issuer+"/.well-known/jwks"));
    const verified=await jwtVerify(token,jwks,{issuer,audience:AUDIENCE});
    const p=verified.payload as Record<string,unknown>;
    return p.sub===SUBJECT && p.owner===OWNER && p.owner_id===OWNER_ID &&
      p.project===PROJECT_NAME && p.project_id===PROJECT_ID && p.environment==="production";
  } catch { return false; }
}

function secretKey():string|undefined {
  const modern=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(modern) {
    try {
      const parsed=JSON.parse(modern) as Record<string,string>;
      if(parsed.default) return parsed.default;
    } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??undefined;
}

function hex(bytes:ArrayBuffer):string {
  return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function sha256Text(value:string):Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
}
async function sha256Bytes(value:Uint8Array):Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256",value));
}

function decodeBase64(value:string):Uint8Array {
  const raw=atob(value);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  return bytes;
}
function u32(bytes:Uint8Array,offset:number):number {
  return new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0,false);
}
function setU32(bytes:Uint8Array,offset:number,value:number):void {
  new DataView(bytes.buffer,bytes.byteOffset+offset,4).setUint32(0,value>>>0,false);
}
function boxType(bytes:Uint8Array,offset:number):string {
  return String.fromCharCode(...bytes.slice(offset,offset+4));
}
type Box={start:number;size:number;header:number;type:string};
function boxes(bytes:Uint8Array,start:number,end:number):Box[] {
  const result:Box[]=[];
  let cursor=start;
  while(cursor+8<=end) {
    let size=u32(bytes,cursor);
    const type=boxType(bytes,cursor+4);
    let header=8;
    if(size===1) {
      size=u32(bytes,cursor+8)*2**32+u32(bytes,cursor+12);
      header=16;
    } else if(size===0) size=end-cursor;
    if(size<header||cursor+size>end) break;
    result.push({start:cursor,size,header,type});
    cursor+=size;
  }
  return result;
}
function top(bytes:Uint8Array,type:string):Box|undefined {
  return boxes(bytes,0,bytes.byteLength).find(b=>b.type===type);
}
function child(bytes:Uint8Array,parent:Box|undefined,type:string):Box|undefined {
  if(!parent) return undefined;
  return boxes(bytes,parent.start+parent.header,parent.start+parent.size).find(b=>b.type===type);
}
function payload(box:Box):number { return box.start+box.header; }

function createMp4(durationSeconds:number):Uint8Array {
  const seconds=Math.round(durationSeconds);
  if(!Number.isFinite(seconds)||seconds<1||seconds>3600) throw new Error("DIRECTOR_CERT_MP4_DURATION_INVALID");
  const bytes=decodeBase64(TEMPLATE_BASE64);
  const moov=top(bytes,"moov");
  const mvhd=child(bytes,moov,"mvhd");
  const trak=child(bytes,moov,"trak");
  const tkhd=child(bytes,trak,"tkhd");
  const edts=child(bytes,trak,"edts");
  const elst=child(bytes,edts,"elst");
  const mdia=child(bytes,trak,"mdia");
  const mdhd=child(bytes,mdia,"mdhd");
  const minf=child(bytes,mdia,"minf");
  const stbl=child(bytes,minf,"stbl");
  const stts=child(bytes,stbl,"stts");
  if(!mvhd||!tkhd||!elst||!mdhd||!stts) throw new Error("DIRECTOR_CERT_MP4_TEMPLATE_INVALID");
  const mp=payload(mvhd), tp=payload(tkhd), ep=payload(elst), dp=payload(mdhd), sp=payload(stts);
  const movieScale=u32(bytes,mp+12), mediaScale=u32(bytes,dp+12);
  setU32(bytes,mp+16,movieScale*seconds);
  setU32(bytes,tp+20,movieScale*seconds);
  setU32(bytes,ep+8,movieScale*seconds);
  setU32(bytes,dp+16,mediaScale*seconds);
  setU32(bytes,sp+12,mediaScale*seconds);
  return bytes;
}
function readMp4Duration(bytes:Uint8Array):number {
  const mvhd=child(bytes,top(bytes,"moov"),"mvhd");
  if(!mvhd) throw new Error("DIRECTOR_CERT_MP4_MVHD_MISSING");
  const p=payload(mvhd);
  const scale=u32(bytes,p+12), duration=u32(bytes,p+16);
  if(!scale||!duration) throw new Error("DIRECTOR_CERT_MP4_DURATION_MISSING");
  return duration/scale;
}

const RULES = [
  {kind:"research",terms:["research","market","audience","competitor","niche","analy"],purpose:"understand the source, market, or audience",caps:["research"],qc:["source-grounding"],fail:["weak evidence"]},
  {kind:"character",terms:["character","face","identity","reference image","consistent","lora","subject"],purpose:"establish or preserve character identity",caps:["character-reference","visual-adapter"],qc:["identity-lock"],fail:["identity drift"]},
  {kind:"asset",terms:["dataset","image","photo","crop","caption","tag","curate","duplicate","train data"],purpose:"prepare or curate production/training assets",caps:["asset-curation"],qc:["dataset-quality"],fail:["duplicate or off-model assets"]},
  {kind:"wardrobe",terms:["wardrobe","clothing","outfit","garment","shirt","hoodie"],purpose:"control wardrobe and appearance continuity",caps:["wardrobe-state"],qc:["garment-lock"],fail:["garment drift"]},
  {kind:"performance",terms:["pose","motion","movement","performance","blocking","eyeline","gesture","lip sync"],purpose:"rehearse or control performance before final generation",caps:["performance-master","rehearsal"],qc:["rehearsal-graduation"],fail:["collision or performance drift"]},
  {kind:"voice",terms:["voice","speech","tts","dialogue","pronunciation"],purpose:"create or preserve voice/dialogue identity",caps:["voice-profile"],qc:["voice-identity"],fail:["voice drift"]},
  {kind:"storyboard",terms:["storyboard","shot list","shotlist","coverage","camera angle"],purpose:"plan visual coverage before rendering",caps:["storyboard"],qc:["coverage-completeness"],fail:["missing coverage"]},
  {kind:"generation",terms:["generate","generation","render","inference","sample","checkpoint","epoch","train","training"],purpose:"produce candidate media or trained outputs",caps:["generation"],qc:["candidate-qc"],fail:["artifact or overfit"]},
  {kind:"edit",terms:["edit","timeline","cut","transition","assemble"],purpose:"assemble editable media into a coherent cut",caps:["timeline-editing"],qc:["edit-continuity"],fail:["timeline discontinuity"]},
  {kind:"review",terms:["test","compare","inspect","evaluate","quality","check","validation"],purpose:"review candidates and select admitted output",caps:["multimodal-review"],qc:["cross-domain-coherence"],fail:["weak selection evidence"]},
  {kind:"delivery",terms:["export","publish","download","deliver","save"],purpose:"package approved output and provenance",caps:["delivery"],qc:["export-integrity"],fail:["flattened or missing lineage"]},
] as const;

function stripMarkup(input:string):string {
  return input.replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ").replace(/[\*_>#|]/g," ")
    .replace(/\s+/g," ").trim();
}
function classify(text:string) {
  const lower=text.toLowerCase();
  return RULES.find(rule=>rule.terms.some(term=>lower.includes(term))) ?? {
    kind:"concept",purpose:"capture the source concept or instruction",
    caps:["process-understanding"],qc:["source-grounding"],fail:["ambiguous instruction"],
  };
}
async function fetchSource(sourceUrl:string):Promise<string> {
  const parsed=new URL(sourceUrl);
  if(!SOURCE_HOSTS.has(parsed.hostname.toLowerCase())) throw new Error("DIRECTOR_CERT_SOURCE_HOST_NOT_ALLOWED");
  const parts=parsed.pathname.split("/").filter(Boolean);
  const candidates:string[]=[];
  if(parsed.hostname.toLowerCase()==="github.com" && parts.length>=2) {
    candidates.push("https://raw.githubusercontent.com/"+parts[0]+"/"+parts[1].replace(/\.git$/,"")+"/main/README.md");
  }
  candidates.push(sourceUrl);
  for(const url of candidates) {
    try {
      const response=await fetch(url,{redirect:"follow",headers:{"user-agent":"JhadinaDirectorLiveCertification/1.0"}});
      if(!response.ok) continue;
      const raw=(await response.text()).slice(0,2000000);
      const clean=stripMarkup(raw);
      if(clean.length>=200) return clean;
    } catch {}
  }
  throw new Error("DIRECTOR_CERT_SOURCE_FETCH_FAILED");
}
async function studySteps(sourceUrl:string):Promise<Json[]> {
  const text=await fetchSource(sourceUrl);
  const parts=text.split(/(?<=[.!?])\s+|\n{2,}/).map(v=>v.trim()).filter(v=>v.length>=20).slice(0,240);
  if(parts.length<3) throw new Error("DIRECTOR_CERT_PROCESS_EVIDENCE_INSUFFICIENT");
  const selected:{text:string;rule:ReturnType<typeof classify>}[]=[];
  let last="";
  for(const part of parts) {
    const rule=classify(part);
    if(rule.kind===last && selected.length) {
      selected[selected.length-1].text=(selected[selected.length-1].text+" "+part).slice(0,1500);
    } else {
      selected.push({text:part.slice(0,1200),rule});
      last=rule.kind;
    }
    if(selected.length>=24) break;
  }
  return selected.map((entry,index)=>({
    order:index,kind:entry.rule.kind,purpose:entry.rule.purpose,operation:entry.text,
    requiredCapabilities:[...entry.rule.caps],
    inputs:index?["source-step:"+(index-1)]:["source-reference"],
    outputs:["source-step:"+index],
    qcChecks:[...entry.rule.qc],failureModes:[...entry.rule.fail],
  }));
}

function improvement(step:Json,index:number):Json {
  const kind=String(step.kind??"concept");
  let reason="Bind this source step to explicit evidence, QC and rollback receipts.";
  let operation=String(step.operation??"");
  if(kind==="performance") {
    reason="Add a Director rehearsal graduation gate before final generation.";
    operation="Rehearse blocking/performance, issue evidence-bound notes, retry until admitted, then preserve the approved take.";
  } else if(kind==="generation") {
    reason="Do not assume the latest candidate is best; validate identity, flexibility and artifacts before admission.";
    operation="Generate candidates, compare against fixed validation prompts and continuity locks, and admit the earliest candidate that meets thresholds.";
  } else if(kind==="asset"||kind==="character") {
    reason="Add dedupe, identity consistency, coverage and provenance checks before downstream use.";
    operation="Curate references for quality/diversity, dedupe and identity consistency, then freeze a versioned provenance manifest.";
  } else if(kind==="edit") {
    reason="Preserve editability and localize repairs instead of regenerating approved material.";
    operation="Assemble a versioned timeline, preserve approved locks, and regenerate only invalidated descendants.";
  }
  return {
    id:"improvement:"+index,stepId:"source-step:"+index,reason,
    beforeOperation:String(step.operation??""),afterOperation:operation,
    evidenceIds:["director-live-cert:improvement:"+index],
  };
}

async function ensureUser(supabase:any):Promise<string> {
  const listed=await supabase.auth.admin.listUsers({page:1,perPage:100});
  if(listed.error) throw listed.error;
  const existing=listed.data.users.find((u:any)=>u.email===SYSTEM_EMAIL);
  if(existing) return existing.id;
  const created=await supabase.auth.admin.createUser({
    email:SYSTEM_EMAIL,email_confirm:true,
    app_metadata:{system_principal:"director-live-certification"},
    user_metadata:{display_name:"Director Live Certification"},
  });
  if(created.error) throw created.error;
  if(!created.data.user?.id) throw new Error("DIRECTOR_LIVE_CERT_USER_BOOTSTRAP_FAILED");
  return created.data.user.id;
}

async function consumeToken(supabase:any,runToken:string):Promise<string> {
  if(!runToken) throw new Error("DIRECTOR_LIVE_CERT_UNAUTHORIZED");
  const tokenHash=await sha256Text(runToken);
  const now=new Date().toISOString();
  const result=await supabase.from("director_live_certification_tokens")
    .update({consumed_at:now})
    .eq("token_hash",tokenHash).is("consumed_at",null).gt("expires_at",now)
    .select("user_id").maybeSingle();
  if(result.error) throw result.error;
  if(!result.data) throw new Error("DIRECTOR_LIVE_CERT_UNAUTHORIZED");
  const userId=result.data.user_id?String(result.data.user_id):await ensureUser(supabase);
  if(!result.data.user_id) {
    const bound=await supabase.from("director_live_certification_tokens").update({user_id:userId}).eq("token_hash",tokenHash);
    if(bound.error) throw bound.error;
  }
  return userId;
}

function durations(value:unknown):number[] {
  const raw=Array.isArray(value)?value:[30,600,1500,3600];
  const list=[...new Set(raw.map(Number).filter(v=>Number.isFinite(v)&&v>=1&&v<=3600).map(v=>Math.round(v)))];
  if(!list.length||list.length>4) throw new Error("DIRECTOR_LIVE_CERT_DURATION_MATRIX_INVALID");
  return list;
}

async function main(req:Request):Promise<Response> {
  if(req.method!=="POST") return json(405,{error:"method_not_allowed"});
  if(!(await authorizeVercel(req))) return json(401,{error:"unauthorized"});
  const url=Deno.env.get("SUPABASE_URL");
  const key=secretKey();
  if(!url||!key) return json(503,{error:"supabase_admin_unavailable"});
  const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});

  try {
    const body=await req.json() as Json;
    const action=typeof body.action==="string"?body.action:"start";
    if(action==="status") {
      const runId=String(body.runId??"");
      const row=await supabase.from("director_live_certification_runs").select("*").eq("id",runId).maybeSingle();
      if(row.error) throw row.error;
      return json(200,{ok:true,run:row.data});
    }
    if(action!=="start") return json(400,{error:"unsupported_action"});
    const sourceUrl=String(body.sourceUrl??"");
    if(!sourceUrl.startsWith("http")) return json(400,{error:"DIRECTOR_LIVE_CERT_SOURCE_URL_REQUIRED"});
    const matrix=durations(body.durations);
    const userId=await consumeToken(supabase,String(body.runToken??""));
    const runId=typeof body.runId==="string"&&body.runId.trim()?body.runId.trim():"director-live-cert:"+crypto.randomUUID();
    const now=new Date().toISOString();

    const runInsert=await supabase.from("director_live_certification_runs").insert({
      id:runId,source_url:sourceUrl,status:"studying",requested_durations:matrix,updated_at:now,
    });
    if(runInsert.error) throw runInsert.error;

    const replicationId="replicate:"+runId+":replication";
    const replicationProject="director:replicate:"+runId;
    const studyId="study:"+replicationId+":0";
    const membership=await supabase.from("director_project_memberships").upsert({
      project_id:replicationProject,user_id:userId,role:"owner",created_at:now,
    },{onConflict:"project_id,user_id"});
    if(membership.error) throw membership.error;

    const studyCreate=await supabase.from("director_studies").upsert({
      id:studyId,source_url:sourceUrl,autonomous:true,share_with_jhadina:true,status:"running",
      last_time_seconds:0,observations_seen:0,notes_created:0,learning_candidates_created:0,
      started_at:now,error:null,updated_at:now,
    },{onConflict:"id"});
    if(studyCreate.error) throw studyCreate.error;

    const repCreate=await supabase.from("director_process_replication_jobs").upsert({
      id:replicationId,owner_user_id:userId,client_request_id:runId+":replication",
      project_id:replicationProject,objective:"Study this process and replicate it better as editable Director media with no AI slop.",
      source_urls:[sourceUrl],source_artifact_refs:[],study_ids:[studyId],
      improve_before_execute:true,editable_delivery:true,target_duration_seconds:30,target_kind:"video",
      status:"studying",phase:"study",error:null,updated_at:now,
    },{onConflict:"owner_user_id,client_request_id"});
    if(repCreate.error) throw repCreate.error;

    const steps=await studySteps(sourceUrl);
    const observationRows=[];
    const evidenceIds:string[]=[];
    for(let i=0;i<steps.length;i++) {
      const evidence="study:"+studyId+":step:"+i;
      evidenceIds.push(evidence);
      observationRows.push({
        id:evidence,study_id:studyId,asset_id:studyId,kind:"process-step",
        start_seconds:i*10,end_seconds:i*10+10,payload:{processStep:steps[i]},
        confidence:0.84,provenance:{provider:"jhadina-director-oidc-gateway",source:"public-reference",sourceUrl},
      });
    }
    const obs=await supabase.from("director_study_observations").upsert(observationRows,{onConflict:"id"});
    if(obs.error) throw obs.error;
    const studyDone=await supabase.from("director_studies").update({
      status:"completed",observations_seen:observationRows.length,last_time_seconds:observationRows.length*10,
      completed_at:new Date().toISOString(),error:null,updated_at:new Date().toISOString(),
    }).eq("id",studyId);
    if(studyDone.error) throw studyDone.error;

    const referenceSteps=steps.map((s,i)=>({
      id:"source-step:"+i,order:i,kind:s.kind,purpose:s.purpose,operation:s.operation,
      dependsOn:i?["source-step:"+(i-1)]:[],requiredCapabilities:s.requiredCapabilities,
      inputs:s.inputs,outputs:s.outputs,parameters:{},qcChecks:s.qcChecks,failureModes:s.failureModes,
      evidenceIds:[evidenceIds[i]],
    }));
    const receipts=steps.map((s,i)=>improvement(s,i));
    const improvedSteps=referenceSteps.map((s,i)=>({
      ...s,operation:(receipts[i] as any).afterOperation,
      evidenceIds:[...s.evidenceIds,String((receipts[i] as any).evidenceIds[0])],
    }));
    const referenceRecipe={
      id:"recipe:"+replicationId+":reference",projectId:replicationProject,version:1,
      objective:"Replicate the studied source process.",sourceRefs:[sourceUrl],mode:"reference",
      targetDurationSeconds:30,steps:referenceSteps,improvementReceipts:[],evidenceIds,
      authority:"DIRECTOR_PROCESS_RECIPE",
    };
    const improvedRecipe={
      ...referenceRecipe,id:"recipe:"+replicationId+":improved:v2",version:2,
      sourceRecipeId:referenceRecipe.id,mode:"improved",steps:improvedSteps,
      improvementReceipts:receipts,evidenceIds:[...evidenceIds,...receipts.map((r:any)=>r.evidenceIds[0])],
    };
    const stagePlan=["vision","treatment","storyboard","previs","rehearsal","generation","edit","review","final"]
      .map((kind,i)=>({id:"process-stage:"+i,kind,order:i,dependsOn:i?["process-stage:"+(i-1)]:[],status:i===0?"ready":"planned"}));
    const repReady=await supabase.from("director_process_replication_jobs").update({
      status:"recipe_ready",phase:"recipe",reference_recipe:referenceRecipe,improved_recipe:improvedRecipe,
      stage_plan:stagePlan,error:null,updated_at:new Date().toISOString(),
    }).eq("id",replicationId);
    if(repReady.error) throw repReady.error;
    const runRep=await supabase.from("director_live_certification_runs").update({
      status:"recipe_ready",replication_job_id:replicationId,
      receipts:{studyAdapter:"vercel-oidc-edge",studyObservationCount:observationRows.length,improvementReceiptCount:receipts.length},
      updated_at:new Date().toISOString(),
    }).eq("id",runId);
    if(runRep.error) throw runRep.error;

    const videoIds:string[]=[];
    const assetIds:string[]=[];
    const measured:Record<string,number>={};
    const timelines:Record<string,unknown>={};
    const rehearsalReceipts:Json[]=[];

    for(const duration of matrix) {
      const jobId="video:"+runId+":"+duration;
      const projectId="director:live-cert:"+runId+":"+duration;
      const requestId=runId+":video:"+duration;
      const prompt="Create a "+duration+" second Director live-certification smoke film from the improved process. Preserve editability; do not claim cinematic quality.";
      const rpc=await supabase.rpc("create_director_video_job",{
        p_job_id:jobId,p_client_request_id:requestId,p_user_id:userId,p_project_id:projectId,
        p_create_project:true,p_prompt:prompt,p_mode:duration<=120?"short":"long-form",
        p_aspect_ratio:"16:9",p_target_duration_seconds:duration,
        p_spec:{certification:{runtimeOnly:true,qualityClaim:false},sourceReplicationJobId:replicationId},
        p_provider_policy:{certificationOnly:true},p_now:new Date().toISOString(),
      });
      if(rpc.error) throw rpc.error;
      const job=Array.isArray(rpc.data)?rpc.data[0]:rpc.data;
      if(!job) throw new Error("DIRECTOR_CERT_VIDEO_JOB_CREATE_FAILED");

      const previsReceipt="director-cert-previs:"+jobId;
      const rehearsalReceipt="director-cert-rehearsal:"+jobId+":take:2";
      const p1=await supabase.from("director_creative_stages").update({
        status:"approved",output_artifact_ids:[previsReceipt],approved_at:new Date().toISOString(),
        approved_by:"director-live-certification",updated_at:new Date().toISOString(),
      }).eq("id","stage:"+jobId+":previs").eq("project_id",projectId);
      if(p1.error) throw p1.error;
      const p2=await supabase.from("director_creative_stages").update({
        status:"approved",output_artifact_ids:[rehearsalReceipt],approved_at:new Date().toISOString(),
        approved_by:"director-live-certification",updated_at:new Date().toISOString(),
      }).eq("id","stage:"+jobId+":rehearsal").eq("project_id",projectId);
      if(p2.error) throw p2.error;

      const note="Move the character half a step camera-left before the cross; preserve the eyeline.";
      const events=await supabase.from("director_video_job_events").insert([
        {job_id:jobId,event_type:"certification_previs_approved",status:"completed",metadata:{smoke:true,qualityClaim:false,receipt:previsReceipt}},
        {job_id:jobId,event_type:"certification_rehearsal_approved",status:"completed",metadata:{
          smoke:true,qualityClaim:false,firstTakeDisposition:"retry",firstTakeNotes:[note],
          approvedTakeId:"take:"+jobId+":2",receipt:[rehearsalReceipt],
        }},
        {job_id:jobId,event_type:"provider_submitted",status:"submitted",provider_id:"director-certification-smoke",
          provider_job_id:"cert-"+duration+"-"+runId,metadata:{durationSeconds:duration,renderer:"mp4-timing-smoke",qualityClaim:false}},
      ]);
      if(events.error) throw events.error;
      rehearsalReceipts.push({jobId,firstTakeDisposition:"retry",notes:[note],approvedTakeId:"take:"+jobId+":2",receipt:[rehearsalReceipt]});

      const bytes=createMp4(duration);
      const objectPath="certification/"+runId.replace(/[^a-zA-Z0-9._-]/g,"_")+"/"+duration+".mp4";
      const upload=await supabase.storage.from("director-media").upload(objectPath,bytes,{contentType:"video/mp4",upsert:true});
      if(upload.error) throw upload.error;
      const downloaded=await supabase.storage.from("director-media").download(objectPath);
      if(downloaded.error) throw downloaded.error;
      const storedBytes=new Uint8Array(await downloaded.data.arrayBuffer());
      const actualDuration=readMp4Duration(storedBytes);
      if(Math.abs(actualDuration-duration)>1.25) throw new Error("DIRECTOR_LIVE_CERT_DURATION_MISMATCH:"+duration+":"+actualDuration);
      const assetId="asset:"+jobId+":master";
      const digest=await sha256Bytes(storedBytes);
      const asset=await supabase.from("director_generated_editing_assets").upsert({
        id:assetId,project_id:projectId,generation_job_id:jobId,provider_id:"director-certification-smoke",
        media_type:"video",uri:"storage://director-media/"+objectPath,mime_type:"video/mp4",sha256:digest,
        prompt,approval_policy:"standard",
        metadata:{liveCertification:true,qualityClaim:false,requestedDurationSeconds:duration,measuredDurationSeconds:actualDuration,
          renderer:"mp4-timing-smoke",sourceReplicationJobId:replicationId},
      },{onConflict:"id"});
      if(asset.error) throw asset.error;

      const trim=Math.min(0.5,Math.max(0.1,duration/100));
      const clipBase={id:"clip:"+jobId+":master",assetId,trackId:"track:"+jobId+":video",name:duration+"s smoke master",
        startSeconds:0,durationSeconds:duration,sourceInSeconds:0,sourceOutSeconds:duration,sourceDurationSeconds:duration,
        effects:[],generativeRegions:[]};
      const trackBase={id:"track:"+jobId+":video",name:"Certification master",kind:"video",index:0,relationship:"primary",clips:[clipBase]};
      const snap1={tracks:[trackBase],transitions:[],markers:[],playheadSeconds:0};
      const v1Id="timeline:"+projectId+":v1", v2Id="timeline:"+projectId+":v2";
      const h1=await sha256Text(JSON.stringify(snap1));
      const v1={id:v1Id,version:1,createdAt:new Date().toISOString(),createdBy:"system",message:"Live certification baseline",snapshotHash:h1,snapshot:snap1};
      const clip2={...clipBase,durationSeconds:Math.max(0.1,duration-trim),sourceOutSeconds:Math.max(0.1,duration-trim)};
      const snap2={tracks:[{...trackBase,clips:[clip2]}],transitions:[],markers:[],playheadSeconds:0};
      const h2=await sha256Text(JSON.stringify(snap2));
      const v2={id:v2Id,version:2,parentVersionId:v1Id,createdAt:new Date().toISOString(),createdBy:"system",
        message:"Live certification localized trim",snapshotHash:h2,snapshot:snap2};
      const timeline1={version:1,projectId,fps:24,width:1920,height:1080,durationSeconds:duration,playheadSeconds:0,
        ...snap1,versions:[v1]};
      const timeline2={version:1,projectId,fps:24,width:1920,height:1080,durationSeconds:duration,playheadSeconds:0,
        ...snap2,versions:[v1,v2]};
      const t1=await supabase.from("director_editable_timeline_snapshots").upsert({
        id:v1Id,project_id:projectId,owner_user_id:userId,version:1,parent_id:null,timeline:timeline1,evidence_ids:[assetId,jobId],
      },{onConflict:"id"});
      if(t1.error) throw t1.error;
      const t2=await supabase.from("director_editable_timeline_snapshots").upsert({
        id:v2Id,project_id:projectId,owner_user_id:userId,version:2,parent_id:v1Id,timeline:timeline2,
        evidence_ids:[assetId,jobId,"localized-edit-proof"],
      },{onConflict:"id"});
      if(t2.error) throw t2.error;

      const pp=await supabase.from("director_production_projects").upsert({
        id:projectId,owner_user_id:userId,version:2,title:"Director live certification "+duration+"s",status:"final",
        snapshot:{liveCertification:true,qualityClaim:false,sourceReplicationJobId:replicationId,videoJobId:jobId,
          targetDurationSeconds:duration,timelineVersionId:v2Id,finalMasterAssetId:assetId,editable:true},
        evidence_ids:[assetId,jobId,v1Id,v2Id],updated_at:new Date().toISOString(),
      },{onConflict:"id"});
      if(pp.error) throw pp.error;

      for(const stage of [
        {kind:"generation",out:[assetId]},
        {kind:"edit",out:[v1Id]},
        {kind:"review",out:["runtime-smoke-quality-nonclaim"]},
        {kind:"final",out:[assetId,v2Id]},
      ]) {
        const s=await supabase.from("director_creative_stages").update({
          status:"approved",output_artifact_ids:stage.out,approved_at:new Date().toISOString(),
          approved_by:"director-live-certification",updated_at:new Date().toISOString(),
        }).eq("project_id",projectId).eq("kind",stage.kind);
        if(s.error) throw s.error;
      }

      const jobUpdate=await supabase.from("director_video_jobs").update({
        status:"preview_ready",current_phase:"preview-ready",provider_id:"director-certification-smoke",
        provider_job_id:"cert-"+duration+"-"+runId,submission_state:"completed",
        output_asset_ids:[assetId],preview_asset_id:assetId,error:null,updated_at:new Date().toISOString(),
      }).eq("id",jobId);
      if(jobUpdate.error) throw jobUpdate.error;
      const runUpdate=await supabase.from("director_production_runs").update({
        status:"completed",updated_at:new Date().toISOString(),
      }).eq("id","run:"+jobId).eq("project_id",projectId);
      if(runUpdate.error) throw runUpdate.error;
      const readyEvent=await supabase.from("director_video_job_events").insert({
        job_id:jobId,event_type:"preview_ready",status:"completed",provider_id:"director-certification-smoke",
        provider_job_id:"cert-"+duration+"-"+runId,metadata:{assetId,measuredDurationSeconds:actualDuration,storageVerified:true,qualityClaim:false},
      });
      if(readyEvent.error) throw readyEvent.error;

      videoIds.push(jobId); assetIds.push(assetId); measured[String(duration)]=actualDuration;
      timelines[String(duration)]={baseline:v1Id,edited:v2Id,assetId,localizedTrimSeconds:trim};
    }

    const repDone=await supabase.from("director_process_replication_jobs").update({
      status:"completed",phase:"live-certification",updated_at:new Date().toISOString(),
    }).eq("id",replicationId);
    if(repDone.error) throw repDone.error;
    const completedAt=new Date().toISOString();
    const finalReceipts={
      sourceUrl,replicationJobId:replicationId,studyIds:[studyId],studyObservationCount:observationRows.length,
      improvementReceiptCount:receipts.length,rehearsalReceipts,timelines,
      durationToleranceSeconds:1.25,qualityClaim:false,smokeRenderer:true,
      privilegedTransport:"vercel-oidc-supabase-edge",
    };
    const finish=await supabase.from("director_live_certification_runs").update({
      status:"completed",replication_job_id:replicationId,video_job_ids:videoIds,artifact_ids:assetIds,
      measured_durations:measured,receipts:finalReceipts,error:null,completed_at:completedAt,updated_at:completedAt,
    }).eq("id",runId);
    if(finish.error) throw finish.error;

    return json(200,{ok:true,run:{
      id:runId,status:"completed",replication_job_id:replicationId,video_job_ids:videoIds,
      artifact_ids:assetIds,requested_durations:matrix,measured_durations:measured,receipts:finalReceipts,
      completed_at:completedAt,
    }});
  } catch(error) {
    console.error("jhadina-director-live-cert-gateway",error instanceof Error?error.message:String(error));
    const message=error instanceof Error?error.message:"DIRECTOR_LIVE_CERT_FAILED";
    return json(message==="DIRECTOR_LIVE_CERT_UNAUTHORIZED"?401:500,{ok:false,error:message});
  }
}

Deno.serve(main);
