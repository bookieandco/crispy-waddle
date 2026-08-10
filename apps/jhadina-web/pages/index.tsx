import React from 'react';
import { PersonalCommandFeed } from '../components/home/PersonalCommandFeed';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#07080b', color: '#fff' }}>
      <header style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, letterSpacing: '.02em' }}>Jhadina</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, opacity: .45 }}>
          <a href="/activity" style={{ color: 'inherit' }}>Activity</a>
          <span>Personal AI Operating System</span>
        </div>
      </header>
      <PersonalCommandFeed />
    </main>
  );
}
