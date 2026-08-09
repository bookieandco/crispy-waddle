'use client';
import { useState } from 'react';
import styles from './PublishingWorkbench.module.css';

const tabs = ['Write', 'Research', 'Library', 'Preview', 'Publish'] as const;
const tools = ['Editor', 'Visuals', 'Research', 'Reader', 'Formats', 'Proof', 'Metadata', 'KDP', 'Store', 'POD', 'Analytics'] as const;

export function PublishingWorkbench() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Write');
  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Jhadina · Publishing</span><h1>Publishing Workbench</h1><p>Write, research, design, proof, publish and sell from one workspace.</p></div><button className={styles.ask}>✦ Ask Jhadina</button></header>
    <nav className={styles.tabs}>{tabs.map((item) => <button key={item} className={tab === item ? styles.active : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <section className={styles.layout}>
      <aside className={styles.sidebar}><h2>Workbench</h2>{tools.map((tool) => <button key={tool} className={styles.tool}>{tool}<span>›</span></button>)}<div className={styles.notice}><b>✦ Jhadina noticed</b><span>Your next step can be surfaced here from the publishing lifecycle.</span></div></aside>
      <section className={styles.canvas}><div className={styles.canvasTop}><span>{tab}</span><span className={styles.status}>Draft · Autosaved</span></div><div className={styles.paper}><div className={styles.coverPlaceholder}>BOOK COVER</div><div className={styles.manuscript}><span className={styles.chapter}>CHAPTER 01</span><h2>Your book starts here.</h2><p>Use this workspace as the single home for your manuscript, research, assets, preview and publishing decisions.</p><div className={styles.lines}/><div className={styles.lines}/><div className={styles.lines}/></div></div></section>
      <aside className={styles.right}><div className={styles.panel}><b>Next steps</b><p>Review manuscript</p><p>Prepare cover</p><p>Format EPUB + PDF</p><p>Run proof / QA</p></div><div className={styles.panel}><b>Distribution</b><p>Amazon KDP</p><p>Digital Store</p><p>Print-on-demand</p></div></aside>
    </section>
  </main>;
}
