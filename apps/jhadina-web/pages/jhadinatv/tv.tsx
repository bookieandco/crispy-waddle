import { useMemo } from 'react';
import type { LiveChannel, LiveProgram } from '@jhadina/tv-core';
import { buildUnifiedGuide } from '@jhadina/tv-core';

const channels: LiveChannel[] = [
  { id: 'local-news', name: 'Local News', kind: 'broadcast', source: 'demo', group: 'Local', language: 'en', provenance: 'user-configured' },
  { id: 'jhadina-crime', name: 'Jhadina Crime', kind: 'web', source: 'jhadina-channel', group: 'Jhadina Channels', provenance: 'user-configured' },
  { id: 'jhadina-comedy', name: 'Jhadina Comedy', kind: 'web', source: 'jhadina-channel', group: 'Jhadina Channels', provenance: 'user-configured' },
  { id: 'free-tv', name: 'Free TV', kind: 'iptv', source: 'm3u', group: 'Free TV', provenance: 'public-free' },
];

const now = new Date();
const programs: LiveProgram[] = channels.flatMap((channel, index) => {
  const start = new Date(now.getTime() - 30 * 60_000);
  const end = new Date(now.getTime() + 30 * 60_000);
  return [{ id: `${channel.id}-now`, channelId: channel.id, title: ['Local Headlines', 'Crime Classics', 'Comedy Hour', 'World Live'][index], description: 'Live programming from a configured JhadinaTV source.', startTime: start.toISOString(), endTime: end.toISOString(), category: channel.group }];
});

export default function JhadinaTVGuide() {
  const guide = useMemo(() => buildUnifiedGuide(channels, programs, now), []);

  return (
    <main style={{ minHeight: '100vh', background: '#07080b', color: '#f7f7f8', padding: '28px clamp(18px, 4vw, 56px)', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 34, flexWrap: 'wrap' }}>
        <div><strong style={{ fontSize: 25 }}>JHADINA<span style={{ opacity: .45 }}>TV</span></strong><div style={{ color: '#9296a2', marginTop: 6 }}>Live television, your way.</div></div>
        <a href="/jhadinatv" style={{ color: '#fff', textDecoration: 'none' }}>← Home</a>
      </header>

      <section style={{ marginBottom: 28 }}>
        <div style={{ color: '#9296a2', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 12 }}>Live now</div>
        <h1 style={{ fontSize: 'clamp(34px, 6vw, 62px)', margin: '8px 0' }}>What's on?</h1>
        <p style={{ color: '#a8abb5', maxWidth: 720 }}>One guide for antenna channels, Jellyfin Live TV, authorized M3U sources, and Jhadina-generated channels.</p>
      </section>

      <section style={{ display: 'grid', gap: 12 }} aria-label="Live TV guide">
        {guide.map(({ channel, program }, index) => (
          <article key={channel.id} style={{ display: 'grid', gridTemplateColumns: '64px minmax(140px, 1fr) minmax(180px, 2fr) auto', gap: 16, alignItems: 'center', padding: 18, border: '1px solid #242731', borderRadius: 18, background: '#101218' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{101 + index}</div>
            <div><strong>{channel.name}</strong><div style={{ color: '#737783', fontSize: 12, marginTop: 5 }}>{channel.group ?? 'Live'} · {channel.provenance}</div></div>
            <div><strong>{program?.title ?? 'No program data'}</strong><div style={{ color: '#9296a2', fontSize: 13, marginTop: 5 }}>{program?.description ?? 'Connect an EPG to see programming.'}</div></div>
            <a href={program ? `/jhadinatv/watch/tv/${channel.id}` : '#'} style={{ borderRadius: 999, padding: '10px 16px', background: '#fff', color: '#090a0d', textDecoration: 'none', fontWeight: 700 }}>Watch</a>
          </article>
        ))}
      </section>
    </main>
  );
}
