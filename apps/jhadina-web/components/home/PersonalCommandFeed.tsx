import React from 'react';

type Module = {
  kind: 'janet' | 'delia' | 'marisa' | 'safeguard' | 'music' | 'jei' | 'opportunity' | 'social' | 'money';
  label: string;
  title: string;
  body: string;
  state: 'online' | 'building' | 'connected';
};

const modules: Module[] = [
  { kind: 'janet', label: 'JANET', title: 'Memory & identity', body: 'Memory, personalization, taste, approvals, and context.', state: 'online' },
  { kind: 'delia', label: 'DELIA', title: 'Strategy & intelligence', body: 'Analysis, prioritization, research, and opportunity reasoning.', state: 'online' },
  { kind: 'marisa', label: 'MARISA', title: 'Production & execution', body: 'Creative production, automation, and action workflows.', state: 'online' },
  { kind: 'safeguard', label: 'SAFEGUARD', title: 'Security & policy', body: 'Permissions, enforcement boundaries, auditability, and safe actions.', state: 'online' },
  { kind: 'jei', label: 'JEI', title: 'Entertainment intelligence', body: 'Studies music, YouTube, film, and Jhadina\'s own creative work.', state: 'building' },
  { kind: 'music', label: 'MUSIC', title: 'Music Core', body: 'Playback, library, creative music workflows, and restoration.', state: 'connected' },
  { kind: 'opportunity', label: 'OPPORTUNITY', title: 'Opportunity Command Center', body: 'Leads, research, qualification, and recovery opportunities.', state: 'connected' },
  { kind: 'social', label: 'SOCIAL', title: 'Social Core', body: 'Authorized social connections and publishing workflows.', state: 'connected' },
  { kind: 'money', label: 'MONEY', title: 'Money Core', body: 'Financial intelligence, allocation, reserves, and cash-flow visibility.', state: 'building' },
];

const glyph: Record<Module['kind'], string> = {
  janet: 'J', delia: 'D', marisa: 'M', safeguard: 'S', music: '♪', jei: '✦', opportunity: '$', social: '◎', money: '₿',
};

const stateLabel: Record<Module['state'], string> = { online: 'ONLINE', connected: 'CONNECTED', building: 'BUILDING' };

export function PersonalCommandFeed() {
  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '54px 24px 100px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .6fr', gap: 18, marginBottom: 22 }}>
        <div style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 28, padding: 30, background: 'linear-gradient(145deg, rgba(255,255,255,.065), rgba(255,255,255,.025))' }}>
          <div style={{ fontSize: 11, letterSpacing: '.28em', textTransform: 'uppercase', opacity: .42 }}>Mission Control</div>
          <h1 style={{ fontSize: 48, lineHeight: 1.02, margin: '12px 0 12px' }}>Everything Jhadina can do, connected.</h1>
          <p style={{ maxWidth: 680, margin: 0, lineHeight: 1.65, opacity: .56 }}>One command center for memory, strategy, production, security, music, entertainment intelligence, opportunities, social, and money.</p>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 28, padding: 24, background: 'rgba(255,255,255,.035)' }}>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', opacity: .42 }}>System</div>
          <div style={{ fontSize: 34, fontWeight: 750, marginTop: 12 }}>7 / 9</div>
          <div style={{ opacity: .5, marginTop: 4 }}>modules online or connected</div>
          <div style={{ marginTop: 22, height: 8, borderRadius: 99, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><div style={{ width: '78%', height: '100%', background: '#65d68a' }} /></div>
          <div style={{ marginTop: 14, fontSize: 12, opacity: .4 }}>2 modules actively building</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        {modules.map((item) => (
          <article key={item.kind} style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 22, padding: 20, background: 'rgba(255,255,255,.035)', minHeight: 190 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', fontSize: 17 }}>{glyph[item.kind]}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.18em', opacity: .45 }}>{item.label}</div>
              </div>
              <div style={{ fontSize: 9, letterSpacing: '.12em', opacity: item.state === 'building' ? .55 : .35 }}>{stateLabel[item.state]}</div>
            </div>
            <h2 style={{ fontSize: 20, margin: '18px 0 8px' }}>{item.title}</h2>
            <p style={{ margin: 0, lineHeight: 1.55, opacity: .5, fontSize: 14 }}>{item.body}</p>
          </article>
        ))}
      </div>

      <div style={{ marginTop: 18, border: '1px solid rgba(255,255,255,.09)', borderRadius: 22, padding: 22, background: 'rgba(255,255,255,.025)' }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', opacity: .42 }}>Unified flow</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {['You', 'JANET Memory', 'DELIA Strategy', 'MARISA Execution', 'Safeguard', 'JEI Creative Context', 'Action / Connector', 'Audit Trail'].map((step, index) => (
            <React.Fragment key={step}>
              <span style={{ padding: '9px 12px', borderRadius: 12, background: 'rgba(255,255,255,.055)', fontSize: 12 }}>{step}</span>
              {index < 7 && <span style={{ opacity: .25, alignSelf: 'center' }}>→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
