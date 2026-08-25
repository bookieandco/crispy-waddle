import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getCurrentUserId } from '../../src/lib/auth/current-user';
import { rankFeedItems, type FeedItem, type FeedKind, type FeedPlatform } from '../../src/lib/personal-feed/core';
import { deriveSocialIntelligence } from '../../src/lib/personal-feed/social-intelligence';
import { deriveCrossPlatformSignals } from '../../src/lib/personal-feed/cross-platform';
import type { FeedFeedbackAction } from '../../src/lib/personal-feed/feedback';

type GrowthDraft = { id: string; title?: string; body: string; status: string };
type SocialPost = { id: string; text: string; platforms?: FeedPlatform[]; status: string; scheduledAt?: string };
type Opportunity = { id: string; title: string; sourceName: string; summary: string; fitScore: number; status: 'new' | 'approved'; requiresUserApproval: boolean; createdAt: string };

const glyph: Record<FeedKind | FeedPlatform, string> = { work: '$', social: '◎', opportunity: '↗', media: '▶', jhadina: '✦', facebook: 'f', instagram: '◎', tiktok: '♪', youtube: 'Y' };
const platformLabel: Record<FeedPlatform, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

function useUnifiedFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        const headers = { 'x-jhadina-user-id': userId };
        const [growthRes, socialRes, opportunitiesRes, musicRes] = await Promise.all([
          fetch('/api/growth/drafts', { headers }), fetch('/api/social/posts', { headers }), fetch('/api/opportunities', { headers }), fetch('/api/music/feed', { headers }),
        ]);
        const next: FeedItem[] = [];
        if (growthRes.ok) {
          const json = await growthRes.json();
          const drafts: GrowthDraft[] = json.data?.drafts ?? [];
          for (const draft of drafts.filter((d) => d.status === 'PENDING_APPROVAL')) next.push({ id: `growth-${draft.id}`, kind: 'work', label: 'Work', title: draft.title || 'Something is ready for your review.', body: draft.body, status: draft.status, action: 'Review', href: '/growth', relevance: 100 });
        }
        if (socialRes.ok) {
          const json = await socialRes.json();
          const posts: SocialPost[] = json.data ?? [];
          next.push(...deriveCrossPlatformSignals(posts));
          next.push(...deriveSocialIntelligence(posts));
          for (const post of posts) {
            const platform = post.platforms?.[0];
            next.push({ id: `social-${post.id}`, kind: 'social', label: platform ? platformLabel[platform] : 'Social', title: platform ? `${platformLabel[platform]} activity` : 'Social activity', body: post.text || 'A connected social update is available.', platform, status: post.status, timestamp: post.scheduledAt, relevance: platform === 'tiktok' ? 5 : 0 });
          }
        }
        if (opportunitiesRes.ok) {
          const json = await opportunitiesRes.json();
          const opportunities: Opportunity[] = json.data?.opportunities ?? [];
          for (const opportunity of opportunities) next.push({ id: `opportunity-${opportunity.id}`, kind: 'opportunity', label: opportunity.sourceName || 'Opportunity', title: opportunity.title, body: opportunity.summary, status: opportunity.status, action: opportunity.status === 'new' && opportunity.requiresUserApproval ? 'Review opportunity' : undefined, href: '/opportunities', timestamp: opportunity.createdAt, relevance: opportunity.fitScore });
        }
        if (musicRes.ok) {
          const json = await musicRes.json();
          next.push(...(json.data ?? []));
        }
        if (!cancelled) setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);
  return items;
}

function relevanceReason(item: FeedItem): string | null {
  const body = `${item.title} ${item.body}`.toLowerCase();
  const matches = ['jhadina', 'jhadinatv', 'jhadina music', 'overageos', 'bookie & co.'].filter((term) => body.includes(term));
  if (matches.length) return `Matches ${matches.join(' + ')}`;
  if (item.kind === 'opportunity') return 'Matches an active opportunity signal';
  if (item.kind === 'work') return 'Needs your attention';
  if (item.kind === 'jhadina') return 'Jhadina surfaced this as a useful signal';
  return null;
}

async function sendFeedback(userId: string, item: FeedItem, action: FeedFeedbackAction) {
  const response = await fetch('/api/feed/feedback', { method: 'POST', headers: { 'content-type': 'application/json', 'x-jhadina-user-id': userId }, body: JSON.stringify({ itemId: item.id, action, kind: item.kind, platform: item.platform, topic: item.title }) });
  if (!response.ok) throw new Error('Feedback failed');
}

export function PersonalCommandFeed() {
  const [filter, setFilter] = useState<'all' | FeedKind | FeedPlatform>('all');
  const [feedback, setFeedback] = useState<Record<string, FeedFeedbackAction | undefined>>({});
  const items = useUnifiedFeed();
  const feed = useMemo(() => rankFeedItems(filter === 'all' ? items : items.filter((item) => item.kind === filter || item.platform === filter)), [filter, items]);
  const filters: Array<{ id: typeof filter; label: string }> = [
    { id: 'all', label: 'All' }, { id: 'work', label: 'Work' }, { id: 'opportunity', label: 'Opportunities' }, { id: 'media', label: 'Music' }, { id: 'jhadina', label: 'Insights' },
    { id: 'tiktok', label: 'TikTok' }, { id: 'instagram', label: 'Instagram' }, { id: 'facebook', label: 'Facebook' }, { id: 'youtube', label: 'YouTube' },
  ];
  return <section style={{ maxWidth: 820, margin: '0 auto', padding: '48px 20px 96px' }}>
    <div style={{ marginBottom: 20 }}><div style={{ fontSize: 11, letterSpacing: '.28em', textTransform: 'uppercase', opacity: .42 }}>Jhadina Home</div><h2 style={{ fontSize: 38, lineHeight: 1.05, margin: '10px 0 8px' }}>Everything relevant. One scroll.</h2><p style={{ margin: 0, opacity: .52 }}>TikTok, Instagram, Facebook, YouTube, music, your work, opportunities, and Jhadina insights — ranked by what deserves your attention first.</p></div>
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 18 }}>{filters.map((option) => <button key={option.id} type="button" onClick={() => setFilter(option.id)} style={{ flex: '0 0 auto', border: '1px solid rgba(255,255,255,.1)', borderRadius: 999, padding: '8px 13px', background: filter === option.id ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.035)', color: 'inherit', cursor: 'pointer' }}>{option.label}</button>)}</div>
    <div style={{ display: 'grid', gap: 14 }}>{feed.map((item) => { const reason = relevanceReason(item); const selected = feedback[item.id]; return <article key={item.id} style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.035)', boxShadow: '0 14px 50px rgba(0,0,0,.18)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', fontSize: 18 }}>{item.platform ? glyph[item.platform] : glyph[item.kind]}</div><div><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.2em', opacity: .45 }}>{item.label}</div>{item.status && <div style={{ fontSize: 11, opacity: .35, marginTop: 3 }}>{item.status.replaceAll('_', ' ')}</div>}</div></div><h3 style={{ margin: '18px 0 8px', fontSize: 21 }}>{item.title}</h3><p style={{ margin: 0, lineHeight: 1.6, opacity: .62, whiteSpace: 'pre-wrap' }}>{item.body}</p>{reason && <div style={{ marginTop: 14, fontSize: 12, opacity: .46 }}>Why you’re seeing this · {reason}</div>}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>{(['more_like_this','less_like_this','not_relevant','watch_topic'] as FeedFeedbackAction[]).map((action) => <button key={action} type="button" aria-pressed={selected === action} onClick={async () => { const userId = await getCurrentUserId(); if (!userId) return; try { await sendFeedback(userId, item, action); setFeedback((current) => ({ ...current, [item.id]: action })); } catch { /* keep UI stable if persistence is unavailable */ } }} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '7px 10px', background: selected === action ? 'rgba(255,255,255,.12)' : 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12 }}>{action === 'more_like_this' ? 'More like this' : action === 'less_like_this' ? 'Less like this' : action === 'not_relevant' ? 'Not relevant' : 'Watch topic'}</button>)}</div>{item.action && item.href && <Link href={item.href} style={{ marginTop: 18, display: 'inline-block', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,.06)', color: 'inherit', textDecoration: 'none' }}>{item.action}</Link>}</article>; })}{items.length === 0 && <div style={{ padding: 24, borderRadius: 20, border: '1px dashed rgba(255,255,255,.12)', opacity: .5 }}>Connect your social accounts and Jhadina will start mixing their activity with your work, music, and opportunities here.</div>}</div>
  </section>;
}
