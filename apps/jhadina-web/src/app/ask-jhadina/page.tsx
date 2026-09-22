"use client"

import Link from "next/link"
import { Suspense,useState } from "react"
import { useSearchParams } from "next/navigation"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { JhadinaLiveInput, type JhadinaConversationSignals, type JhadinaEphemeralArtifact } from "./jhadina-live-input"

type EvidenceRef={id:string;source:string;observedAt:string;summary:string}
type DecisionProposal={id:string;disposition:"PROCEED"|"ASK"|"DECLINE"|"DEFER";recommendation:string;rationale:string;evidence:EvidenceRef[];uncertainty:string[];alternatives:string[]}
type MemoryCandidate={id:string;content:string;type:string;confidence:number;status:string}
type GovernedExpressionSegment={kind:"semantic"|"callback"|"cultural_reference";text:string}
type GovernedExpression={proposal:DecisionProposal;presentation:{mode:"direct"|"explanatory"|"pushback"|"clarifying"|"serious";allowProfanity:boolean;allowQuip:boolean;callback?:string;culturalReference?:string};segments:GovernedExpressionSegment[]}
type SocialCharacter={id:string;brand:string;label:string;description:string;toneTraits:readonly string[];pointOfView:string;voiceProfileRef:string;authority:"EXPRESSION_ONLY"}
type SocialAccountChoice={accountId:string;brand:string;platform:string;provider:string;displayName:string;handle?:string;attentionScore:number;attentionReasons:readonly string[]}
type SocialWorkPlan={kind:"social_marketing";operation:string;character?:SocialCharacter;availableCharacters?:readonly SocialCharacter[];accounts:readonly SocialAccountChoice[];requestedPlatforms:readonly string[];nextBoundary:"social_read_only"|"growth_research"|"director_production"|"social_publication"|"growth_paid_media";authority:"READ_ONLY"|"PLANNING_ONLY";requiresExplicitApprovalForExecution:boolean;notes:readonly string[]}
type GrowthWorkPlan={kind:"growth_intelligence";operation:string;authority:"READ_ONLY";nextBoundary:"growth_read_only";campaigns:readonly EvidenceRef[];audiences:readonly EvidenceRef[];pendingWork:readonly EvidenceRef[];performance:readonly EvidenceRef[];attention:readonly EvidenceRef[];notes:readonly string[]}
type CommandResult={proposal:DecisionProposal;reasoningEventId:string;expression:GovernedExpression;candidate?:MemoryCandidate;approvalReceiptId?:string;verified:boolean;verificationReason?:string;socialWorkPlan?:SocialWorkPlan;growthWorkPlan?:GrowthWorkPlan;feedbackEligible?:boolean}

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
 const [inputStatus,setInputStatus]=useState("")
 const [voiceLanguage,setVoiceLanguage]=useState("en-US")

 async function identity(){const userId=await getCurrentUserId();if(!userId)throw new Error("Not signed in");return userId}
 async function ask(commandOverride?:string, conversationSignals?:JhadinaConversationSignals){
  const command=(commandOverride??task).trim()
  if(!command||busy)return
  setBusy(true);setError("");setResult(null);setFeedbackRecorded(null)
  try{
   const userId=await identity()
   const response=await fetch("/api/jhadina/command",{method:"POST",headers:{"content-type":"application/json","x-jhadina-user-id":userId},body:JSON.stringify({activeTask:command,surface,route,artifacts,conversationSignals})})
   const json=await response.json();if(!response.ok)throw new Error(json.error||"Jhadina could not process that")
   setResult(json.data);setTask("")
   if(commandOverride && typeof window!=="undefined" && "speechSynthesis" in window){
    const spoken=(json.data?.expression?.segments??[]).filter((segment:GovernedExpressionSegment)=>segment.kind==="semantic").map((segment:GovernedExpressionSegment)=>segment.text).join(" ")
    if(spoken){const utterance=new SpeechSynthesisUtterance(spoken);utterance.lang=voiceLanguage;window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance)}
   }
  }catch(cause){setError(cause instanceof Error?cause.message:"Jhadina could not process that")}
  finally{setBusy(false)}
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
   <JhadinaLiveInput busy={busy} onArtifactsChange={setArtifacts} onVoiceCommand={(command,signals)=>void ask(command,signals)} onLanguageChange={setVoiceLanguage} onStatus={setInputStatus}/>
   {inputStatus?<p className="jh-meta" role="status" style={{marginTop:8}}>{inputStatus}</p>:null}
   <p className="jh-meta">Context surface: {surface} · route: {route} · ⌘/Ctrl + Enter to send · screen/files are ephemeral unless a governed flow explicitly proposes persistence</p>
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
    <div className="jh-row" style={{marginTop:12}}><button type="button" className="jh-button" onClick={()=>{if(typeof window==="undefined"||!("speechSynthesis" in window))return;const text=result.expression.segments.filter(segment=>segment.kind==="semantic").map(segment=>segment.text).join(" ");const utterance=new SpeechSynthesisUtterance(text);utterance.lang=voiceLanguage;window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance)}}>Speak response</button></div>
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
