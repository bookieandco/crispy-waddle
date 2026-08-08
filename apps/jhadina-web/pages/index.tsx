import React, { useMemo, useState } from 'react';
import type { JhadinaFeedItem } from '../src/lib/feed/types';
import { mockFeed } from '../src/lib/feed/mockFeed';
import '../src/styles/jhadina-feed.css';

function Media({ item, onOpen }: { item: JhadinaFeedItem; onOpen: () => void }) {
  if (!item.media) return null;
  if (item.media.provider === 'youtube' && item.media.videoId) {
    return <div className="jh-media"><iframe src={`https://www.youtube.com/embed/${item.media.videoId}?rel=0`} title={item.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>;
  }
  return <div className="jh-media">{item.media.live && <span className="jh-media-live">LIVE</span>}<div className="jh-fake-media"><button className="jh-play" aria-label={`Play ${item.title}`} onClick={onOpen}>▶</button></div></div>;
}

function Card({ item, onAction, onOpenMedia }: { item: JhadinaFeedItem; onAction: (item: JhadinaFeedItem, action: string) => void; onOpenMedia: (item: JhadinaFeedItem) => void }) {
  return <article className={`jh-card ${item.state === 'pending' ? 'pending' : ''}`}>
    {item.media && <Media item={item} onOpen={() => onOpenMedia(item)} />}
    <div className="jh-card-body">
      <div className="jh-card-meta"><span>{item.type.replace('_', ' ')}</span><span>{item.source} · {item.timestamp}</span></div>
      <h2 className="jh-card-title">{item.title}</h2><p className="jh-card-summary">{item.summary}</p>
      {item.impact && <div className="jh-impact"><span className="jh-impact-value">{item.impact.value}</span><span className="jh-impact-label">{item.impact.label}</span></div>}
      <div className="jh-reason"><strong>Why you're seeing this</strong><br />{item.reason}</div>
      <div className="jh-actions">{item.actions.map((action) => <button key={action.id} className={`jh-action ${action.kind}`} onClick={() => onAction(item, action.id)}>{action.label}</button>)}<button className="jh-action" onClick={() => onAction(item, 'explain')}>•••</button></div>
    </div>
  </article>;
}

export default function Home() {
  const [items, setItems] = useState(mockFeed);
  const [activeNav, setActiveNav] = useState('Home');
  const [toast, setToast] = useState<string | null>(null);
  const [player, setPlayer] = useState<JhadinaFeedItem | null>(null);
  const [search, setSearch] = useState('');
  const visible = useMemo(() => { const q = search.trim().toLowerCase(); return q ? items.filter((item) => `${item.title} ${item.summary} ${item.source} ${item.type}`.toLowerCase().includes(q)) : items; }, [items, search]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3000); };
  const act = (item: JhadinaFeedItem, action: string) => {
    if (action === 'explain') return notify(item.reason);
    if (action === 'dismiss' || action === 'reject') { setItems((current) => current.filter((candidate) => candidate.id !== item.id)); return notify('Removed from your feed'); }
    if (action === 'save') return notify('Saved');
    if (action === 'edit') return notify('Editor ready');
    if (['approve', 'review', 'reroute', 'open', 'read', 'watch', 'expand'].includes(action)) {
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, state: 'pending' } : candidate));
      notify(action === 'approve' ? 'Approval requested…' : `${item.title} opened`);
      window.setTimeout(() => { setItems((current) => current.filter((candidate) => candidate.id !== item.id)); notify(action === 'approve' ? 'Approved ✓' : 'Done ✓'); }, 850);
    }
  };
  const nav = ['Home', 'Discover', '+', 'Messages', 'You'];
  return <div className="jh-app"><div className="jh-shell">
    <header className="jh-topbar"><div className="jh-brand">Jhadina</div><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{activeNav === 'Discover' && <input aria-label="Search Jhadina" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" style={{ width: 150, padding: '9px 12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 999, background: '#16181d', color: 'white', outline: 'none' }} />}<button className="jh-icon" aria-label="Notifications">♡</button></div></header>
    {activeNav === 'Home' && <><section className="jh-home-head"><p className="jh-eyebrow">Good morning</p><h1 className="jh-headline">Here's what matters.</h1><p className="jh-subline">{items.length} things are ready for you.</p></section><main className="jh-feed">{visible.map((item) => <Card key={item.id} item={item} onAction={act} onOpenMedia={setPlayer} />)}</main>{!visible.length && <div className="jh-empty"><div className="jh-empty-mark">✓</div><h2>You're caught up.</h2><p>Nothing currently needs your attention.</p></div>}</>}
    {activeNav === 'Discover' && <section className="jh-home-head"><p className="jh-eyebrow">Discover</p><h1 className="jh-headline">Explore your world.</h1><p className="jh-subline">Search across opportunities, research, media and more.</p><div style={{ marginTop: 22 }} className="jh-carousel-row">{['Campaign','Music','Business','TV','Research','Opportunities'].map((tag) => <button key={tag} className="jh-action">{tag}</button>)}</div></section>}
    {activeNav === 'Messages' && <section className="jh-home-head"><p className="jh-eyebrow">Messages</p><h1 className="jh-headline">Your conversations.</h1><div className="jh-feed" style={{ padding: '24px 0' }}>{['Jhadina — Found 3 opportunities…','Campaign Team — Updated schedule','Community partner — Can I help Saturday?'].map((x) => <div className="jh-card" key={x}><div className="jh-card-body"><h2 style={{ fontSize: 15, margin: 0 }}>{x}</h2><p className="jh-subline">Tap to continue the conversation.</p></div></div>)}</div></section>}
    {activeNav === 'You' && <section className="jh-home-head"><p className="jh-eyebrow">You</p><h1 className="jh-headline">Your Jhadina.</h1><div className="jh-feed" style={{ padding: '24px 0' }}>{['Saved','Memory','Activity','Approvals','Connected Accounts','Permissions','Settings'].map((x) => <button className="jh-card" style={{ textAlign: 'left', cursor: 'pointer' }} key={x} onClick={() => notify(`${x} opened`)}><div className="jh-card-body"><h2 style={{ fontSize: 16, margin: 0 }}>{x}</h2></div></button>)}</div></section>}
    {activeNav === '+' && <section className="jh-empty"><div className="jh-eyebrow">Create</div><h2>What do you want to do?</h2><p>🎥 Create Video · 📝 Create Post · 🔎 Research · 💡 Opportunity · 🎙 Talk to Jhadina</p></section>}
  </div>
  {player && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.84)', display: 'grid', placeItems: 'center', padding: 18 }} onClick={() => setPlayer(null)}><div style={{ width: 'min(900px, 100%)', aspectRatio: '16/9', background: '#050505', borderRadius: 20, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}><Media item={player} onOpen={() => undefined} /></div></div>}
  {toast && <div className="jh-toast">{toast}</div>}
  <nav className="jh-nav" aria-label="Primary navigation">{nav.map((item) => <button key={item} className={`jh-nav-item ${activeNav === item ? 'active' : ''}`} onClick={() => setActiveNav(item)}>{item === '+' ? <span className="jh-nav-plus">+</span> : <><span>{item === 'Home' ? '⌂' : item === 'Discover' ? '⌕' : item === 'Messages' ? '◌' : '◉'}</span><span>{item}</span></>}</button>)}</nav>
  </div>;
}
