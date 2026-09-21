import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { baseStories } from './storyCatalog';
import { storyMatchesSource, type FeedSource, type Story } from './storyTypes';
import styles from './PersonalCommandFeed.module.css';

const glyph: Record<Story['kind'], string> = {
  social: '◎',
  youtube: 'Y',
  director: '▶',
  jhadina: '✦',
};

type GrowthDraft = { title?: string; body: string; status: string };

type SocialHubItem = {
  id: string;
  source: 'publication' | 'observation';
  occurredAt: string;
  platform?: string;
  title: string;
  status?: string;
  contentId?: string;
  provenance: string[];
};

function sourceForPlatform(platform?: string): Exclude<FeedSource, 'All'> {
  switch ((platform ?? '').toLowerCase()) {
    case 'tiktok': return 'TikTok';
    case 'facebook': return 'Facebook';
    case 'instagram': return 'Instagram';
    case 'youtube': return 'YouTube';
    case 'reddit': return 'Reddit';
    case 'snapchat': return 'Snapchat';
    case 'x': return 'X';
    case 'linkedin': return 'LinkedIn';
    case 'threads': return 'Threads';
    case 'bluesky': return 'Bluesky';
    case 'tumblr': return 'Tumblr';
    case 'vk': return 'VK';
    default: return 'Social';
  }
}

function useGrowthProposal(): Story | null {
  const [story, setStory] = useState<Story | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch('/api/growth/drafts', { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json();
        const drafts: GrowthDraft[] = json.data?.drafts ?? [];
        const pending = drafts.filter((draft) => draft.status === 'PENDING_APPROVAL');
        if (cancelled || pending.length === 0) return;

        const first = pending[0];
        setStory({
          id: 'growth-pending-approval',
          kind: 'director',
          source: 'Director',
          title: first.title || 'A draft is ready for your review.',
          body: pending.length > 1
            ? `${pending.length} drafts are waiting on your approval. Nothing publishes without you.`
            : first.body,
          age: 'Needs attention',
          action: { label: 'Review', href: '/growth' },
          details: [
            { label: 'Status', value: 'Pending approval' },
            { label: 'Drafts', value: String(pending.length) },
            { label: 'Publishing', value: 'Human gated' },
          ],
        });
      } catch {
        // Home preview stays quiet when Growth is unavailable.
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return story;
}

function useSocialHubStories(): Story[] {
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch('/api/social/hub', { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json();
        const items: SocialHubItem[] = json.data?.items ?? [];
        if (cancelled) return;

        setStories(items.slice(0, 20).map((item) => {
          const source = sourceForPlatform(item.platform);
          return {
            id: `social-hub:${item.id}`,
            kind: source === 'YouTube' ? 'youtube' : 'social',
            source,
            title: item.title,
            body: item.source === 'publication'
              ? 'Governed publication activity from the Social outbox.'
              : 'Observed social activity with preserved source evidence.',
            age: item.status ?? new Date(item.occurredAt).toLocaleString(),
            action: item.source === 'publication' ? { label: 'Open Social', href: '/social' } : undefined,
            details: [
              { label: 'Type', value: item.source },
              ...(item.status ? [{ label: 'Status', value: item.status }] : []),
              ...(item.platform ? [{ label: 'Platform', value: item.platform }] : []),
              { label: 'Provenance', value: item.provenance.slice(0, 3).join(' · ') || 'Recorded' },
            ],
          } satisfies Story;
        }));
      } catch {
        // The unified feed remains usable while a provider or migration is unavailable.
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return stories;
}

function StoryCard({ story, onOpen }: { story: Story; onOpen: (story: Story) => void }) {
  return <article className={styles.card} onClick={() => onOpen(story)}>
    <div className={styles.cardHeader}>
      <div className={styles.glyph} aria-hidden="true">{glyph[story.kind]}</div>
      <div className={styles.source}>{story.source}</div>
      <div className={styles.meta}>{story.age}</div>
    </div>
    <h3 className={styles.cardTitle}>{story.title}</h3>
    <p className={styles.body}>{story.body}</p>
    {story.action && <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
      {story.action.href
        ? <Link href={story.action.href} className={styles.action}>{story.action.label}</Link>
        : <button type="button" className={styles.action}>{story.action.label}</button>}
    </div>}
  </article>;
}

const feedSources: FeedSource[] = ['All','Social','TikTok','Facebook','Snapchat','Instagram','YouTube','Reddit','X','LinkedIn','Threads','Bluesky','Tumblr','VK','Director'];

export function PersonalCommandFeed({ source }: { source?: FeedSource }) {
  const growthStory = useGrowthProposal();
  const socialStories = useSocialHubStories();
  const [selected, setSelected] = useState<Story | null>(null);
  const [selectedSource, setSelectedSource] = useState<FeedSource>(source ?? 'All');

  useEffect(() => { if (source) setSelectedSource(source); }, [source]);
  const activeSource = source ?? selectedSource;

  const stories = useMemo(() => {
    const all = [
      ...socialStories,
      ...(growthStory ? [growthStory] : []),
      ...baseStories,
    ];
    return all.filter((story) => storyMatchesSource(story, activeSource));
  }, [activeSource, growthStory, socialStories]);

  return <section className={styles.feed}>
    <div className={styles.intro}>
      <div className={styles.eyebrow}>Social + media intelligence</div>
      <h2 className={styles.title}>Your world, in one scroll.</h2>
      <p className={styles.description}>
        TikTok, Instagram, YouTube, X, Facebook, Reddit and the rest of Jhadina’s social/media stream stay browseable here with source, provenance and approval state intact.
      </p>
    </div>
    {!source && <div className={styles.filters} role="tablist" aria-label="Filter social and media stream">
      {feedSources.map((item) => <button key={item} type="button" role="tab" aria-selected={activeSource === item} className={activeSource === item ? styles.filterActive : styles.filter} onClick={() => setSelectedSource(item)}>{item}</button>)}
    </div>}
    <div className={styles.list} aria-label={activeSource + " feed"}>
      {stories.length
        ? stories.map((story) => <StoryCard key={story.id} story={story} onOpen={setSelected} />)
        : <div className={styles.empty}>Nothing is in this source yet.</div>}
    </div>
    {selected && <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={selected.title}
      onClick={() => setSelected(null)}
    >
      <div className={styles.detailPanel} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label="Close">×</button>
        <div className={styles.source}>{selected.source}</div>
        <h3 className={styles.detailTitle}>{selected.title}</h3>
        <p className={styles.body}>{selected.body}</p>
        {selected.details && <div className={styles.detailGrid}>
          {selected.details.map((detail) => <div className={styles.detailItem} key={detail.label}>
            <span className={styles.detailLabel}>{detail.label}</span>
            <span className={styles.detailValue}>{detail.value}</span>
          </div>)}
        </div>}
        {selected.action?.href && <Link href={selected.action.href} className={styles.action}>{selected.action.label}</Link>}
      </div>
    </div>}
  </section>;
}
