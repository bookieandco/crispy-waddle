import Link from 'next/link'
import {readBizPurseReadiness} from '@/lib/opportunities/biz-purse-readiness-runtime'

export const dynamic='force-dynamic'
export const revalidate=0

export default async function BizPurseReadinessPage(){
 let state:Awaited<ReturnType<typeof readBizPurseReadiness>>|null=null
 let blockedReason='Authentication or private database connection required'
 try {state=await readBizPurseReadiness()} catch {}
 return <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
  <header className="space-y-2">
   <h1 className="text-2xl font-semibold">Jhadina Business + Purse Readiness</h1>
   <p className="text-sm opacity-75">Live, read-only infrastructure observations. This page cannot collect payments, authorize transactions, trade or launch workers.</p>
  </header>
  <section className="rounded-xl border p-4 space-y-3">
   <h2 className="text-lg font-semibold">SWLC commercial persistence</h2>
   {!state ? <p role="status" className="text-sm">{blockedReason}</p> : <>
    <p role="status" className="text-sm font-medium">{state.schemaStatus==='BLOCKED'?'Blocked: missing or inaccessible commercial schema':'Schema present: security and backup certification still required'}</p>
    <p className="text-xs opacity-70">Checked: {state.observedAt}</p>
    <ul className="space-y-2 text-sm">
     {state.commercialTables.map(table=><li key={table.name} className="flex items-start justify-between gap-3 border-b py-2">
      <code className="min-w-0 break-all text-xs">{table.name}</code>
      <span className="shrink-0 font-medium">{table.status==='PRESENT'?'Present':'Audit/repair'}</span>
     </li>)}
    </ul>
   </>}
  </section>
  <section className="rounded-xl border p-4 space-y-2">
   <h2 className="text-lg font-semibold">Financial authority</h2>
   <p className="text-sm">Real customer payments, funds transfers, owner payouts, live stock or memecoin orders, and prediction-market execution remain disabled. Paper research does not authorize live custody.</p>
   <p className="text-sm">No green badge here should be interpreted as commissioning. Every live provider requires separate owner approval and reconciled evidence.</p>
  </section>
  <div className="flex flex-wrap gap-4 text-sm underline">
   <Link href="/money/funding">Money funding control</Link>
   <Link href="/opportunity">Opportunity Core</Link>
   <a href="https://github.com/bookieandco/crispy-waddle/issues/1276" rel="noreferrer">Supabase audit/repair issue</a>
  </div>
 </main>
}
