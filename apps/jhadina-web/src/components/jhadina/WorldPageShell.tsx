'use client';
import type { ReactNode } from 'react';
import styles from './WorldPageShell.module.css';

export interface WorldRail { title: string; actionLabel?: string; children: ReactNode }

export interface WorldPageShellProps {
  eyebrow: string;
  title: string;
  description?: string;
  heroImageUrl?: string;
  heroAction?: ReactNode;
  rails: WorldRail[];
  awareness?: ReactNode;
  children?: ReactNode;
}

export function WorldPageShell({ eyebrow, title, description, heroImageUrl, heroAction, rails, awareness, children }: WorldPageShellProps) {
  return <main className={styles.page}>
    <section className={styles.hero} style={heroImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(10,11,12,.94), rgba(10,11,12,.42), rgba(10,11,12,.72)), url(${heroImageUrl})` } : undefined}>
      <div className={styles.heroContent}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {heroAction && <div className={styles.heroActions}>{heroAction}</div>}
      </div>
    </section>
    {awareness && <section className={styles.awareness}><div className={styles.sectionTitle}><span>✦ Jhadina noticed</span></div>{awareness}</section>}
    {children}
    {rails.map((rail) => <section className={styles.rail} key={rail.title}><div className={styles.sectionTitle}><h2>{rail.title}</h2>{rail.actionLabel && <button type="button">{rail.actionLabel}</button>}</div><div className={styles.row}>{rail.children}</div></section>)}
  </main>
}
