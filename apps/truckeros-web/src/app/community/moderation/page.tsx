"use client";

import Link from "next/link";
import {useCallback,useEffect,useState} from "react";

type Report={reportId:string;postId:string;reason:string;createdAt:string;body:string;
  audience:"network"|"friends";reportedHandle:string;authorHandle:string};
type ReviewChoice="hide"|"retain"|"restore";
export default function ModerationPreviewPage(){
  const [reports,setReports]=useState<Report[]>([]);
  const [state,setState]=useState<"loading"|"ready"|"denied"|"unavailable">("loading");
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const reload=useCallback(async()=>{
    const result=await fetch("/api/community/moderation",{credentials:"same-origin",cache:"no-store"});
    if(!result.ok){setState(result.status===503?"unavailable":"denied");return;}
    const json=await result.json() as {success:boolean;data?:{reports:Report[]}};
    if(!json.success||!json.data){setState("unavailable");return;}
    setReports(json.data.reports);setState("ready");
  },[]);
  useEffect(()=>{void reload().catch(()=>setState("unavailable"))},[reload]);
  async function decide(report:Report,action:ReviewChoice){
    const note=(notes[report.postId]??"").trim();
    if(note.length<8){setMessage("Please enter a reason of at least eight characters.");return;}
    if(action==="hide"&&!window.confirm("Hide this post from every driver's feed? The author and reporter will not see it until it is restored."))return;
    setBusy(report.postId);setMessage("");
    try{
      const res=await fetch("/api/community/moderation",{method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({postId:report.postId,action,reason:note})});
      const json=await res.json() as {success:boolean;error?:string};
      if(!res.ok||!json.success)throw Error(json.error??"Unable to review report");
      setMessage("Review saved; evidence is retained.");
      await reload();
    }catch(e){setMessage(e instanceof Error?e.message:"Request failed")}
    finally{setBusy(null)}
  }
  return <main className="page stack trucker-community">
    <header className="page-header">
      <div><Link href="/community" className="back-link">← Community</Link><h1 className="h1">Moderation queue</h1></div>
      <span className="community-preview">RESTRICTED PREVIEW</span>
    </header>
    <p className="subtle">Only offline-approved moderators can see reported content, including friend-only posts. Review each report with a documented explanation before taking action.</p>
    {message&&<p role="status" className="community-notice">{message}</p>}
    {state==="loading"&&<div className="card">Checking moderator access…</div>}
    {state==="unavailable"&&<div className="card">The moderation preview is not available on this host.</div>}
    {state==="denied"&&<div className="card stack"><h2>Moderator access required</h2><p className="subtle">A normal driver login is not a moderator role. Privileges must be granted offline by the operator.</p><Link href="/community" className="btn">Return to community</Link></div>}
    {state==="ready"&&<>
      <div className="subtle">{reports.length} unresolved reports (maximum 50 at a time)</div>
      {reports.length===0&&<div className="card">No unresolved reports in the queue.</div>}
      {reports.map(r=><article className="card stack" key={r.reportId}>
        <div className="row-between"><b>Reported: {r.reason.replace(/_/g," ")}</b><span className="subtle">{new Date(r.createdAt).toLocaleDateString()}</span></div>
        <div className="subtle">From @{r.reportedHandle} · Author @{r.authorHandle} · {r.audience==="friends"?"Friends only":"Driver network"}</div>
        <div className="community-comment">{r.body}</div>
        <label>Reason for decision
          <textarea rows={2} maxLength={500} value={notes[r.postId]??""} onChange={e=>setNotes(n=>({...n,[r.postId]:e.target.value}))} placeholder="Required: brief factual reason, at least 8 characters"/>
        </label>
        <div className="btn-row">
          <button className="btn" disabled={busy!==null} onClick={()=>void decide(r,"retain")}>Retain</button>
          <button className="btn" disabled={busy!==null} onClick={()=>void decide(r,"restore")}>Restore</button>
          <button className="btn btn-primary" disabled={busy!==null} onClick={()=>void decide(r,"hide")}>Hide</button>
        </div>
      </article>)}
    </>}
  </main>;
}
