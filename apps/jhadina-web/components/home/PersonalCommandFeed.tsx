import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getCurrentUserId } from '../../src/lib/auth/current-user';
import { baseStories } from './storyCatalog';
import type { FeedFilter, Story } from './storyTypes';
import styles from './PersonalCommandFeed.module.css';

const glyph: Record<Story['kind'], string> = {
  music: '♪', opportunity: '$', director: '▶', social: '◎', youtube: 'Y', jhadina: '✦', growth: '📈',
};

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
          id: 'growth-pending-approval',
          kind: 'growth',
          source: 'Growth',
          title: first.title || 'A draft is ready for your review.',
          body: pending.length > 1 ? `${pending.length} drafts are waiting on your approval. Nothing publishes without you.` : first.body,
          age: 'Needs attention',
          action: { label: 'Review', href: '/growth' },
          details: [
            { label: 'Status', value: 'Pending approval' },
            { label: 'Drafts', value: String(pending.length) },
            { label: 'Publishing', value: 'Human gated' },
          ],
          filters: ['All', 'Today', 'Focus'],
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

function StoryCard({ story, onOpen }: { story: Story; onOpen: (story: Story) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={styles.card} onClick={() => onOpen(story)}>
      <div className={styles.cardHeader}>
        <div className={styles.glyph} aria-hidden="true">{glyph[story.kind]}</div>
        <div className={styles.source}>{story.source}</div>
        <div className={styles.meta}>{story.age}</div>
      </div>
      <h3 className={styles.cardTitle}>{story.title}</h3>
      <p className={styles.body}>{story.body}</p>
      {(story.action || story.details) && (
        <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
          {story.action && (story.action.href ? (
            <Link href={story.action.href} className={styles.action}>{story.action.label}</Link>
          ) : (
            <button type="button" className={styles.action}>{story.action.label}</button>
          ))}
          {story.details && (
            <button type="button" className={styles.secondary} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
              {expanded ? 'Hide details' : 'Details'}
            </button>
          )}
        </div>
      )}
      {expanded && story.details && (
        <div className={styles.detail}>
          <div className={styles.detailGrid}>
            {story.details.map((detail) => (
              <div className={styles.detailItem} key={detail.label}>
                <span className={styles.detailLabel}>{detail.label}</span>
                <span className={styles.detailValue}>{detail.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function PersonalCommandFeed({ filter = 'All' }: { filter?: FeedFilter }) {
  const growthStory = useGrowthProposal();
  const [selected, setSelected] = useState<Story | null>(null);
  const stories = useMemo(() => {
    const all = growthStory ? [baseStories[0], growthStory, ...baseStories.slice(1)] : baseStories;
    return filter === 'All' ? all : all.filter((story) => story.filters.includes(filter));
  }, [filter, growthStory]);

  return (
    <section className={styles.feed}>
      <div className={styles.intro}>
        <div className={styles.eyebrow}>Jhadina Home</div>
        <h2 className={styles.title}>Your world, in one stream.</h2>
        <p className={styles.description}>Social, music, opportunities, media, and Jhadina — mixed by context instead of trapped in separate apps.</p>
      </div>
      <div className={styles.list}>
        {stories.length ? stories.map((story) => <StoryCard key={story.id} story={story} onOpen={setSelected} />) : <div className={styles.empty}>Nothing is in this view yet.</div>}
      </div>
      {selected && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={selected.title} onClick={() => setSelected(null)}>
          <div className={styles.detailPanel} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label="Close">×</button>
            <div className={styles.source}>{selected.source}</div>
            <h3 className={styles.detailTitle}>{selected.title}</h3>
            <p className={styles.body}>{selected.body}</p>
            {selected.details && (
              <div className={styles.detailGrid}>
                {selected.details.map((detail) => <div className={styles.detailItem} key={detail.label}><span className={styles.detailLabel}>{detail.label}</span><span className={styles.detailValue}>{detail.value}</span></div>)}
              </div>
            )}
            {selected.action?.href && <Link href={selected.action.href} className={styles.action}>{selected.action.label}</Link>}
          </div>
        </div>
      )}
    </section>
  );
}
