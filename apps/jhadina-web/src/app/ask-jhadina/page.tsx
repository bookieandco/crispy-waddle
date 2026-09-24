"use client"

import Link from "next/link"
import { Suspense,useEffect,useRef,useState } from "react"
import { useSearchParams } from "next/navigation"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { JhadinaLiveInput, type JhadinaConversationSignals, type JhadinaEphemeralArtifact } from "./jhadina-live-input"
import { chunkSpeechText, isAbortLike, type JhadinaConversationLine, type JhadinaInteractivePhase } from "./interactive-runtime"

type EvidenceRef={id:string;source:string;observedAt:string;summary:string}
type DecisionProposal={id:string;disposition:"PROCEED"|"ASK"|"DECLINE"|"DEFER";recommendation:string;rationale:string;evidence:EvidenceRef[];uncertainty:string[];alternatives:string[]}
type MemoryCandidate={id:string;content:string;type:string;confidence:number;status:string}
type GovernedExpressionSegment={kind:"semantic"|"callback"|"cultural_reference";text:string}
type GovernedExpressionPresentation={mode:"direct"|"explanatory"|"pushback"|"clarifying"|"serious";allowProfanity:boolean;allowQuip:boolean;register?:string;cadenceStyle?:"tight"|"conversational"|"spacious";pauseDensity?:"low"|"moderate"|"high";metaphorDensity?:"none"|"light"|"moderate";bitDepth?:0|1|2|3;allowPlayfulDisagreement?:boolean;symbolicFraming?:"off"|"interpretive";storytellingDepth?:"none"|"brief"|"extended";edginess?:"none"|"light"|"moderate";reentryToPlayfulness?:"off"|"cautious"|"allowed";operationalSass?:"off"|"light"|"moderate";affectionateTeasing?:boolean;workloadBoundary?:"implicit"|"explicit";evidenceDiscipline?:"standard"|"heightened"|"strict";speakingRate?:"slow"|"normal"|"fast";deliberatePauses?:boolean;callback?:string;culturalReference?:string}
type GovernedExpression={proposal:DecisionProposal;presentation:GovernedExpressionPresentation;segments:GovernedExpressionSegment[]}
type SocialCharacter={id:string;brand:string;label:string;description:string;toneTraits:readonly string[];pointOfView:string;voiceProfileRef:string;authority:"EXPRESSION_ONLY"}
type SocialAccountChoice={accountId:string;brand:string;platform:string;provider:string;displayName:string;handle?:string;attentionScore:number;attentionReasons:readonly string[]}
type SocialWorkPlan={kind:"social_marketing";operation:string;character?:SocialCharacter;availableCharacters?:readonly SocialCharacter[];accounts:readonly SocialAccountChoice[];requestedPlatforms:readonly string[];nextBoundary:"social_read_only"|"growth_research"|"director_production"|"social_publication"|"growth_paid_media";authority:"READ_ONLY"|"PLANNING_ONLY";requiresExplicitApprovalForExecution:boolean;notes:readonly string[]}
type GrowthWorkPlan={kind:"growth_intelligence";operation:string;authority:"READ_ONLY";nextBoundary:"growth_read_only";campaigns:readonly EvidenceRef[];audiences:readonly EvidenceRef[];pendingWork:readonly EvidenceRef[];performance:readonly EvidenceRef[];attention:readonly EvidenceRef[];notes:readonly string[]}
type VideoJobSummary={id:string;projectId:string;status:string;mode?:string;aspectRatio?:string;providerId?:string;error?:string;previewAssetId?:string}
type CommandResult={proposal:DecisionProposal;reasoningEventId:string;expression:GovernedExpression;candidate?:MemoryCandidate;approvalReceiptId?:string;verified:boolean;verificationReason?:string;socialWorkPlan?:SocialWorkPlan;growthWorkPlan?:GrowthWorkPlan;videoJob?:VideoJobSummary;feedbackEligible?:boolean}

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
 const [artifacts,setArtifacts]=useState<JhadinaEphemeralArtifact[]>([])
 const [artifactRefs,setArtifactRefs]=useState<string[]>([])
 const [inputStatus,setInputStatus]=useState("")
 const [voiceLanguage,setVoiceLanguage]=useState("en-US")
 const [referenceFile,setReferenceFile]=useState<File|null>(null)
 const [referenceKind,setReferenceKind]=useState<"character"|"product">("character")
 const [characterName,setCharacterName]=useState("")
 const [productName,setProductName]=useState("")
 const [productLabelText,setProductLabelText]=useState("")
 const [characterArchetype,setCharacterArchetype]=useState<"human"|"cartoon"|"puppet"|"creature">("human")
 const [referenceRightsConfirmed,setReferenceRightsConfirmed]=useState(false)
 const [referenceStage,setReferenceStage]=useState("")
 const [workSessionId,setWorkSessionId]=useState(()=>params.get("session")??"")
 const [workSessionGoal,setWorkSessionGoal]=useState("")
 const [interactivePhase,setInteractivePhase]=useState<JhadinaInteractivePhase>("idle")
 const [conversationActive,setConversationActive]=useState(false)
 const [conversationLines,setConversationLines]=useState<JhadinaConversationLine[]>([])
 const nativeAudioRef=useRef<HTMLAudioElement|null>(null)
 const busyRef=useRef(false)
 const activeTurnRef=useRef("")
 const commandAbortRef=useRef<AbortController|null>(null)
 const speechAbortRef=useRef<AbortController|null>(null)

 useEffect(()=>{
  let cancelled=false
  void (async()=>{
   const userId=await getCurrentUserId()
   if(!userId||typeof window==="undefined")return
   const query=params.get("session")?.trim()
   const remembered=window.localStorage.getItem("jhadina:work-session")?.trim()
   const id=query||remembered||crypto.randomUUID()
   window.localStorage.setItem("jhadina:work-session",id)
   if(cancelled)return
   setWorkSessionId(id)
   const response=await fetch(`/api/jhadina/work-sessions/${encodeURIComponent(id)}`,{headers:{"x-jhadina-user-id":userId}})
   if(!response.ok)return
   const json=await response.json()
   const goal=typeof json?.session?.goal==="string"?json.session.goal:""
   if(cancelled)return
   setWorkSessionGoal(goal)
   if(goal)setTask(current=>current.trim()?current:goal)
  })().catch(()=>{})
  return()=>{cancelled=true}
 },[])

 async function persistWorkSession(userId:string,command:string,data:CommandResult){
  if(typeof window==="undefined")return
  const id=workSessionId||crypto.randomUUID()
  if(!workSessionId)setWorkSessionId(id)
  window.localStorage.setItem("jhadina:work-session",id)
  const activeSubsystems=[
   ...(data.socialWorkPlan?["social"]:[]),
   ...(data.growthWorkPlan?["growth"]:[]),
   ...(data.videoJob?["director"]:[]),
  ]
  const decisionRefs=[data.proposal?.id,data.reasoningEventId].filter((value):value is string=>typeof value==="string"&&Boolean(value))
  const outputRefs=data.videoJob?.id?[data.videoJob.id]:[]
  const durableRefs=artifactRefs.map(id=>({id,kind:"data" as const,provenanceRef:`artifact:${id}`,admitted:true}))
  const response=await fetch(`/api/jhadina/work-sessions/${encodeURIComponent(id)}`,{
   method:"PUT",
   headers:{"content-type":"application/json","x-jhadina-user-id":userId},
   body:JSON.stringify({goal:command,status:"active",activeSubsystems,artifactRefs:durableRefs,decisionRefs,outputRefs}),
  })
  if(!response.ok)return
  const json=await response.json()
  if(typeof json?.session?.goal==="string")setWorkSessionGoal(json.session.goal)
 }

 async function identity(){const userId=await getCurrentUserId();if(!userId)throw new Error("Not signed in");return userId}
 function stopSpeech(){
  nativeAudioRef.current?.pause()
  nativeAudioRef.current=null
  if(typeof window!=="undefined"&&"speechSynthesis" in window)window.speechSynthesis.cancel()
 }
 async function speakText(text:string,userId?:string){
  if(!text.trim())return
  stopSpeech()
  const uid=userId??await identity()
  try{
   const response=await fetch("/api/jhadina/voice/speak",{
    method:"POST",
    headers:{"content-type":"application/json","x-jhadina-user-id":uid},
    body:JSON.stringify({text,language:voiceLanguage,voiceProfileId:"jhadina:canonical"}),
   })
   if(!response.ok)throw new Error("native voice unavailable")
   const json=await response.json()
   if(typeof json.audioBase64!=="string"||!json.audioBase64)throw new Error("native voice returned no audio")
   const audio=new Audio(`data:${json.mimeType??"audio/wav"};base64,${json.audioBase64}`)
   nativeAudioRef.current=audio
   audio.onended=()=>{if(nativeAudioRef.current===audio)nativeAudioRef.current=null}
   await audio.play()
   return
  }catch{
   if(typeof window==="undefined"||!("speechSynthesis" in window))return
   const utterance=new SpeechSynthesisUtterance(text)
   utterance.lang=voiceLanguage
   window.speechSynthesis.speak(utterance)
  }
 }
 function isVideoRequest(text:string){return /\b(make|create|generate|produce|build|render|turn)\b/i.test(text)&&/\b(video|movie|film|short|reel|tiktok|youtube\s+short|youtube\s+video)\b/i.test(text)}
 function slugReference(value:string,prefix:"character"|"product"){const slug=value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60);return slug||`${prefix}-${crypto.randomUUID().slice(0,8)}`}
 async function jsonOrThrow(response:Response,fallback:string){const json=await response.json();if(!response.ok||json?.ok===false)throw new Error(json?.error||fallback);return json}
 async function videoJsonOrBlocked(response:Response,fallback:string){const json=await response.json();if(response.ok&&json?.ok!==false)return json;if(response.status===409&&json?.videoJob&&["blocked","failed"].includes(String(json.videoJob.status??"")))return json;throw new Error(json?.error||fallback)}
 async function ensureDirectorProject(){
  const queryProject=params.get("project")?.trim()
  if(queryProject)return queryProject
  const project=await jsonOrThrow(await fetch("/api/workstation/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({})}),"Unable to create Director project")
  const projectId=String(project.projectId??"").trim()
  if(!projectId)throw new Error("Director did not return a project ID")
  return projectId
 }
 async function governReferenceProposal(userId:string,command:string,proposal:DecisionProposal,shortcut:"reference-character"|"reference-product"){
  const json=await jsonOrThrow(await fetch("/api/jhadina/expression",{
   method:"POST",
   headers:{"content-type":"application/json","x-jhadina-user-id":userId},
   body:JSON.stringify({activeTask:command,proposal,shortcut}),
  }),"Jhadina could not realize the governed reference response")
  return {proposal:json.data.proposal as DecisionProposal,expression:json.data.expression as GovernedExpression,reasoningEventId:String(json.data.reasoningEventId)}
 }
 async function askWithReferenceCharacter(command:string,userId:string):Promise<CommandResult>{
  if(!referenceFile)throw new Error("Reference image is required")
  if(!referenceRightsConfirmed)throw new Error("Confirm that you own or have permission to use the reference image and likeness.")
  if(!isVideoRequest(command))throw new Error("A recurring character attachment currently requires a video, movie, film, short, reel, or YouTube video request.")
  const requestedName=characterName.trim()||referenceFile.name.replace(/\.[^.]+$/,"").replace(/[-_]+/g," ").trim()||"Reference Character"
  const characterId=slugReference(requestedName,"character")
  setReferenceStage("Creating Director project…")
  const projectId=await ensureDirectorProject()
  const attestation=`ask-jhadina:user-attested:${new Date().toISOString()}`
  setReferenceStage("Uploading private reference…")
  const form=new FormData()
  form.set("file",referenceFile);form.set("projectId",projectId);form.set("rightsRef",attestation);form.set("consentRef",attestation);form.set("viewHint","unknown")
  const uploaded=await jsonOrThrow(await fetch("/api/director/characters/references",{method:"POST",body:form}),"Unable to upload reference character")
  const assetId=String(uploaded.asset?.id??"")
  if(!assetId)throw new Error("Director did not return a reference asset ID")
  setReferenceStage("Scanning and admitting reference…")
  await jsonOrThrow(await fetch(`/api/director/characters/references/${encodeURIComponent(assetId)}/admit`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId})}),"Reference image could not be admitted")
  setReferenceStage("Locking recurring character identity…")
  await jsonOrThrow(await fetch("/api/director/characters/bootstrap",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId,characterId,displayName:requestedName,archetype:characterArchetype,referenceAssetIds:[assetId],buildMotionProbes:true,commercialUse:true})}),"Unable to create recurring character identity")
  setReferenceStage("Starting full video production…")
  const video=await videoJsonOrBlocked(await fetch("/api/director/videos/reference-character",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId,characterId,prompt:command,clientRequestId:crypto.randomUUID()})}),"Unable to start reference-character video")
  const job=video.videoJob as VideoJobSummary
  const now=new Date().toISOString()
  const blocked=job?.status==="blocked"||job?.status==="failed"
  const message=blocked?`Director locked ${requestedName} as the recurring character, but video generation is blocked: ${job.error??"a reference-aware provider must be configured"}.`:`Director locked ${requestedName} as the recurring character and started the full video. Job ${job?.id??"created"} is ${job?.status??"queued"}.`
  const proposal:DecisionProposal={id:`reference-video:${job?.id??crypto.randomUUID()}`,disposition:blocked?"DEFER":"PROCEED",recommendation:message,rationale:"The uploaded reference was privately quarantined, scanned, admitted, locked into Director's Cast Bible, and then bound to a reference-aware video production job.",evidence:[{id:`director-character:${characterId}`,source:"Director Cast Bible",observedAt:now,summary:`Project ${projectId}; character ${characterId}; admitted reference ${assetId}.`}],uncertainty:job?.error?[job.error]:[],alternatives:[]}
  const governed=await governReferenceProposal(userId,command,proposal,"reference-character")
  return {proposal:governed.proposal,reasoningEventId:governed.reasoningEventId,expression:governed.expression,verified:true,verificationReason:"Reference media admission and project authority completed before production submission; presentation was realized through the governed Personality/RNC path and the turn was persisted to Hippocampus.",videoJob:job,feedbackEligible:false}
 }
 async function askWithReferenceProduct(command:string,userId:string):Promise<CommandResult>{
  if(!referenceFile)throw new Error("Product reference image is required")
  if(!referenceRightsConfirmed)throw new Error("Confirm that you own or have permission to use the product reference image.")
  if(!isVideoRequest(command))throw new Error("A product reference attachment currently requires a video, movie, film, short, reel, or YouTube video request.")
  const requestedName=productName.trim()||referenceFile.name.replace(/\.[^.]+$/,"").replace(/[-_]+/g," ").trim()||"Reference Product"
  const productId=slugReference(requestedName,"product")
  setReferenceStage("Creating Director project…")
  const projectId=await ensureDirectorProject()
  const attestation=`ask-jhadina:product-rights-attested:${new Date().toISOString()}`
  setReferenceStage("Uploading private product reference…")
  const form=new FormData()
  form.set("file",referenceFile);form.set("projectId",projectId);form.set("rightsRef",attestation);form.set("viewHint","hero")
  const uploaded=await jsonOrThrow(await fetch("/api/director/products/references",{method:"POST",body:form}),"Unable to upload product reference")
  const assetId=String(uploaded.asset?.id??"")
  if(!assetId)throw new Error("Director did not return a product reference asset ID")
  setReferenceStage("Scanning and admitting product reference…")
  await jsonOrThrow(await fetch(`/api/director/products/references/${encodeURIComponent(assetId)}/admit`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId})}),"Product reference could not be admitted")
  const requiredLabelText=[...new Set(productLabelText.split(/[\n,]+/).map(value=>value.trim()).filter(Boolean))]
  setReferenceStage("Locking Product Bible…")
  const locked=await jsonOrThrow(await fetch("/api/director/products/bootstrap",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId,productId,displayName:requestedName,referenceAssetIds:[assetId],requiredLabelText})}),"Unable to create Product Bible")
  setReferenceStage("Starting product-consistent video production…")
  const video=await videoJsonOrBlocked(await fetch("/api/director/videos/reference-product",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId,productId,productBibleId:String(locked.productBibleId??""),prompt:command,clientRequestId:crypto.randomUUID()})}),"Unable to start product-reference video")
  const job=video.videoJob as VideoJobSummary
  const now=new Date().toISOString()
  const blocked=job?.status==="blocked"||job?.status==="failed"
  const message=blocked?`Director locked ${requestedName} into a Product Bible, but video generation is blocked: ${job.error??"a product-reference-aware provider must be configured"}.`:`Director locked ${requestedName} into a Product Bible and started the product-consistent video. Job ${job?.id??"created"} is ${job?.status??"queued"}.`
  const proposal:DecisionProposal={id:`product-video:${job?.id??crypto.randomUUID()}`,disposition:blocked?"DEFER":"PROCEED",recommendation:message,rationale:"The uploaded product reference was privately quarantined, scanned, admitted, locked into Director's Product Bible, and then bound to a product-aware video job. Generic providers that cannot preserve product identity are excluded.",evidence:[{id:`director-product:${productId}`,source:"Director Product Bible",observedAt:now,summary:`Project ${projectId}; product ${productId}; Product Bible ${String(locked.productBibleId??"created")}; admitted reference ${assetId}.`}],uncertainty:job?.error?[job.error]:[],alternatives:[]}
  const governed=await governReferenceProposal(userId,command,proposal,"reference-product")
  return {proposal:governed.proposal,reasoningEventId:governed.reasoningEventId,expression:governed.expression,verified:true,verificationReason:"Product reference admission and project authority completed before product-aware production submission; presentation was realized through the governed Personality/RNC path and the turn was persisted to Hippocampus.",videoJob:job,feedbackEligible:false}
 }
 async function ask(commandOverride?:string, conversationSignals?:JhadinaConversationSignals){
  const command=(commandOverride??task).trim()
  if(!command||busy)return
  setBusy(true);setError("");setResult(null);setFeedbackRecorded(null)
  try{
   const userId=await identity()
   let data:CommandResult
   if(referenceFile){
    data=referenceKind==="product"?await askWithReferenceProduct(command,userId):await askWithReferenceCharacter(command,userId)
   }else{
    const response=await fetch("/api/jhadina/command",{method:"POST",headers:{"content-type":"application/json","x-jhadina-user-id":userId},body:JSON.stringify({activeTask:command,surface,route,artifacts,artifactRefs,conversationSignals,activeProject:params.get("project")??undefined,clientRequestId:crypto.randomUUID()})})
    const json=await response.json();if(!response.ok)throw new Error(json.error||"Jhadina could not process that")
    data=json.data as CommandResult
   }
   await persistWorkSession(userId,command,data)
   setResult(data);setTask("")
   if(commandOverride){
    const spoken=(data.expression?.segments??[]).filter((segment:GovernedExpressionSegment)=>segment.kind==="semantic").map((segment:GovernedExpressionSegment)=>segment.text).join(" ")
    if(spoken)await speakText(spoken,userId)
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
   <JhadinaLiveInput busy={busy} onArtifactsChange={setArtifacts} onArtifactRefsChange={setArtifactRefs} onBargeIn={stopSpeech} onVoiceCommand={(command,signals)=>void ask(command,signals)} onLanguageChange={setVoiceLanguage} onStatus={setInputStatus}/>
   {inputStatus?<p className="jh-meta" role="status" style={{marginTop:8}}>{inputStatus}</p>:null}
   <div className="jh-item" style={{marginTop:14}}>
    <div className="jh-between">
     <div><strong>Optional identity reference</strong><p className="jh-card-copy">Attach one image as a recurring character or as a product whose packaging and labels must stay consistent through Director production.</p></div>
     {referenceFile?<button type="button" className="jh-button" disabled={busy} onClick={()=>{setReferenceFile(null);setCharacterName("");setProductName("");setProductLabelText("");setReferenceRightsConfirmed(false)}}>Remove</button>:null}
    </div>
    <div className="jh-row" style={{marginTop:10,alignItems:"center"}}>
     <select className="jh-input" value={referenceKind} disabled={busy} onChange={event=>setReferenceKind(event.target.value as "character"|"product")}><option value="character">Recurring character</option><option value="product">Product / packaging</option></select>
     <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0]??null;setReferenceFile(file);setReferenceRightsConfirmed(false);const name=file?.name.replace(/\.[^.]+$/,"").replace(/[-_]+/g," ")??"";if(file&&referenceKind==="character"&&!characterName)setCharacterName(name);if(file&&referenceKind==="product"&&!productName)setProductName(name)}}/>
     {referenceFile&&referenceKind==="character"?<><input className="jh-input" value={characterName} onChange={event=>setCharacterName(event.target.value)} placeholder="Character name" style={{minWidth:180}}/><select className="jh-input" value={characterArchetype} onChange={event=>setCharacterArchetype(event.target.value as typeof characterArchetype)}><option value="human">Human</option><option value="cartoon">Cartoon</option><option value="puppet">Puppet</option><option value="creature">Creature</option></select></>:null}
     {referenceFile&&referenceKind==="product"?<input className="jh-input" value={productName} onChange={event=>setProductName(event.target.value)} placeholder="Product name" style={{minWidth:180}}/>:null}
    </div>
    {referenceFile&&referenceKind==="product"?<textarea className="jh-textarea" rows={2} value={productLabelText} onChange={event=>setProductLabelText(event.target.value)} placeholder="Optional exact label text, one phrase per line — used as packaging text authority." style={{marginTop:10,width:"100%"}}/>:null}
    {referenceFile?<label className="jh-row" style={{marginTop:10,alignItems:"center"}}><input type="checkbox" checked={referenceRightsConfirmed} onChange={event=>setReferenceRightsConfirmed(event.target.checked)} disabled={busy}/><span className="jh-card-copy">{referenceKind==="character"?"I own or have permission to use this image and the depicted likeness/character for this production.":"I own or have permission to use this product image, packaging, and brand assets for this production."}</span></label>:null}
    {referenceStage?<p className="jh-meta" style={{marginTop:8}}>{referenceStage}</p>:null}
   </div>
   <p className="jh-meta">Context surface: {surface} · route: {route} · work session: {workSessionId?workSessionId.slice(0,12):"initializing"}{workSessionGoal?` · resumed goal: ${workSessionGoal.slice(0,80)}`:""} · ⌘/Ctrl + Enter to send · screen frames stay ephemeral · attached files use private quarantine and only clean files enter reasoning; identity-reference uploads persist only through the explicit governed Director flow above</p>
   <div className="jh-row" style={{marginTop:10}}>
    {[
     "Show me the social character personalities I can use",
     "Which social accounts should I work on right now?",
     "Use the PupsonStuff personality on Instagram and TikTok",
     "Research Meta ad concepts for PupsonStuff on Instagram",
     "Which paid campaigns need attention?",
     "What is awaiting paid ad approval?",
    ].map(example=><button key={example} type="button" className="jh-button" disabled={busy} onClick={()=>setTask(example)}>{example}</button>)}
   </div>
  </div>
  {error&&<div className="jh-error" role="alert">{error}</div>}
  {result?<section className="jh-section">
   <article className="jh-card jh-card--wide">
    <div className="jh-between"><div><span className={result.verified?"jh-status jh-status--success":"jh-status jh-status--danger"}><span className="jh-dot"/>{result.verified?"Verified response":"Verification failed"}</span><p className="jh-eyebrow" style={{marginTop:14}}>{result.proposal.disposition} · {result.expression.presentation.mode}</p></div><span className="jh-meta">Reasoning {result.reasoningEventId.slice(0,10)}…</span></div>
    <div className="jh-row" style={{marginTop:12}}><button type="button" className="jh-button" onClick={()=>{const text=result.expression.segments.filter(segment=>segment.kind==="semantic").map(segment=>segment.text).join(" ");void speakText(text)}}>Speak response</button><button type="button" className="jh-button" onClick={stopSpeech}>Stop speech</button></div>
    <div style={{marginTop:14}}>{result.expression.segments.map((segment,index)=><p key={segment.kind+index} className={segment.kind==="semantic"?"jh-card-copy":undefined} style={segment.kind==="semantic"?{fontSize:16,color:"var(--jh-text)"}:{color:"var(--jh-muted)",fontSize:13}}>{segment.text}</p>)}</div>
    <div className="jh-item" style={{marginTop:16}}><strong>Why</strong><p className="jh-card-copy">{result.proposal.rationale}</p></div>
    {result.socialWorkPlan?<SocialWorkPlanCard plan={result.socialWorkPlan}/>:null}
    {result.growthWorkPlan?<GrowthWorkPlanCard plan={result.growthWorkPlan}/>:null}
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


function GrowthWorkPlanCard({plan}:{plan:GrowthWorkPlan}){
 const section=plan.operation==="list_audiences"?plan.audiences:plan.operation==="pending_work"?plan.pendingWork:plan.operation==="performance"?plan.performance:plan.operation==="campaign_attention"?plan.attention:plan.campaigns
 return <div className="jh-section" style={{marginTop:20}}>
  <div className="jh-item">
   <div className="jh-between">
    <div><p className="jh-eyebrow">Growth intelligence</p><h2 className="jh-card-title">{plan.operation.replaceAll("_"," ")}</h2></div>
    <span className="jh-status jh-status--success"><span className="jh-dot"/>{plan.authority}</span>
   </div>
   <p className="jh-card-copy">Authenticated durable Growth state. Reading this card does not approve ads, change budgets, mutate audiences, or send lifecycle actions.</p>
   {section.length?<div className="jh-list" style={{marginTop:12}}>{section.slice(0,10).map(item=><div className="jh-item" key={item.id}>
    <strong>{item.source}</strong>
    <p className="jh-card-copy">{item.summary}</p>
    <p className="jh-meta">{new Date(item.observedAt).toLocaleString()} · {item.id}</p>
   </div>)}</div>:<div className="jh-empty" style={{marginTop:12}}>No durable records are available for this Growth view.</div>}
   <p className="jh-meta" style={{marginTop:12}}>Campaigns {plan.campaigns.length} · audiences {plan.audiences.length} · pending work {plan.pendingWork.length} · observations {plan.performance.length}</p>
   <div className="jh-row" style={{marginTop:12}}><Link className="jh-button" href="/growth">Open Growth</Link></div>
  </div>
 </div>
}
