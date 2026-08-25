import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getCurrentUserId } from '../../src/lib/auth/current-user';
import { baseStories } from './storyCatalog';
import { storyMatchesSource, type FeedSource, type Story } from './storyTypes';
import styles from './PersonalCommandFeed.module.css';

const glyph: Record<Story['kind'], string> = { social: '◎', youtube: 'Y', director: '▶', jhadina: '✦' };

type GrowthDraft = { title?: string; body: string; status: string };

function useGrowthProposal(): Story | null {
  const [story, setStory] = useState<Story | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        const response = await fetch('/api/growth/drafts', { headers: { 'x-jhadina-user-id': userId } });
        if (!response.ok) return;
        const json = await response.json();
        const drafts: GrowthDraft[] = json.data?.drafts ?? [];
        const pending = drafts.filter((draft) => draft.status === 'PENDING_APPROVAL');
        if (cancelled || pending.length === 0) return;
        const first = pending[0];
        setStory({
          id: 'growth-pending-approval', kind: 'director', source: 'Director',
          title: first.title || 'A draft is ready for your review.',
          body: pending.length > 1 ? `${pending.length} drafts are waiting on your approval. Nothing publishes without you.` : first.body,
          age: 'Needs attention', action: { label: 'Review', href: '/growth' },
          details: [{ label: 'Status', value: 'Pending approval' }, { label: 'Drafts', value: String(pending.length) }, { label: 'Publishing', value: 'Human gated' }],
        });
      } catch { /* Home preview stays quiet when Growth is unavailable. */ }
    }
    void load();
    return () => { cancelled = true; };
  }, []);
  return story;
}

function StoryCard({ story, onOpen }: { story: Story; onOpen: (story: Story) => void }) {
  return <article className={styles.card} onClick={() => onOpen(story)}>
    <div className={styles.cardHeader}><div className={styles.glyph} aria-hidden="true">{glyph[story.kind]}</div><div className={styles.source}>{story.source}</div><div className={styles.meta}>{story.age}</div></div>
    <h3 className={styles.cardTitle}>{story.title}</h3><p className={styles.body}>{story.body}</p>
    {story.action && <div className={styles.actions} onClick={(event) => event.stopPropagation()}>{story.action.href ? <Link href={story.action.href} className={styles.action}>{story.action.label}</Link> : <button type="button" className={styles.action}>{story.action.label}</button>}</div>}
  </article>;
}

export function PersonalCommandFeed({ source = 'All' }: { source?: FeedSource }) {
  const growthStory = useGrowthProposal();
  const [selected, setSelected] = useState<Story | null>(null);
  const stories = useMemo(() => {
    const all = growthStory ? [...baseStories, growthStory] : baseStories;
    return all.filter((story) => storyMatchesSource(story, source));
  }, [source, growthStory]);
  return <section className={styles.feed}>
    <div className={styles.intro}><div className={styles.eyebrow}>Jhadina Home</div><h2 className={styles.title}>Your world, in one stream.</h2><p className={styles.description}>Social, media, and Jhadina activity — mixed by context instead of trapped in separate apps.</p></div>
    <div className={styles.list}>{stories.length ? stories.map((story) => <StoryCard key={story.id} story={story} onOpen={setSelected} />) : <div className={styles.empty}>Nothing is in this source yet.</div>}</div>
    {selected && <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={selected.title} onClick={() => setSelected(null)}><div className={styles.detailPanel} onClick={(event) => event.stopPropagation()}><button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label="Close">×</button><div className={styles.source}>{selected.source}</div><h3 className={styles.detailTitle}>{selected.title}</h3><p className={styles.body}>{selected.body}</p>{selected.details && <div className={styles.detailGrid}>{selected.details.map((detail) => <div className={styles.detailItem} key={detail.label}><span className={styles.detailLabel}>{detail.label}</span><span className={styles.detailValue}>{detail.value}</span></div>)}</div>}{selected.action?.href && <Link href={selected.action.href} className={styles.action}>{selected.action.label}</Link>}</div></div>}
  </section>;
}
