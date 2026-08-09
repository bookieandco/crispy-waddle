'use client';
import { useEffect, useState } from 'react';
import styles from './PublishingWorkbench.module.css';

const tabs = ['Write', 'Research', 'Library', 'Preview', 'Publish'] as const;
const tools = ['Editor', 'Visuals', 'Research', 'Reader', 'Formats', 'Proof', 'Metadata', 'KDP', 'Store', 'POD', 'Analytics'] as const;
const STORAGE_KEY = 'jhadina-publishing-draft';

export function PublishingWorkbench() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Write');
  const [title, setTitle] = useState('Your book starts here.');
  const [body, setBody] = useState('Use this workspace as the single home for your manuscript, research, assets, preview and publishing decisions.');
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { title?: string; body?: string };
        if (draft.title) setTitle(draft.title);
        if (draft.body) setBody(draft.body);
      }
    } catch {}
  }, []);

  useEffect(() => {
    setSaved(false);
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, body, updatedAt: new Date().toISOString() }));
      setSaved(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [title, body]);

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Jhadina · Publishing</span><h1>Publishing Workbench</h1><p>Write, research, design, proof, publish and sell from one workspace.</p></div><button className={styles.ask} type="button">✦ Ask Jhadina</button></header>
    <nav className={styles.tabs}>{tabs.map((item) => <button type="button" key={item} className={tab === item ? styles.active : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <section className={styles.layout}>
      <aside className={styles.sidebar}><h2>Workbench</h2>{tools.map((tool) => <button type="button" key={tool} className={styles.tool} onClick={() => setTab(tool === 'Editor' || tool === 'Visuals' ? 'Write' : tool === 'Reader' || tool === 'Formats' || tool === 'Proof' ? 'Preview' : tool === 'KDP' || tool === 'Store' || tool === 'POD' || tool === 'Analytics' ? 'Publish' : tool === 'Research' || tool === 'Library' ? 'Research' : 'Publish')}>{tool}<span>›</span></button>)}<div className={styles.notice}><b>✦ Jhadina noticed</b><span>{saved ? 'Draft saved. Your next publishing step can be surfaced here.' : 'Saving your changes…'}</span></div></aside>
      <section className={styles.canvas}><div className={styles.canvasTop}><span>{tab}</span><span className={styles.status}>{saved ? 'Draft · Saved' : 'Draft · Saving…'}</span></div>{tab === 'Write' && <div className={styles.paper}><div className={styles.coverPlaceholder}>BOOK COVER</div><div className={styles.manuscript}><span className={styles.chapter}>CHAPTER 01</span><input className={styles.titleInput} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Book title"/><textarea className={styles.bodyInput} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Manuscript"/></div></div>}{tab !== 'Write' && <div className={styles.workspacePane}><span className={styles.paneIcon}>{tab === 'Research' ? '🔎' : tab === 'Library' ? '📚' : tab === 'Preview' ? '👁️' : '🚀'}</span><h2>{tab}</h2><p>This workspace is connected to the publishing lifecycle. The next implementation layer can populate it with live project data and Jhadina recommendations.</p></div>}</section>
      <aside className={styles.right}><div className={styles.panel}><b>Next steps</b><p>Review manuscript</p><p>Prepare cover</p><p>Format EPUB + PDF</p><p>Run proof / QA</p></div><div className={styles.panel}><b>Distribution</b><p>Amazon KDP</p><p>Digital Store</p><p>Print-on-demand</p></div></aside>
    </section>
  </main>;
}
