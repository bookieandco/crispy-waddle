"use client";

import {useCallback,useEffect,useState} from "react";
import type {SocialOperationsSnapshot} from "@/lib/social/social-operations-dashboard";
import styles from "./operations.module.css";

type OperationsResponse={success:boolean;data?:SocialOperationsSnapshot;error?:string};
const findings:Record<string,string>={
  NOT_STAGED:"Not staged",
  STAGED_INERT:"Staged · no dispatch",
  STALE_LOCAL_ATTEMPT:"Stale local attempt",
  FAILED_ATTEMPT:"Failed local attempt",
  UNVERIFIED_PROVIDER_OUTCOME:"Provider outcome unverified",
  CORRUPT_RECORD:"Corrupt or changed record",
  DUPLICATE_ATTEMPT:"Duplicate attempt",
  FUTURE_ATTEMPT:"Future-dated attempt",
  UNRECOGNIZED_ATTEMPT:"Unknown attempt state",
};
function displayCount(value:number|null):string{
  return value===null?"Unknown":value.toLocaleString();
}
function formatTime(value:string):string{
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleString():"Unknown";
}
export default function SocialOperationsPage(){
  const [snapshot,setSnapshot]=useState<SocialOperationsSnapshot|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState("");
  const refresh=useCallback(async (signal?:AbortSignal)=>{
    setBusy(true);setError("");
    try{
      const res=await fetch("/api/social/operations",{cache:"no-store",signal});
      const response:OperationsResponse=await res.json();
      if(!res.ok || !response.success || !response.data)
        throw new Error(response.error||"Operations source unavailable.");
      setSnapshot(response.data);
    }catch(e){
      if(signal?.aborted)return;
      setSnapshot(null);
      setError(e instanceof Error?e.message:"Unable to retrieve operations status.");
    }finally{if(!signal?.aborted)setBusy(false);}
  },[]);
  useEffect(()=>{
    const ctrl=new AbortController();
    void refresh(ctrl.signal);
    return ()=>ctrl.abort();
  },[refresh]);
  return <main className={styles.shell}>
    <div className={styles.container}>
      <nav className={styles.nav} aria-label="Social navigation">
        <a href="/social" className={styles.back}>← Social command center</a>
        <a href="/social/identity" className={styles.back}>Identity Studio →</a>
      </nav>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>JHADINA / OWNER OPERATIONS</p>
        <h1>Social Ops<span className={styles.accent}>.</span></h1>
        <p>Owner-only operational visibility. Approval and outbox evidence is never permission to post, comment, run production, or spend.</p>
        <div className={styles.actions}>
          <span className={styles.readOnly}>READ ONLY · NO DISPATCH OR RETRY</span>
          <button type="button" className={styles.refresh}
            onClick={()=>void refresh()} disabled={busy}>{busy?"Checking…":"↻ Refresh"}</button>
        </div>
      </header>
      {error&&<section className={styles.warning} role="alert">
        <strong>Operations evidence unavailable.</strong>
        <p>{error}</p>
        <p>No cached or simulated approvals, deliveries, or queue totals are being substituted.</p>
      </section>}
      {busy&&!snapshot&&<p className={styles.notice} role="status">Checking authenticated operations readiness…</p>}
      {snapshot&&<>
        <section className={styles.notice} aria-label="Production readiness">
          <div className={styles.noticeTop}>
            <strong>{snapshot.readiness==="READ_ONLY_EVIDENCE"?"Read-only evidence available":
              snapshot.readiness==="NOT_COMMISSIONED"?"Live queue not commissioned":"Source unavailable"}</strong>
            <span className={styles.small}>Checked {formatTime(snapshot.generatedAt)}</span>
          </div>
          <p>{snapshot.readiness==="READ_ONLY_EVIDENCE"
            ?"These are scoped internal observations, not verified provider delivery."
            :"Approvals, quarantine totals, and recovery outcomes are unknown until the authenticated durable source is verified."}</p>
        </section>
        <section className={styles.metricGrid} aria-label="Weekly operations overview">
          <div className={styles.metric}><strong>{displayCount(snapshot.pendingApprovals)}</strong><span>Pending reviewed approvals</span></div>
          <div className={styles.metric}><strong>{displayCount(snapshot.quarantinedActions)}</strong><span>Quarantined actions</span></div>
          <div className={styles.metric}><strong>{displayCount(snapshot.humanReviewActions)}</strong><span>Needs human review</span></div>
          <div className={styles.metric}><strong>{displayCount(snapshot.unverifiedDeliveryClaims)}</strong><span>Unverified delivery claims</span></div>
        </section>
        <section className={styles.panel} aria-labelledby="queue-title">
          <div className={styles.sectionHeading}>
            <h2 id="queue-title">Weekly child actions</h2>
            <span className={styles.label}>Observation only</span>
          </div>
          {snapshot.actions===null?
            <p className={styles.explainer}>No certified weekly child-action feed is connected. This does <strong>not</strong> mean the queue is empty, approvals are complete, or actions have been delivered.</p>
            :snapshot.actions.length===0?
            <p className={styles.explainer}>The verified owner-scoped audit returned no child actions for the reviewed packet.</p>
            :<ul className={styles.queue}>
              {snapshot.actions.map(a=><li key={a.actionId} className={styles.queueItem}>
                <div className={styles.queueTop}>
                  <strong>{a.actionKind.replaceAll("_"," ")}</strong>
                  <span className={a.disposition==="QUARANTINED"?styles.quarantine:
                    a.disposition==="HUMAN_REVIEW_REQUIRED"?styles.review:styles.inert}>
                    {a.disposition==="QUARANTINED"?"Quarantined":
                      a.disposition==="HUMAN_REVIEW_REQUIRED"?"Human review":"Inert"}
                  </span>
                </div>
                <p className={styles.actionId}>{a.actionId}</p>
                <p className={styles.explainer}>{a.findings.map(f=>findings[f]??"Unrecognized audit finding").join(" · ")}</p>
                <p className={styles.small}>Provider delivery unverified · No automatic retry</p>
              </li>)}
            </ul>}
        </section>
        <section className={styles.panel} aria-labelledby="blockers-title">
          <h2 id="blockers-title">Certification blockers</h2>
          <ul className={styles.blockers}>
            {snapshot.blockers.map(b=><li key={b}>{b}</li>)}
          </ul>
          <p className={styles.explainer}>Source-code CI does not certify database persistence, restore, delivery receipts or live account permissions.</p>
          <div className={styles.linkRow}>
            <a href="https://github.com/bookieandco/crispy-waddle/issues/1211">Database audit #1211 ↗</a>
            <a href="https://github.com/bookieandco/crispy-waddle/issues/1222">Outbox audit #1222 ↗</a>
          </div>
        </section>
      </>}
      <footer className={styles.footer}>Jhadina Social · Owner visibility only · No approval, publication, spending, or retry controls on this page.</footer>
    </div>
  </main>;
}
