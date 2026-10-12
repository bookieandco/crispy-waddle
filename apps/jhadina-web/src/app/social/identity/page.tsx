"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import type {IdentityStudioAccount, IdentityStudioSnapshot} from "@/lib/social/identity-studio";
import styles from "./identity-studio.module.css";

type StudioResponse = {success:boolean;data?:IdentityStudioSnapshot;error?:string};

function formatDate(value:string):string {
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown time" : parsed.toLocaleString(undefined,{
    month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",
  });
}
function statusText(account:IdentityStudioAccount):string {
  switch(account.identityStatus){
    case "not_configured": return "Durable identity not connected";
    case "not_found": return "No stored account identity";
    case "invalid_snapshot": return "Identity evidence unavailable";
    case "unverified_snapshot": return "Stored version — approval unverified";
  }
}
function metricLabel(key:string):string {
  return key.replace(/_/g," ").replace(/\b\w/g,char=>char.toUpperCase());
}

export default function SocialIdentityStudioPage() {
  const [view,setView]=useState<IdentityStudioSnapshot|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState("");

  const refresh=useCallback(async (signal?:AbortSignal)=>{
    setBusy(true);
    setError("");
    try {
      const response=await fetch("/api/social/identity-studio",{cache:"no-store",signal});
      const json:StudioResponse=await response.json();
      if(!response.ok || !json.success || !json.data)
        throw new Error(json.error || "Identity Studio could not load.");
      setView(json.data);
      setSelectedId(current=>
        current && json.data!.accounts.some(a=>a.id===current)
          ? current : (json.data!.accounts[0]?.id??null));
    } catch(caught){
      if(signal?.aborted)return;
      setView(null);
      setError(caught instanceof Error?caught.message:"Identity Studio could not load.");
    } finally {
      if(!signal?.aborted)setBusy(false);
    }
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void refresh(controller.signal);
    return ()=>controller.abort();
  },[refresh]);

  const accounts=view?.accounts??[];
  const selected=useMemo(()=>accounts.find(account=>account.id===selectedId)??null,
    [accounts,selectedId]);
  const brandCount=new Set(accounts.map(account=>account.brand)).size;
  const observationCount=accounts.reduce((sum,account)=>sum+account.observedPerformanceCount,0);

  return <main className={styles.shell}>
    <div className={styles.container}>
      <nav className={styles.nav} aria-label="Social navigation">
        <a href="/social" className={styles.back}>← Social command center</a>
        <span className={styles.navTag}>JHADINA / SOCIAL</span>
      </nav>

      <header className={styles.hero}>
        <p className={styles.eyebrow}>ACCOUNT IDENTITY / OWNER VIEW</p>
        <h1>Identity Studio<span className={styles.dot}>.</span></h1>
        <p>See what makes each account recognizable, which observations actually belong to it, and what still needs verification before Jhadina can learn from them.</p>
        <div className={styles.heroActions}>
          <span className={styles.readOnly}>READ ONLY · NO AUTOMATIC PUBLISHING</span>
          <button type="button" onClick={()=>void refresh()} disabled={busy} className={styles.refresh}>
            {busy?"Loading…":"↻ Refresh"}
          </button>
        </div>
      </header>

      {error&&<div role="alert" className={styles.error}>
        <strong>Identity Studio unavailable.</strong>
        <p>{error}</p>
        <p>Account data is not replaced with samples or assumed to be empty.</p>
      </div>}

      {busy&&!view&&<p className={styles.loading} role="status">Loading verified Social accounts…</p>}

      {view&&<>
        <section className={styles.metrics} aria-label="Connected account overview">
          <div><strong>{accounts.length}</strong><span>Connected accounts</span></div>
          <div><strong>{brandCount}</strong><span>Owned brands</span></div>
          <div><strong>{observationCount}</strong><span>Scoped performance receipts</span></div>
        </section>

        {accounts.length===0?<section className={styles.empty}>
          <h2>No connected accounts yet.</h2>
          <p>Connect an authorized account in the Social command center. Identity Studio does not create demo accounts or invent analytics.</p>
          <a href="/social" className={styles.link}>Open Social accounts →</a>
        </section>:<div className={styles.columns}>
          <section aria-labelledby="identity-list-title" className={styles.sidebar}>
            <div className={styles.sectionTop}>
              <div>
                <p className={styles.eyebrow}>YOUR PRESENCES</p>
                <h2 id="identity-list-title">Select an account</h2>
              </div>
            </div>
            <div className={styles.accountList} role="group" aria-label="Choose account identity">
              {accounts.map(account=><button
                type="button"
                key={account.id}
                aria-pressed={selected?.id===account.id}
                className={selected?.id===account.id?styles.accountSelected:styles.accountButton}
                onClick={()=>setSelectedId(account.id)}>
                <span className={styles.accountName}>{account.displayName}</span>
                <span className={styles.accountMeta}>{account.character?.label??account.brand} · {account.platform}</span>
                <span className={styles.accountCount}>{account.observedPerformanceCount} scoped observations</span>
              </button>)}
            </div>
          </section>

          {selected&&<section className={styles.details} aria-labelledby="identity-title">
            <div className={styles.identityHeading}>
              <div>
                <p className={styles.eyebrow}>EXPRESSION IDENTITY</p>
                <h2 id="identity-title">{selected.character?.label??selected.displayName}</h2>
                <p className={styles.subtitle}>{selected.displayName} · {selected.platform} · {selected.provider}</p>
              </div>
              <span className={styles.status}>Expression only</span>
            </div>
            <div className={styles.identityCard}>
              {selected.character?<><p className={styles.cardCaption}>GOVERNED BRAND CHARACTER</p>
                <p className={styles.pov}>“{selected.character.pointOfView}”</p>
                <div className={styles.chips} aria-label="Approved registry tone traits">
                  {selected.character.toneTraits.map(t=><span key={t} className={styles.chip}>{t}</span>)}
                </div>
                <dl className={styles.detailRows}>
                  <div><dt>Voice profile</dt><dd>{selected.character.voiceProfileRef}</dd></div>
                  <div><dt>Profile source</dt><dd>Governed Social character registry</dd></div>
                  <div><dt>Authority</dt><dd>Expression, not publishing or Jhadina PersonalityState</dd></div>
                </dl>
              </>:<p>No governed active character is registered for this brand. Nothing was inferred or created.</p>}
            </div>

            <div className={styles.identityCard}>
              <div className={styles.cardTitleRow}>
                <h3>Account identity status</h3>
                <span className={styles.statusMuted}>{selected.identityVersion? `v${selected.identityVersion}`:"No version"}</span>
              </div>
              <p>{statusText(selected)}</p>
              <p className={styles.muted}>Performance and tone suggestions cannot update identity until authenticated evidence, consent and owner-approval receipts are verified.</p>
              <p className={styles.statusFoot}>Review and rollback controls are unavailable until the durable approval lifecycle is commissioned.</p>
            </div>

            <section className={styles.identityCard} aria-labelledby="growth-title">
              <div className={styles.cardTitleRow}>
                <h3 id="growth-title">Observed Growth signals</h3>
                <span className={styles.statusMuted}>Read only</span>
              </div>
              <p className={styles.muted}>
                {selected.growthReadout.observedPerformanceRecords} owner-scoped performance record(s).
                Totals may overlap across provider snapshots. Missing metrics are not treated as zero.
              </p>
              {Object.keys(selected.growthReadout.observedMetricTotals).length===0?
                <p className={styles.muted}>No reliable numeric metrics have been observed.</p>:
                <div className={styles.chips}>
                  {Object.entries(selected.growthReadout.observedMetricTotals).slice(0,8)
                    .map(([metric,value])=><span key={metric} className={styles.metricChip}>
                      {metricLabel(metric)}: {value.toLocaleString()}
                    </span>)}
                </div>}
              <p className={styles.statusFoot}>These are descriptive observations, not a verified algorithm, an approved brand-identity change, or permission to publish.</p>
            </section>

            <section className={styles.identityCard} aria-labelledby="activity-title">
              <div className={styles.cardTitleRow}>
                <h3 id="activity-title">Evidence timeline</h3>
                <span className={styles.statusMuted}>{selected.observedPerformanceCount} scoped receipts</span>
              </div>
              {selected.evidence.length===0?<p className={styles.muted}>No account-scoped performance evidence is available. This is not proof of zero engagement or growth.</p>:
                <div className={styles.timeline}>
                  {selected.evidence.map(e=><article className={styles.observation} key={e.id}>
                    <div className={styles.observationTop}>
                      <strong>{e.contentId??"Unlinked content"}</strong>
                      <time dateTime={e.observedAt}>{formatDate(e.observedAt)}</time>
                    </div>
                    <p className={styles.observationSource}>{e.source} · observational evidence only</p>
                    <div className={styles.chips}>
                      {Object.entries(e.metrics).slice(0,8).map(([name,value])=>
                        <span className={styles.metricChip} key={name}>{metricLabel(name)}: {value.toLocaleString()}</span>)}
                    </div>
                    <details className={styles.evidenceDetails}>
                      <summary>Source evidence ({e.evidenceRefs.length})</summary>
                      <ul>{e.evidenceRefs.map(ref=><li key={ref}>{ref}</li>)}</ul>
                    </details>
                  </article>)}
                </div>}
              {selected.observedPerformanceCount>selected.evidence.length&&
                <p className={styles.muted}>Showing the most recent {selected.evidence.length} of {selected.observedPerformanceCount} verified-scope observations.</p>}
            </section>
          </section>}
        </div>}

        <section className={styles.footnote} aria-labelledby="limitations-title">
          <p className={styles.eyebrow}>TRUTHFUL LEARNING</p>
          <h2 id="limitations-title">What is not certified</h2>
          <ul>{view.limitations.map(item=><li key={item}>{item}</li>)}</ul>
          <p>Account metrics can inform future experiments; they do not rewrite the public persona, authorize posts, or change Jhadina’s own personality.</p>
          <small>Read-only snapshot assembled {formatDate(view.generatedAt)}.</small>
        </section>
      </>}
    </div>
  </main>;
}
