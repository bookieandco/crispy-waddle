import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { PersonalCommandFeed } from '../components/home/PersonalCommandFeed';
import styles from '../components/home/HomepageComposition.module.css';

const navigation = [
  ['Home', '/'],
  ['Focus', '/activity'],
  ['Saved', '/activity'],
  ['Activity', '/activity'],
  ['Connections', '/settings/privacy'],
  ['Apps', '/ask-jhadina'],
] as const;

const filters = ['All', 'Today', 'Focus', 'Saved'] as const;

export default function Home() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const filterDescription = useMemo(() => {
    if (filter === 'Today') return 'Recent activity and stories from today.';
    if (filter === 'Focus') return 'The items most likely to need your attention.';
    if (filter === 'Saved') return 'Stories you have intentionally kept for later.';
    return 'Social, music, opportunities, media, and Jhadina — mixed by context instead of trapped in separate apps.';
  }, [filter]);

  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <div>
          <div className={styles.brand}>Jhadina</div>
          <div className={styles.subtitle}>Personal AI Operating System</div>
        </div>
        <Link href="/ask-jhadina" className={styles.command} aria-label="Ask Jhadina">
          <span>✦</span>
          <span>Ask Jhadina…</span>
          <span className={styles.commandKbd}>⌘ K</span>
        </Link>
      </header>

      <div className={styles.layout}>
        <aside className={styles.side} aria-label="Jhadina navigation">
          {navigation.map(([label, href]) => (
            <Link key={label} href={href} className={`${styles.sideLink} ${label === 'Home' ? styles.sideLinkActive : ''}`}>
              {label}
            </Link>
          ))}
        </aside>

        <section className={styles.feed} aria-label="Jhadina home feed">
          <div className={styles.filters} aria-label="Feed filters">
            {filters.map((value) => (
              <button key={value} type="button" aria-pressed={filter === value} className={`${styles.filter} ${filter === value ? styles.filterActive : ''}`} onClick={() => setFilter(value)}>
                {value}
              </button>
            ))}
          </div>
          <p className={styles.filterDescription}>{filterDescription}</p>
          <PersonalCommandFeed filter={filter} />
        </section>
      </div>
    </main>
  );
}
