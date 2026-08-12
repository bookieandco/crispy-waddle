import React from 'react';
import { PersonalCommandFeed } from '../components/home/PersonalCommandFeed';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#07080b', color: '#fff' }}>
      <header style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, letterSpacing: '.02em', fontSize: 20 }}>Jhadina</div>
          <div style={{ fontSize: 11, opacity: .42, marginTop: 4 }}>Personal AI Operating System</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, opacity: .7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#65d68a', display: 'inline-block' }} />
          Core online
        </div>
      </header>
      <PersonalCommandFeed />
    </main>
  );
}
