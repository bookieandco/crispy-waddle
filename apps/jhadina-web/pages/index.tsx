import React, { useState } from 'react';
import Link from 'next/link';
import { PersonalCommandFeed } from '../components/home/PersonalCommandFeed';
import { feedSources, type FeedSource } from '../components/home/feedSources';
import { QuickActions } from '../src/components/QuickActions';
import styles from '../components/home/HomepageComposition.module.css';

const navigation = [
  ['Home', '/'], ['Focus', '/activity'], ['Saved', '/activity'], ['Activity', '/activity'], ['Connections', '/settings/privacy'], ['Apps', '/ask-jhadina'],
] as const;

export default function Home() {
  const [source, setSource] = useState<FeedSource>('All');
  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <div><div className={styles.brand}>Jhadina</div><div className={styles.subtitle}>Personal AI Operating System</div></div>
        <Link href="/ask-jhadina" className={styles.command} aria-label="Ask Jhadina"><span>✦</span><span>Ask Jhadina…</span><span className={styles.commandKbd}>⌘ K</span></Link>
      </header>
      <div className={styles.layout}>
        <aside className={styles.side} aria-label="Jhadina navigation">
          {navigation.map(([label, href]) => <Link key={label} href={href} className={`${styles.sideLink} ${label === 'Home' ? styles.sideLinkActive : ''}`}>{label}</Link>)}
        </aside>
        <section className={styles.feed} aria-label="Jhadina home feed">
          <QuickActions />
          <div className={styles.filters} aria-label="Feed sources">
            {feedSources.map((value) => <button key={value} type="button" aria-pressed={source === value} className={`${styles.filter} ${source === value ? styles.filterActive : ''}`} onClick={() => setSource(value)}>{value}</button>)}
          </div>
          <p className={styles.filterDescription}>{source === 'All' ? 'Your social and media stream.' : `Showing ${source} content.`}</p>
          <PersonalCommandFeed source={source} />
        </section>
      </div>
    </main>
  );
}
