import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUserId } from '../../src/lib/auth/current-user';

type FeedItem = { kind: 'music' | 'opportunity' | 'director' | 'social' | 'youtube' | 'jhadina' | 'growth'; label: string; title: string; body: string; action?: string; href?: string };

const leadingCard: FeedItem = { kind: 'jhadina', label: 'Jhadina', title: 'Your day, at a glance.', body: 'A mixed stream for music, opportunities, media, social, and Jhadina activity.' };

const restOfFeed: FeedItem[] = [
  { kind: 'music', label: 'Music', title: 'Your Music is ready.', body: 'Pick up where you left off or search for something new.', action: 'Open Music' },
  { kind: 'opportunity', label: 'Opportunity', title: 'A business opportunity needs your attention.', body: 'Opportunity intelligence will surface leads, ideas, and time-sensitive opportunities here.', action: 'Review' },
  { kind: 'director', label: 'Director', title: 'A new video is ready for review.', body: 'Creative output from your Director workspace can appear here before anything is published.', action: 'Watch' },
  { kind: 'youtube', label: 'YouTube', title: 'Recommended video space.', body: 'Connected YouTube content can appear here once the account is authorized.', action: 'Connect' },
  { kind: 'social', label: 'Social', title: 'Your social world, mixed into the stream.', body: 'Facebook, Instagram, and TikTok cards will be pulled through authorized integrations — never scraped.', action: 'Connect' },
];

const glyph: Record<FeedItem['kind'], string> = { music: '♪', opportunity: '$', director: '▶', social: '◎', youtube: 'Y', jhadina: '✦', growth: '📈' };

type GrowthDraft = { id: string; brand: string; kind: string; title?: string; body: string; status: string };

/**
 * Jhadina OS Integration Phase 2: PersonalCommandFeed's one real card.
 *
 * Every other card here is still demo content (JH-014's original scope
 * — no backend exists for those kinds yet). This is the first card
 * sourced from real state: it fetches the signed-in user's actual
 * pending Growth drafts through the same /api/growth/drafts route
 * /growth already uses, and shows one when there's something real
 * waiting. Tapping "Review" goes to /growth — the existing Approval
 * Center — where the explicit approve/deny actually happens against
 * the governed spine. This component never talks to the ledger,
 * ActionExecutor, or any governance package directly; it only ever
 * calls the same public API route the /growth page calls.
 */
function useGrowthProposal(): FeedItem | null {
  const [item, setItem] = useState<FeedItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        const res = await fetch('/api/growth/drafts', { headers: { 'x-jhadina-user-id': userId } });
        if (!res.ok) return;
        const json = await res.json();
        const drafts: GrowthDraft[] = json.data?.drafts ?? [];
        const pending = drafts.filter((d) => d.status === 'PENDING_APPROVAL');
        if (cancelled || pending.length === 0) return;
        const first = pending[0];
        setItem({
          kind: 'growth',
          label: 'Growth',
          title: first.title || 'A draft is ready for your review.',
          body: pending.length > 1
            ? `${pending.length} drafts are waiting on your approval. Nothing publishes without you.`
            : first.body,
          action: 'Review',
          href: '/growth',
        });
      } catch {
        // Fails silently on the home preview — errors that matter surface on /growth itself.
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return item;
}

export function PersonalCommandFeed() {
  const growthItem = useGrowthProposal();
  const feed: FeedItem[] = growthItem ? [leadingCard, growthItem, ...restOfFeed] : [leadingCard, ...restOfFeed];

  return <section style={{ maxWidth: 820, margin: '0 auto', padding: '48px 20px 96px' }}>
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, letterSpacing: '.28em', textTransform: 'uppercase', opacity: .42 }}>Jhadina Home</div>
      <h2 style={{ fontSize: 38, lineHeight: 1.05, margin: '10px 0 8px' }}>Your world, in one stream.</h2>
      <p style={{ margin: 0, opacity: .52 }}>Social, music, opportunities, media, and Jhadina — mixed by context instead of trapped in separate apps.</p>
    </div>
    <div style={{ display: 'grid', gap: 14 }}>
      {feed.map((item) => <article key={`${item.kind}-${item.title}`} style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.035)', boxShadow: '0 14px 50px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', fontSize: 18 }}>{glyph[item.kind]}</div><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.2em', opacity: .45 }}>{item.label}</div></div>
        <h3 style={{ margin: '18px 0 8px', fontSize: 21 }}>{item.title}</h3><p style={{ margin: 0, lineHeight: 1.6, opacity: .52 }}>{item.body}</p>
        {item.action && (item.href
          ? <Link href={item.href} style={{ marginTop: 18, display: 'inline-block', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,.06)', color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>{item.action}</Link>
          : <button type="button" style={{ marginTop: 18, border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,.06)', color: 'inherit', cursor: 'pointer' }}>{item.action}</button>)}
      </article>)}
    </div>
  </section>;
}
