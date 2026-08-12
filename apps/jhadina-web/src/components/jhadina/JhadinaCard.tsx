'use client';
import type { ReactNode } from 'react';
import styles from './JhadinaCard.module.css';

export type JhadinaCardKind = 'media' | 'product' | 'recipe' | 'event' | 'knowledge' | 'action';

export interface JhadinaCardProps {
  kind: JhadinaCardKind;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: string;
  meta?: string;
  onOpen?: () => void;
  children?: ReactNode;
}

export function JhadinaCard({ kind, title, subtitle, imageUrl, badge, meta, onOpen, children }: JhadinaCardProps) {
  const content = <>
    {imageUrl ? <div className={styles.media} style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" /> : <div className={styles.mediaFallback} aria-hidden="true"><span>{kindIcon(kind)}</span></div>}
    <div className={styles.body}>
      <div className={styles.topline}>{badge && <span className={styles.badge}>{badge}</span>}{meta && <span className={styles.meta}>{meta}</span>}</div>
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  </>;
  return onOpen ? <button type="button" className={styles.card} onClick={onOpen}>{content}</button> : <article className={styles.card}>{content}</article>;
}

function kindIcon(kind: JhadinaCardKind) {
  return { media: '▶', product: '🛍️', recipe: '🍳', event: '📡', knowledge: '🧠', action: '✦' }[kind];
}
