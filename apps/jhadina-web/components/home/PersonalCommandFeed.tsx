import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getCurrentUserId } from '../../src/lib/auth/current-user';

type Kind = 'work' | 'social' | 'jhadina';
type Platform = 'facebook' | 'instagram' | 'tiktok' | 'youtube';

type FeedItem = {
  id: string;
  kind: Kind;
  label: string;
  title: string;
  body: string;
  platform?: Platform;
  status?: string;
  action?: string;
  href?: string;
  timestamp?: string;
  relevance?: number;
};

type GrowthDraft = { id: string; title?: string; body: string; status: string };
type SocialPost = {
  id: string;
  text: string;
  platforms?: Platform[];
  status: string;
  scheduledAt?: string;
};

const glyph: Record<Kind | Platform, string> = {
  work: '$',
  social: '◎',
  jhadina: '✦',
  facebook: 'f',
  instagram: '◎',
  tiktok: '♪',
  youtube: 'Y',
};

const platformLabel: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

function recencyScore(timestamp?: string) {
  if (!timestamp) return 20;
  const ageHours = Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 3_600_000);
  if (ageHours <= 1) return 100;
  if (ageHours <= 6) return 80;
  if (ageHours <= 24) return 60;
  if (ageHours <= 72) return 35;
  return 10;
}

function scoreItem(item: FeedItem) {
  const workBoost = item.kind === 'work' ? 35 : 0;
  const approvalBoost = item.status === 'PENDING_APPROVAL' ? 45 : 0;
  return (item.relevance ?? 0) + workBoost + approvalBoost + recencyScore(item.timestamp);
}

function useUnifiedFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        const headers = { 'x-jhadina-user-id': userId };

        const [growthRes, socialRes] = await Promise.all([
          fetch('/api/growth/drafts', { headers }),
          fetch('/api/social/posts', { headers }),
        ]);

        const next: FeedItem[] = [];

        if (growthRes.ok) {
          const json = await growthRes.json();
          const drafts: GrowthDraft[] = json.data?.drafts ?? [];
          for (const draft of drafts.filter((d) => d.status === 'PENDING_APPROVAL')) {
            next.push({
              id: `growth-${draft.id}`,
              kind: 'work',
              label: 'Work',
              title: draft.title || 'Something is ready for your review.',
              body: draft.body,
              status: draft.status,
              action: 'Review',
              href: '/growth',
              relevance: 100,
            });
          }
        }

        if (socialRes.ok) {
          const json = await socialRes.json();
          const posts: SocialPost[] = json.data ?? [];
          for (const post of posts) {
            const platform = post.platforms?.[0];
            next.push({
              id: `social-${post.id}`,
              kind: 'social',
              label: platform ? platformLabel[platform] : 'Social',
              title: platform ? `${platformLabel[platform]} activity` : 'Social activity',
              body: post.text || 'A connected social update is available.',
              platform,
              status: post.status,
              timestamp: post.scheduledAt,
              relevance: platform === 'tiktok' ? 5 : 0,
            });
          }
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

export function PersonalCommandFeed() {
  const [filter, setFilter] = useState<'all' | Kind | Platform>('all');
  const items = useUnifiedFeed();

  const feed = useMemo(() => {
    const filtered = filter === 'all'
      ? items
      : items.filter((item) => item.kind === filter || item.platform === filter);

    return [...filtered].sort((a, b) => scoreItem(b) - scoreItem(a));
  }, [filter, items]);

  const filters: Array<{ id: typeof filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'work', label: 'Work' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'youtube', label: 'YouTube' },
  ];

  return (
    <section style={{ maxWidth: 820, margin: '0 auto', padding: '48px 20px 96px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: '.28em', textTransform: 'uppercase', opacity: .42 }}>Jhadina Home</div>
        <h2 style={{ fontSize: 38, lineHeight: 1.05, margin: '10px 0 8px' }}>Everything relevant. One scroll.</h2>
        <p style={{ margin: 0, opacity: .52 }}>TikTok, Instagram, Facebook, YouTube, and your work — ranked by what deserves your attention first.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 18 }}>
        {filters.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            style={{ flex: '0 0 auto', border: '1px solid rgba(255,255,255,.1)', borderRadius: 999, padding: '8px 13px', background: filter === option.id ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.035)', color: 'inherit', cursor: 'pointer' }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {feed.map((item) => (
          <article key={item.id} style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.035)', boxShadow: '0 14px 50px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', fontSize: 18 }}>
                {item.platform ? glyph[item.platform] : glyph[item.kind]}
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.2em', opacity: .45 }}>{item.label}</div>
                {item.status && <div style={{ fontSize: 11, opacity: .35, marginTop: 3 }}>{item.status.replaceAll('_', ' ')}</div>}
              </div>
            </div>

            <h3 style={{ margin: '18px 0 8px', fontSize: 21 }}>{item.title}</h3>
            <p style={{ margin: 0, lineHeight: 1.6, opacity: .62, whiteSpace: 'pre-wrap' }}>{item.body}</p>

            {item.action && item.href && (
              <Link href={item.href} style={{ marginTop: 18, display: 'inline-block', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,.06)', color: 'inherit', textDecoration: 'none' }}>
                {item.action}
              </Link>
            )}
          </article>
        ))}

        {items.length === 0 && (
          <div style={{ padding: 24, borderRadius: 20, border: '1px dashed rgba(255,255,255,.12)', opacity: .5 }}>
            Connect your social accounts and Jhadina will start mixing their activity with your work here.
          </div>
        )}
      </div>
    </section>
  );
}
