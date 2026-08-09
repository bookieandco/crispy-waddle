'use client'

import { JhadinaTVQuickAction } from './JhadinaTVQuickAction'

const actions = [
  ['Memory', 'Review and manage what Jhadina remembers.'],
  ['Activity', 'See recent actions and system events.'],
  ['Approvals', 'Review decisions that need your approval.'],
  ['System Health', 'Check services and connected capabilities.'],
] as const

export function JhadinaCommandCenterShell() {
  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/35">JhadinaOS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Command Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Your mission control for memory, activity, approvals, system health, and entertainment.</p>
        </header>

        <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <JhadinaTVQuickAction />
          {actions.map(([title, description]) => (
            <button key={title} className="min-h-24 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/40">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-1 block text-xs leading-5 text-white/45">{description}</span>
            </button>
          ))}
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-white/30">Awareness</p>
            <h2 className="mt-2 text-xl font-semibold">What needs your attention?</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">Approvals, recent activity, and system status will appear here as their real data sources are connected.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-white/30">Trust</p>
            <h2 className="mt-2 text-xl font-semibold">Everything is auditable.</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">Jhadina keeps control, approvals, and activity visible instead of hiding important actions behind automation.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
