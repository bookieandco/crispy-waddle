"use client"

import Link from "next/link"
import { Suspense,useState } from "react"
import { useSearchParams } from "next/navigation"
import { getCurrentUserId } from "@/lib/auth/current-user"

type EvidenceRef={id:string;source:string;observedAt:string;summary:string}
type DecisionProposal={id:string;disposition:"PROCEED"|"ASK"|"DECLINE"|"DEFER";recommendation:string;rationale:string;evidence:EvidenceRef[];uncertainty:string[];alternatives:string[]}
type MemoryCandidate={id:string;content:string;type:string;confidence:number;status:string}
type GovernedExpressionSegment={kind:"semantic"|"callback"|"cultural_reference";text:string}
type GovernedExpression={proposal:DecisionProposal;presentation:{mode:"direct"|"explanatory"|"pushback"|"clarifying"|"serious";allowProfanity:boolean;allowQuip:boolean;callback?:string;culturalReference?:string};segments:GovernedExpressionSegment[]}
type SocialCharacter={id:string;brand:string;label:string;description:string;toneTraits:readonly string[];pointOfView:string;voiceProfileRef:string;authority:"EXPRESSION_ONLY"}
type SocialAccountChoice={accountId:string;brand:string;platform:string;provider:string;displayName:string;handle?:string;attentionScore:number;attentionReasons:readonly string[]}
type SocialWorkPlan={kind:"social_marketing";operation:string;character?:SocialCharacter;availableCharacters?:readonly SocialCharacter[];accounts:readonly SocialAccountChoice[];requestedPlatforms:readonly string[];nextBoundary:"social_read_only"|"growth_research"|"director_production"|"social_publication"|"growth_paid_media";authority:"READ_ONLY"|"PLANNING_ONLY";requiresExplicitApprovalForExecution:boolean;notes:readonly string[]}
type VideoJobSummary={id:string;projectId:string;status:string;mode?:string;aspectRatio?:string;providerId?:string;error?:string;previewAssetId?:string}
type CommandResult={proposal:DecisionProposal;reasoningEventId:string;expression:GovernedExpression;candidate?:MemoryCandidate;approvalReceiptId?:string;verified:boolean;verificationReason?:string;socialWorkPlan?:SocialWorkPlan;videoJob?:VideoJobSummary;feedbackEligible?:boolean}

export default function AskJhadinaPage(){return <Suspense fallback={<main className="jh-page"><div className="jh-wrap"><div className="jh-skeleton"/></div></main>}><AskJhadina/></Suspense>}

function AskJhadina(){
 const params=useSearchParams()
 const surface=params.get("surface")??"assistant"
 const route=params.get("route")??"/ask-jhadina"
 const [task,setTask]=useState(()=>params.get("prompt")??"")
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const [result,setResult]=useState<CommandResult|null>(null)
 const [feedbackBusy,setFeedbackBusy]=useState(false)
 const [feedbackRecorded,setFeedbackRecorded]=useState<"reinforced"|"rejected"|null>(null)
 const [referenceFile,setReferenceFile]=useState<File|null>(null)
 const [characterName,setCharacterName]=useState("")
 const [characterArchetype,setCharacterArchetype]=useState<"human"|"cartoon"|"puppet"|"creature">("human")
 const [referenceRightsConfirmed,setReferenceRightsConfirmed]=useState(false)
 const [referenceStage,setReferenceStage]=useState("")

 async function identity(){const userId=await getCurrentUserId();if(!userId)throw new Error("Not signed in");return userId}

 function isVideoRequest(text:string){return /\b(make|create|generate|produce|build|render|turn)\b/i.test(text)&&/\b(video|movie|film|short|reel|tiktok|youtube\s+short|youtube\s+video)\b/i.test(text)}
 function slugCharacter(value:string){const slug=value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60);return slug||`character-${crypto.randomUUID().slice(0,8)}`}
 async function jsonOrThrow(response:Response,fallback:string){const json=await response.json();if(!response.ok||json?.ok===false)throw new Error(json?.error||fallback);return json}

 async function askWithReferenceCharacter(userId:string){
  if(!referenceFile)throw new Error("Reference image is required")
  if(!referenceRightsConfirmed)throw new Error("Confirm that you own or have permission to use the reference image and likeness.")
  if(!isVideoRequest(task))throw new Error("A reference character attachment currently requires a video, movie, film, short, reel, or YouTube video request.")

  const requestedName=characterName.trim()||referenceFile.name.replace(/\.[^.]+$/,"").replace(/[-_]+/g," ").trim()||"Reference Character"
  const characterId=slugCharacter(requestedName)
  const queryProject=params.get("project")?.trim()

  setReferenceStage("Creating Director project…")
  let projectId=queryProject
  if(!projectId){
   const project=await jsonOrThrow(await fetch("/api/workstation/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({})}),"Unable to create Director project")
   projectId=String(project.projectId)
  }

  const attestation=`ask-jhadina:user-attested:${new Date().toISOString()}`
  setReferenceStage("Uploading private reference…")
  const form=new FormData()
  form.set("file",referenceFile)
  form.set("projectId",projectId)
  form.set("rightsRef",attestation)
  form.set("consentRef",attestation)
  form.set("viewHint","unknown")
  const uploaded=await jsonOrThrow(await fetch("/api/director/characters/references",{method:"POST",body:form}),"Unable to upload reference character")
  const assetId=String(uploaded.asset?.id??"")
  if(!assetId)throw new Error("Director did not return a reference asset ID")

  setReferenceStage("Scanning and admitting reference…")
  await jsonOrThrow(await fetch(`/api/director/characters/references/${encodeURIComponent(assetId)}/admit`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId})}),"Reference image could not be admitted")

  setReferenceStage("Locking recurring character identity…")
  await jsonOrThrow(await fetch("/api/director/characters/bootstrap",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
   projectId,characterId,displayName:requestedName,archetype:characterArchetype,referenceAssetIds:[assetId],buildMotionProbes:true,commercialUse:true,
  })}),"Unable to create recurring character identity")

  setReferenceStage("Starting full video production…")
  const video=await jsonOrThrow(await fetch("/api/director/videos/reference-character",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
   projectId,characterId,prompt:task.trim(),clientRequestId:crypto.randomUUID(),
  })}),"Unable to start reference-character video")
  const job=video.videoJob as VideoJobSummary
  const now=new Date().toISOString()
  const message=job?.status==="blocked"
   ? `Director locked ${requestedName} as the recurring character, but video generation is blocked: ${job.error??"a reference-aware provider must be configured"}.`
   : `Director locked ${requestedName} as the recurring character and started the full video. Job ${job?.id??"created"} is ${job?.status??"queued"}.`
  const proposal:DecisionProposal={
   id:`reference-video:${job?.id??crypto.randomUUID()}`,
   disposition:job?.status==="blocked"?"DEFER":"PROCEED",
   recommendation:message,
   rationale:"The uploaded reference was privately quarantined, scanned, admitted, locked into Director's Cast Bible, and then bound to a reference-aware video production job.",
   evidence:[{id:`director-character:${characterId}`,source:"Director Cast Bible",observedAt:now,summary:`Project ${projectId}; character ${characterId}; admitted reference ${assetId}.`}],
   uncertainty:job?.error?[job.error]:[],
   alternatives:[],
  }
  setResult({
   proposal,
   reasoningEventId:`reference-video:${job?.id??characterId}`,
   expression:{proposal,presentation:{mode:"direct",allowProfanity:false,allowQuip:false},segments:[{kind:"semantic",text:message}]},
   verified:true,
   verificationReason:"Reference media admission and project authority completed before production submission.",
   videoJob:job,
   feedbackEligible:false,
  })
  setTask("")
  setReferenceStage("")
 }

 async function ask(){
  if(!task.trim()||busy)return
  setBusy(true);setError("");setResult(null);setFeedbackRecorded(null)
  try{
   const userId=await identity()
   if(referenceFile){
    await askWithReferenceCharacter(userId)
   }else{
    const response=await fetch("/api/jhadina/command",{method:"POST",headers:{"content-type":"application/json","x-jhadina-user-id":userId},body:JSON.stringify({activeTask:task.trim(),surface,route,activeProject:params.get("project")??undefined,clientRequestId:crypto.randomUUID()})})
    const json=await response.json();if(!response.ok)throw new Error(json.error||"Jhadina could not process that")
    setResult(json.data);setTask("")
   }
  }catch(cause){setError(cause instanceof Error?cause.message:"Jhadina could not process that")}
  finally{setBusy(false);setReferenceStage("")}
 }
 async function feedback(kind:"reinforced"|"rejected"){
  if(!result?.reasoningEventId||feedbackBusy||feedbackRecorded)return
  setFeedbackBusy(true);setError("")
  try{
   const userId=await identity()
   const response=await fetch("/api/jhadina/personality/feedback",{method:"POST",headers:{"content-type":"application/json","x-jhadina-user-id":userId},body:JSON.stringify({targetReasoningEventId:result.reasoningEventId,feedbackId:crypto.randomUUID(),kind})})
   const json=await response.json();if(!response.ok)throw new Error(json.error||"Could not record feedback");setFeedbackRecorded(kind)
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not record feedback")}
  finally{setFeedbackBusy(false)}
 }

 return <main className="jh-page"><div className="jh-wrap" style={{maxWidth:900}}>
  <p className="jh-eyebrow">Ask Jhadina · {surface}</p>
  <h1 className="jh-title">Think across the whole OS.</h1>
  <p className="jh-copy">Ask is Jhadina’s governed LLM surface. It can reason across approved context and subsystem intelligence, explain its evidence, and propose next steps. The model itself does not mutate policy, memory, values, money, or external systems.</p>
  <div className="jh-card jh-card--wide" style={{marginTop:28}}>
   <label htmlFor="jhadina-command" className="jh-eyebrow">What are we doing?</label>
   <div className="jh-row" style={{alignItems:"stretch"}}>
    <textarea id="jhadina-command" className="jh-textarea" rows={3} value={task} onChange={event=>setTask(event.target.value)} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")void ask()}} placeholder="Ask a question, connect subsystems, inspect a decision, or tell Jhadina what you want to accomplish…" style={{flex:"1 1 560px",resize:"vertical"}}/>
    <button className="jh-button jh-button--primary" disabled={busy||!task.trim()} onClick={()=>void ask()}>{busy?"Reasoning…":"Ask"}</button>
   </div>
   <div className="jh-item" style={{marginTop:14}}>
    <div className="jh-between"><div><strong>Optional recurring character reference</strong><p className="jh-card-copy">Attach one image and Jhadina can lock the character identity before generating the video.</p></div>{referenceFile?<button type="button" className="jh-button" disabled={busy} onClick={()=>{setReferenceFile(null);setCharacterName("");setReferenceRightsConfirmed(false)}}>Remove</button>:null}</div>
    <div className="jh-row" style={{marginTop:10,alignItems:"center"}}>
     <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0]??null;setReferenceFile(file);if(file&&!characterName)setCharacterName(file.name.replace(/\.[^.]+$/,"").replace(/[-_]+/g," "))}}/>
     {referenceFile?<><input className="jh-input" value={characterName} onChange={event=>setCharacterName(event.target.value)} placeholder="Character name" style={{minWidth:180}}/><select className="jh-input" value={characterArchetype} onChange={event=>setCharacterArchetype(event.target.value as typeof characterArchetype)}><option value="human">Human</option><option value="cartoon">Cartoon</option><option value="puppet">Puppet</option><option value="creature">Creature</option></select></>:null}
    </div>
    {referenceFile?<label className="jh-row" style={{marginTop:10,alignItems:"center"}}><input type="checkbox" checked={referenceRightsConfirmed} onChange={event=>setReferenceRightsConfirmed(event.target.checked)} disabled={busy}/><span className="jh-card-copy">I own or have permission to use this image and the depicted likeness/character for this production.</span></label>:null}
    {referenceStage?<p className="jh-meta" style={{marginTop:8}}>{referenceStage}</p>:null}
   </div>
   <p className="jh-meta">Context surface: {surface} · route: {route} · ⌘/Ctrl + Enter to send</p>
   <div className="jh-row" style={{marginTop:10}}>
    {[
     "Show me the social character personalities I can use",
     "Which social accounts should I work on right now?",
     "Use the PupsonStuff personality on Instagram and TikTok",
     "Research Meta ad concepts for PupsonStuff on Instagram",
    ].map(example=><button key={example} type="button" className="jh-button" disabled={busy} onClick={()=>setTask(example)}>{example}</button>)}
   </div>
  </div>
  {error&&<div className="jh-error" role="alert">{error}</div>}
  {result?<section className="jh-section">
   <article className="jh-card jh-card--wide">
    <div className="jh-between"><div><span className={result.verified?"jh-status jh-status--success":"jh-status jh-status--danger"}><span className="jh-dot"/>{result.verified?"Verified response":"Verification failed"}</span><p className="jh-eyebrow" style={{marginTop:14}}>{result.proposal.disposition} · {result.expression.presentation.mode}</p></div><span className="jh-meta">Reasoning {result.reasoningEventId.slice(0,10)}…</span></div>
    <div style={{marginTop:14}}>{result.expression.segments.map((segment,index)=><p key={segment.kind+index} className={segment.kind==="semantic"?"jh-card-copy":undefined} style={segment.kind==="semantic"?{fontSize:16,color:"var(--jh-text)"}:{color:"var(--jh-muted)",fontSize:13}}>{segment.text}</p>)}</div>
    <div className="jh-item" style={{marginTop:16}}><strong>Why</strong><p className="jh-card-copy">{result.proposal.rationale}</p></div>
    {result.socialWorkPlan?<SocialWorkPlanCard plan={result.socialWorkPlan}/>:null}
    {result.videoJob?<div className="jh-item" style={{marginTop:16}}><strong>Director video job</strong><p className="jh-card-copy">{result.videoJob.id} · {result.videoJob.status}{result.videoJob.providerId?` · ${result.videoJob.providerId}`:""}</p><p className="jh-meta">Project {result.videoJob.projectId}{result.videoJob.previewAssetId?` · preview ${result.videoJob.previewAssetId}`:""}</p></div>:null}
    {result.proposal.evidence.length?<div className="jh-section" style={{marginTop:20}}><h2 className="jh-card-title">Evidence used</h2><div className="jh-list">{result.proposal.evidence.map(evidence=><div className="jh-item" key={evidence.id}><strong>{evidence.source}</strong><p className="jh-card-copy">{evidence.summary}</p><p className="jh-meta">{new Date(evidence.observedAt).toLocaleString()} · {evidence.id}</p></div>)}</div></div>:null}
    {result.proposal.uncertainty.length?<div style={{marginTop:18}}><strong>Uncertainty</strong><ul>{result.proposal.uncertainty.map(item=><li key={item} className="jh-card-copy">{item}</li>)}</ul></div>:null}
    {result.proposal.alternatives.length?<div style={{marginTop:18}}><strong>Alternatives</strong><ul>{result.proposal.alternatives.map(item=><li key={item} className="jh-card-copy">{item}</li>)}</ul></div>:null}
    {result.approvalReceiptId?<p className="jh-meta">Approval receipt: {result.approvalReceiptId}. This receipt belongs to the exact governed request; it is not general permission.</p>:null}
    {!result.verified?<div className="jh-error" role="alert">Verification did not pass: {result.verificationReason??"no verification reason returned"}</div>:null}
    {result.candidate?<div className="jh-empty">Jhadina proposed a memory candidate. It is not durable memory until you decide in <Link href="/approvals">Approval Center</Link>.</div>:null}
    {!result.candidate&&!result.approvalReceiptId?<p className="jh-meta">No persistence or external action is implied by this response.</p>:null}
    {result.feedbackEligible!==false?<div className="jh-row" style={{marginTop:18}}>
     {feedbackRecorded?<span className="jh-status jh-status--success"><span className="jh-dot"/>Feedback recorded</span>:<>
      <span className="jh-meta">Did this reasoning help?</span>
      <button className="jh-button" disabled={feedbackBusy} onClick={()=>void feedback("reinforced")}>Worked</button>
      <button className="jh-button" disabled={feedbackBusy} onClick={()=>void feedback("rejected")}>Not quite</button>
     </>}
    </div>:null}
   </article>
  </section>:null}
  <section className="jh-section"><div className="jh-grid">
   <Link className="jh-card jh-card--third" href="/approvals"><h2 className="jh-card-title">Approvals</h2><p className="jh-card-copy">Decisions waiting on you.</p></Link>
   <Link className="jh-card jh-card--third" href="/activity"><h2 className="jh-card-title">Black box</h2><p className="jh-card-copy">Inspect what actually happened.</p></Link>
   <Link className="jh-card jh-card--third" href="/worlds"><h2 className="jh-card-title">Worlds</h2><p className="jh-card-copy">Open or query any subsystem.</p></Link>
  </div></section>
 </div></main>
}


function SocialWorkPlanCard({plan}:{plan:SocialWorkPlan}){
 const boundaryHref:Record<SocialWorkPlan["nextBoundary"],string>={
  social_read_only:"/social",
  growth_research:"/growth",
  director_production:"/workstation",
  social_publication:"/social",
  growth_paid_media:"/growth",
 }
 return <div className="jh-section" style={{marginTop:20}}>
  <div className="jh-item">
   <div className="jh-between">
    <div><p className="jh-eyebrow">Social work plan</p><h2 className="jh-card-title">{plan.operation.replaceAll("_"," ")}</h2></div>
    <span className={plan.requiresExplicitApprovalForExecution?"jh-status jh-status--warning":"jh-status jh-status--success"}><span className="jh-dot"/>{plan.authority}</span>
   </div>
   {plan.character?<div style={{marginTop:12}}>
    <strong>{plan.character.label} character</strong>
    <p className="jh-card-copy">{plan.character.description}</p>
    <p className="jh-meta">Brand {plan.character.brand} · voice {plan.character.voiceProfileRef} · {plan.character.toneTraits.join(" · ")} · {plan.character.authority}</p>
   </div>:null}
   {plan.availableCharacters?.length?<div style={{marginTop:12}}>
    <strong>Available characters</strong>
    <div className="jh-row" style={{marginTop:8}}>{plan.availableCharacters.map(profile=><span key={profile.id} className="jh-status"><span className="jh-dot"/>{profile.label}</span>)}</div>
   </div>:null}
   {plan.accounts.length?<div style={{marginTop:14}}>
    <strong>Accounts in scope</strong>
    <div className="jh-list" style={{marginTop:8}}>{plan.accounts.map(account=><div className="jh-item" key={account.accountId}>
     <div className="jh-between"><span>{account.displayName} · {account.platform}</span><span className="jh-meta">attention {account.attentionScore}</span></div>
     <p className="jh-meta">{account.brand} · {account.provider}{account.handle?` · @${account.handle.replace(/^@/,"")}`:""} · {account.accountId}</p>
     <p className="jh-card-copy">{account.attentionReasons.join(" · ")}</p>
    </div>)}</div>
   </div>:null}
   <p className="jh-meta" style={{marginTop:12}}>Next boundary: {plan.nextBoundary.replaceAll("_"," ")}{plan.requiresExplicitApprovalForExecution?" · explicit approval still required":""}</p>
   <div className="jh-row" style={{marginTop:12}}><Link className="jh-button" href={boundaryHref[plan.nextBoundary]}>Open {plan.nextBoundary==="director_production"?"Director":plan.nextBoundary.startsWith("growth_")?"Growth":"Social"}</Link></div>
  </div>
 </div>
}
