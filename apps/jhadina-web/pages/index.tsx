import React from 'react';
import { PersonalCommandFeed } from '../components/home/PersonalCommandFeed';
import { JhadinaShellNavigation } from '../src/components/JhadinaShellNavigation';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#07080b', color: '#fff', paddingBottom: 82 }}>
      <header style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, letterSpacing: '.02em' }}>Jhadina</div>
        <div style={{ fontSize: 12, opacity: .45 }}>Personal AI Operating System</div>
      </header>
      <PersonalCommandFeed />
      <JhadinaShellNavigation />
    </main>
  );
}
