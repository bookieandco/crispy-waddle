import React from 'react';

const feed = [
  { label: 'Jhadina', glyph: '✦', title: 'Your world, in one stream.', body: 'Social, music, opportunities, media, and Jhadina — mixed by context instead of trapped in separate apps.' },
  { label: 'Music', glyph: '♪', title: 'Your Music is ready.', body: 'Pick up where you left off or search for something new.', action: 'Open Music', href: '/music' },
  { label: 'Opportunity', glyph: '$', title: 'A business opportunity needs your attention.', body: 'Opportunity intelligence will surface leads, ideas, and time-sensitive opportunities here.', action: 'Review' },
  { label: 'Director', glyph: '▶', title: 'A new video is ready for review.', body: 'Creative output from your Director workspace can appear here before anything is published.', action: 'Watch' },
  { label: 'YouTube', glyph: 'Y', title: 'Recommended video space.', body: 'Connected YouTube content can appear here once the account is authorized.', action: 'Connect' },
  { label: 'Social', glyph: '◎', title: 'Your social world, mixed into the stream.', body: 'Facebook, Instagram, and TikTok cards will be pulled through authorized integrations — never scraped.', action: 'Connect' },
];

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#0b0b0d', color: '#f5f5f5', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '48px 20px 96px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: '.28em', textTransform: 'uppercase', opacity: .42 }}>Jhadina Home</div>
          <h1 style={{ fontSize: 38, lineHeight: 1.05, margin: '10px 0 8px' }}>Your world, in one stream.</h1>
          <p style={{ margin: 0, lineHeight: 1.6, opacity: .52 }}>Social, music, opportunities, media, and Jhadina — mixed by context instead of trapped in separate apps.</p>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          {feed.map((item) => (
            <article key={`${item.label}-${item.title}`} style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.035)', boxShadow: '0 14px 50px rgba(0,0,0,.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', fontSize: 18 }}>{item.glyph}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.2em', opacity: .45 }}>{item.label}</div>
              </div>
              <h2 style={{ margin: '18px 0 8px', fontSize: 21 }}>{item.title}</h2>
              <p style={{ margin: 0, lineHeight: 1.6, opacity: .52 }}>{item.body}</p>
              {item.action && (
                item.href ? <a href={item.href} style={{ display: 'inline-block', marginTop: 18, border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', color: 'inherit', textDecoration: 'none', background: 'rgba(255,255,255,.06)' }}>{item.action}</a> :
                <button type="button" style={{ marginTop: 18, border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,.06)', color: 'inherit', cursor: 'pointer' }}>{item.action}</button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
