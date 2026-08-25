import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUserId } from '../../src/lib/auth/current-user';
import styles from './PersonalCommandFeed.module.css';

type FeedItem = { kind: 'music' | 'opportunity' | 'director' | 'social' | 'youtube' | 'jhadina' | 'growth'; label: string; title: string; body: string; action?: string; href?: string; age?: string; details?: Array<[string, string]> };
const leadingCard: FeedItem = { kind: 'jhadina', label: 'Jhadina', title: 'Your day, at a glance.', body: 'A mixed stream for music, opportunities, media, social, and Jhadina activity.', age: 'Now', details: [['Stream', 'Unified'], ['Sources', 'Connected'], ['Posting', 'Paused']] };
const restOfFeed: FeedItem[] = [
  { kind: 'music', label: 'Music', title: 'Your Music is ready.', body: 'Pick up where you left off or search for something new.', action: 'Open Music', age: 'Recent', href: '/music' },
  { kind: 'opportunity', label: 'Opportunity', title: 'A business opportunity needs your attention.', body: 'Opportunity intelligence will surface leads, ideas, and time-sensitive opportunities here.', action: 'Review', age: 'Recent', href: '/opportunity' },
  { kind: 'director', label: 'Director', title: 'A new video is ready for review.', body: 'Creative output from your Director workspace can appear here before anything is published.', action: 'Watch', age: 'Recent' },
  { kind: 'youtube', label: 'YouTube', title: 'Recommended video space.', body: 'Connected YouTube content can appear here once the account is authorized.', action: 'Connect', age: 'Not connected' },
  { kind: 'social', label: 'Social', title: 'Your social world, mixed into the stream.', body: 'Facebook, Instagram, and TikTok cards will be pulled through authorized integrations — never scraped.', action: 'Connect', age: 'Connections' },
];
const glyph: Record<FeedItem['kind'], string> = { music: '♪', opportunity: '$', director: '▶', social: '◎', youtube: 'Y', jhadina: '✦', growth: '📈' };
type GrowthDraft = { id: string; brand: string; kind: string; title?: string; body: string; status: string };
function useGrowthProposal(): FeedItem | null {
  const [item, setItem] = useState<FeedItem | null>(null);
  useEffect(() => { let cancelled = false; async function load() { try { const userId = await getCurrentUserId(); if (!userId) return; const res = await fetch('/api/growth/drafts', { headers: { 'x-jhadina-user-id': userId } }); if (!res.ok) return; const json = await res.json(); const drafts: GrowthDraft[] = json.data?.drafts ?? []; const pending = drafts.filter((d) => d.status === 'PENDING_APPROVAL'); if (cancelled || pending.length === 0) return; const first = pending[0]; setItem({ kind: 'growth', label: 'Growth', title: first.title || 'A draft is ready for your review.', body: pending.length > 1 ? `${pending.length} drafts are waiting on your approval. Nothing publishes without you.` : first.body, action: 'Review', href: '/growth', age: 'Needs attention', details: [['Status', 'Pending approval'], ['Drafts', String(pending.length)], ['Publishing', 'Human gated']] }); } catch { /* Home preview stays quiet. */ } } void load(); return () => { cancelled = true; }; }, []);
  return item;
}
function StoryCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  return <article className={styles.card}><div className={styles.cardHeader}><div className={styles.glyph} aria-hidden="true">{glyph[item.kind]}</div><div className={styles.source}>{item.label}</div><div className={styles.meta}>{item.age}</div></div><h3 className={styles.cardTitle}>{item.title}</h3><p className={styles.body}>{item.body}</p>{(item.action || item.details) && <div className={styles.actions}>{item.action && (item.href ? <Link href={item.href} className={styles.action}>{item.action}</Link> : <button type="button" className={styles.action}>{item.action}</button>)}{item.details && <button type="button" className={styles.secondary} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? 'Hide details' : 'Details'}</button>}</div>}{expanded && item.details && <div className={styles.detail}><div className={styles.detailGrid}>{item.details.map(([label, value]) => <div className={styles.detailItem} key={label}><span className={styles.detailLabel}>{label}</span><span className={styles.detailValue}>{value}</span></div>)}</div></div>}</article>;
}
export function PersonalCommandFeed() {
  const growthItem = useGrowthProposal();
  const feed: FeedItem[] = growthItem ? [leadingCard, growthItem, ...restOfFeed] : [leadingCard, ...restOfFeed];
  return <section className={styles.feed}><div className={styles.intro}><div className={styles.eyebrow}>Jhadina Home</div><h2 className={styles.title}>Your world, in one stream.</h2><p className={styles.description}>Social, music, opportunities, media, and Jhadina — mixed by context instead of trapped in separate apps.</p></div><div className={styles.list}>{feed.map((item) => <StoryCard key={`${item.kind}-${item.title}`} item={item} />)}</div></section>;
}
