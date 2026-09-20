import React, { useState } from 'react';
import Link from 'next/link';
import { PersonalCommandFeed } from '../components/home/PersonalCommandFeed';
import { feedSources, type FeedSource } from '../components/home/feedSources';
import styles from '../components/home/HomepageComposition.module.css';

const mission = [
  { title: 'Needs You', description: 'Approvals and decisions waiting for you.', href: '/approvals', action: 'Review' },
  { title: 'Continue', description: 'Return to recent work across Jhadina.', href: '/activity', action: 'Resume' },
  { title: 'Active Work', description: 'See governed actions and work in progress.', href: '/activity', action: 'Open' },
  { title: 'Opportunities', description: 'Review opportunities Jhadina has surfaced.', href: '/opportunity', action: 'Explore' },
] as const;

export default function Home() {
  const [source, setSource] = useState<FeedSource>('All');
  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <div><div className={styles.brand}>Jhadina</div><div className={styles.subtitle}>Mission Control</div></div>
        <Link href="/ask-jhadina" className={styles.command} aria-label="Ask Jhadina"><span aria-hidden="true">✦</span><span>Ask Jhadina…</span><span className={styles.commandKbd}>⌘ K</span></Link>
      </header>

      <div className={styles.layout}>
        <section className={styles.mission} aria-labelledby="mission-title">
          <div className={styles.intro}>
            <div className={styles.eyebrow}>Mission Control</div>
            <h1 id="mission-title" className={styles.title}>What needs your attention.</h1>
            <p className={styles.description}>Continue work, review decisions, and see what Jhadina has found without opening every World.</p>
          </div>

          <div className={styles.missionGrid}>
            {mission.map((item) => (
              <Link href={item.href} key={item.title} className={styles.missionCard}>
                <span className={styles.cardTitle}>{item.title}</span>
                <span className={styles.cardDescription}>{item.description}</span>
                <span className={styles.cardAction}>{item.action} →</span>
              </Link>
            ))}
          </div>

          <section className={styles.exceptions} aria-labelledby="exceptions-title">
            <div>
              <div className={styles.sectionLabel}>System</div>
              <h2 id="exceptions-title">Exceptions</h2>
            </div>
            <p>Operational warnings belong here only when backed by canonical system evidence. No decorative “healthy” or “connected” states.</p>
            <Link href="/activity">View activity</Link>
          </section>

          <section className={styles.intelligence} aria-labelledby="intelligence-title">
            <div className={styles.sectionHeading}>
              <div><div className={styles.sectionLabel}>Recent Intelligence</div><h2 id="intelligence-title">Your signal stream</h2></div>
              <Link href="/ask-jhadina">Ask about this</Link>
            </div>
            <div className={styles.filters} aria-label="Feed sources">
              {feedSources.map((value) => <button key={value} type="button" aria-pressed={source === value} className={`${styles.filter} ${source === value ? styles.filterActive : ''}`} onClick={() => setSource(value)}>{value}</button>)}
            </div>
            <p className={styles.filterDescription}>{source === 'All' ? 'Signals from your connected media and information sources.' : `Showing ${source} signals.`}</p>
            <PersonalCommandFeed source={source} />
          </section>
        </section>
      </div>
    </main>
  );
}
