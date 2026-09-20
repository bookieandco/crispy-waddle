import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PersonalCommandFeed } from '../components/home/PersonalCommandFeed';
import { feedSources, type FeedSource } from '../components/home/feedSources';
import { getCurrentUserId } from '../src/lib/auth/current-user';
import styles from '../components/home/HomepageComposition.module.css';

type ActivityEvent={id:string;type:string;status:'started'|'approval_required'|'completed'|'denied'|'failed';timestamp:string}
const labels={approval_required:'Needs approval',started:'In progress',completed:'Completed',denied:'Denied',failed:'Failed'} as const;

export default function Home() {
  const [source,setSource]=useState<FeedSource>('All');
  const [events,setEvents]=useState<ActivityEvent[]>([]);
  const [activityError,setActivityError]=useState('');
  const [activityLoading,setActivityLoading]=useState(true);

  useEffect(()=>{let cancelled=false;(async()=>{try{
    const userId=await getCurrentUserId(); if(!userId) throw new Error('Sign in to load governed activity');
    const res=await fetch('/api/system/activity',{headers:{'x-jhadina-user-id':userId}});
    const json=await res.json(); if(!res.ok) throw new Error(json.error||'Could not load activity');
    if(!cancelled)setEvents(json.data?.events??[]);
  }catch(e){if(!cancelled)setActivityError(e instanceof Error?e.message:'Could not load activity')}finally{if(!cancelled)setActivityLoading(false)}})();return()=>{cancelled=true}},[]);

  const state=useMemo(()=>{
    const sorted=[...events].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
    return {approvals:sorted.filter(e=>e.status==='approval_required'),active:sorted.filter(e=>e.status==='started'),exceptions:sorted.filter(e=>e.status==='failed'||e.status==='denied'),recent:sorted.slice(0,4)}
  },[events]);

  const recentText=state.recent[0]?labels[state.recent[0].status]+' · '+state.recent[0].type:'Recent governed work will appear here.';
  const exceptionText=activityError?activityError:activityLoading?'Checking governed activity…':state.exceptions.length?state.exceptions.length+' failed or denied governed event'+(state.exceptions.length===1?'':'s')+' in the current ledger.':'No failed or denied events in the current durable domains. This is not a whole-system health claim.';

  return <main className={styles.home}>
    <header className={styles.header}><div><div className={styles.brand}>Jhadina</div><div className={styles.subtitle}>Mission Control</div></div><Link href="/ask-jhadina" className={styles.command} aria-label="Ask Jhadina"><span aria-hidden="true">✦</span><span>Ask Jhadina…</span><span className={styles.commandKbd}>⌘ K</span></Link></header>
    <div className={styles.layout}><section className={styles.mission} aria-labelledby="mission-title">
      <div className={styles.intro}><div className={styles.eyebrow}>Mission Control</div><h1 id="mission-title" className={styles.title}>What needs your attention.</h1><p className={styles.description}>Live governed activity is summarized here. Jhadina does not infer system health from missing evidence.</p></div>
      <div className={styles.missionGrid}>
        <Link href="/approvals" className={styles.missionCard}><span className={styles.cardTitle}>Needs You</span><strong className={styles.metric}>{activityLoading?'—':state.approvals.length}</strong><span className={styles.cardDescription}>{activityLoading?'Loading governed activity…':state.approvals.length?'Governed actions are waiting for approval.':'No approval-required events in the current durable domains.'}</span><span className={styles.cardAction}>Review →</span></Link>
        <Link href="/activity" className={styles.missionCard}><span className={styles.cardTitle}>Active Work</span><strong className={styles.metric}>{activityLoading?'—':state.active.length}</strong><span className={styles.cardDescription}>{activityLoading?'Loading governed activity…':state.active.length?'Governed actions are currently started.':'No started events in the current durable domains.'}</span><span className={styles.cardAction}>Open activity →</span></Link>
        <Link href="/activity" className={styles.missionCard}><span className={styles.cardTitle}>Continue</span><strong className={styles.metric}>{activityLoading?'—':state.recent.length}</strong><span className={styles.cardDescription}>{recentText}</span><span className={styles.cardAction}>Resume →</span></Link>
        <Link href="/opportunity" className={styles.missionCard}><span className={styles.cardTitle}>Opportunities</span><strong className={styles.metric}>—</strong><span className={styles.cardDescription}>No canonical cross-Opportunity summary API is wired to Mission Control yet.</span><span className={styles.cardAction}>Explore →</span></Link>
      </div>
      <section className={styles.exceptions} aria-labelledby="exceptions-title"><div><div className={styles.sectionLabel}>System evidence</div><h2 id="exceptions-title">Exceptions</h2></div><p>{exceptionText}</p><Link href="/activity">View evidence</Link></section>
      <section className={styles.intelligence} aria-labelledby="intelligence-title"><div className={styles.sectionHeading}><div><div className={styles.sectionLabel}>Recent Intelligence</div><h2 id="intelligence-title">Your signal stream</h2></div><Link href="/ask-jhadina">Ask about this</Link></div><div className={styles.filters} aria-label="Feed sources">{feedSources.map(value=><button key={value} type="button" aria-pressed={source===value} className={styles.filter+' '+(source===value?styles.filterActive:'')} onClick={()=>setSource(value)}>{value}</button>)}</div><p className={styles.filterDescription}>{source==='All'?'Signals from your connected media and information sources.':'Showing '+source+' signals.'}</p><PersonalCommandFeed source={source}/></section>
    </section></div>
  </main>
}
