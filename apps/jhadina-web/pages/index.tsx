import React from 'react';
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

const filters = ['All', 'Today', 'Focus', 'Saved'];

export default function Home() {
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
            {filters.map((filter, index) => (
              <button key={filter} type="button" className={`${styles.filter} ${index === 0 ? styles.filterActive : ''}`}>
                {filter}
              </button>
            ))}
          </div>
          <PersonalCommandFeed />
        </section>
      </div>
    </main>
  );
}
