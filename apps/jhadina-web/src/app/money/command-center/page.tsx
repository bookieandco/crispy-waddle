"use client"

import { useEffect, useMemo, useState } from "react"
import type { MoneyAccount } from "@jhadina/money-core"
import { buildMoneyCommandCenterModel } from "@/lib/money/command-center-model"

type AccountsResponse =
  | { success: true; data: { accounts: MoneyAccount[]; verifiedUserId: string } }
  | { success: false; error: string }

export default function MoneyCommandCenter() {
  const [accounts, setAccounts] = useState<MoneyAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const model = useMemo(() => buildMoneyCommandCenterModel(accounts), [accounts])

  useEffect(() => {
    let active = true
    void fetch("/api/money/accounts", { method: "GET", credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as AccountsResponse
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Could not load accounts" : payload.error)
        }
        if (active) setAccounts(payload.data.accounts)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load accounts")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const available = model.availableCash === null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: model.currency ?? "USD" }).format(model.availableCash)

  return (
    <main style={shell}>
      <div style={wrap}>
        <div style={eyebrow}>Money Core</div>
        <h1 style={h1}>Financial Command Center</h1>
        <p style={sub}>A read-only view through Jhadina&apos;s governed Money boundary. This screen cannot move money.</p>

        <section style={hero}>
          <span>Available cash</span>
          <strong style={{fontSize:34}}>{loading ? "Loading…" : available}</strong>
          <small>{model.availableCash === null && !loading ? "A total appears only when governed account balances are complete and use one currency." : "From connected checking, savings and cash accounts."}</small>
        </section>

        {error && <div role="alert" style={alert}>Account data unavailable: {error}</div>}

        <section style={card}>
          <div style={sectionHead}><h2 style={h2}>Connected accounts</h2><span>{accounts.length}</span></div>
          {!loading && accounts.length === 0 && !error && <p style={muted}>No connected accounts were returned.</p>}
          {accounts.map((account) => {
            const balance = account.availableBalance ?? account.currentBalance
            return (
              <article key={account.id} style={row}>
                <div>
                  <strong>{account.maskedName ?? account.type}</strong>
                  <div style={muted}>{account.type} · {account.provider}</div>
                </div>
                <strong>{typeof balance === "number"
                  ? new Intl.NumberFormat("en-US", { style:"currency", currency:account.currency === "UNKNOWN" ? "USD" : account.currency }).format(balance)
                  : "Balance unavailable"}</strong>
              </article>
            )
          })}
        </section>

        <section style={card}>
          <div style={sectionHead}><h2 style={h2}>Needs attention</h2><span>{model.attention.length}</span></div>
          <p style={muted}>
            Bills, subscriptions and transaction-derived alerts stay unavailable until the separately governed
            <code> money.transaction.read </code> capability is implemented. Account-read permission is not reused as transaction permission.
          </p>
        </section>

        <section style={boundary}>
          <strong>Execution boundary</strong>
          <span>Payments, transfers, withdrawals and cancellations require separate governed capabilities and approval. This page exposes none of them.</span>
        </section>
      </div>
    </main>
  )
}

const shell={minHeight:"100vh",background:"linear-gradient(180deg,#f6f1e9,#edf2ed)",color:"#29332e",padding:"30px 18px 100px",fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif'}
const wrap={maxWidth:920,margin:"0 auto"}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"}
const h1={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(38px,9vw,62px)",letterSpacing:"-.045em",margin:"12px 0 8px"}
const h2={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:27,margin:0}
const sub={color:"#718078",lineHeight:1.6,maxWidth:680}
const hero={marginTop:25,padding:22,borderRadius:28,background:"#34443c",color:"#f8f6f1",display:"grid",gap:5}
const card={marginTop:14,padding:22,borderRadius:28,background:"rgba(255,255,255,.72)",border:"1px solid #dce2dd"}
const sectionHead={display:"flex",justifyContent:"space-between",alignItems:"center",color:"#657169"}
const row={display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",padding:"16px 0",borderBottom:"1px solid #e5e9e5"}
const muted={color:"#718078",fontSize:13,lineHeight:1.6}
const alert={marginTop:14,padding:14,borderRadius:16,background:"#f3e4e1",color:"#743b36"}
const boundary={marginTop:14,padding:18,borderRadius:22,border:"1px solid #dce2dd",display:"grid",gap:6,color:"#56665d",fontSize:13}
