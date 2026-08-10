"use client"

import React, { useEffect, useState } from "react"

type Module = {
  id: string
  name: string
  role: string
  state: "online" | "connected" | "building"
}

type StatusResponse = {
  ok: boolean
  summary: { total: number; online: number; connected: number; building: number }
  modules: Module[]
}

const fallbackModules: Module[] = [
  { id: "janet", name: "JANET", role: "Memory & identity", state: "online" },
  { id: "delia", name: "DELIA", role: "Strategy & intelligence", state: "online" },
  { id: "marisa", name: "MARISA", role: "Production & execution", state: "online" },
  { id: "safeguard", name: "Safeguard", role: "Policy & security", state: "online" },
  { id: "jei", name: "JEI", role: "Entertainment intelligence", state: "building" },
  { id: "music", name: "Music Core", role: "Music & playback", state: "connected" },
  { id: "opportunity", name: "Opportunity", role: "Opportunity intelligence", state: "connected" },
  { id: "social", name: "Social", role: "Authorized publishing", state: "connected" },
  { id: "money", name: "Money Core", role: "Financial intelligence", state: "building" },
]

const glyph: Record<string, string> = {
  janet: "J", delia: "D", marisa: "M", safeguard: "S", jei: "✦", music: "♪", opportunity: "$", social: "◎", money: "₿",
}

const stateLabel = { online: "ONLINE", connected: "CONNECTED", building: "BUILDING" } as const

export function PersonalCommandFeed() {
  const [modules, setModules] = useState<Module[]>(fallbackModules)
  const [summary, setSummary] = useState({ total: 9, online: 4, connected: 3, building: 2 })
  const [live, setLive] = useState(false)

  useEffect(() => {
    fetch("/api/system/status")
      .then((response) => response.json() as Promise<StatusResponse>)
      .then((data) => {
        if (data.ok) {
          setModules(data.modules)
          setSummary(data.summary)
          setLive(true)
        }
      })
      .catch(() => setLive(false))
  }, [])

  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "54px 24px 100px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr .6fr", gap: 18, marginBottom: 22 }}>
        <div style={{ border: "1px solid rgba(255,255,255,.09)", borderRadius: 28, padding: 30, background: "linear-gradient(145deg, rgba(255,255,255,.065), rgba(255,255,255,.025))" }}>
          <div style={{ fontSize: 11, letterSpacing: ".28em", textTransform: "uppercase", opacity: .42 }}>Mission Control</div>
          <h1 style={{ fontSize: 48, lineHeight: 1.02, margin: "12px 0" }}>Everything Jhadina can do, connected.</h1>
          <p style={{ maxWidth: 700, margin: 0, lineHeight: 1.65, opacity: .56 }}>One control surface for memory, strategy, production, security, entertainment, music, opportunities, social, and money.</p>
        </div>
        <div style={{ border: "1px solid rgba(255,255,255,.09)", borderRadius: 28, padding: 24, background: "rgba(255,255,255,.035)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", opacity: .42 }}>
            <span>System</span><span>{live ? "LIVE" : "PREVIEW"}</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 750, marginTop: 12 }}>{summary.online + summary.connected} / {summary.total}</div>
          <div style={{ opacity: .5, marginTop: 4 }}>modules online or connected</div>
          <div style={{ marginTop: 22, height: 8, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}><div style={{ width: `${((summary.online + summary.connected) / summary.total) * 100}%`, height: "100%", background: "#65d68a" }} /></div>
          <div style={{ marginTop: 14, fontSize: 12, opacity: .4 }}>{summary.building} modules actively building</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        {modules.map((item) => (
          <article key={item.id} style={{ border: "1px solid rgba(255,255,255,.09)", borderRadius: 22, padding: 20, background: "rgba(255,255,255,.035)", minHeight: 175 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(255,255,255,.08)", fontSize: 17 }}>{glyph[item.id]}</div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", opacity: .45 }}>{item.name}</div>
              </div>
              <div style={{ fontSize: 9, letterSpacing: ".12em", opacity: item.state === "building" ? .55 : .35 }}>{stateLabel[item.state]}</div>
            </div>
            <h2 style={{ fontSize: 20, margin: "18px 0 8px" }}>{item.role}</h2>
            <p style={{ margin: 0, lineHeight: 1.55, opacity: .5, fontSize: 14 }}>Connected through the Jhadina integration spine.</p>
            {item.id === "music" && <a href="/music" style={{ display: "inline-block", marginTop: 16, color: "inherit", opacity: .7, fontSize: 12 }}>Open Music →</a>}
          </article>
        ))}
      </div>

      <div style={{ marginTop: 18, border: "1px solid rgba(255,255,255,.09)", borderRadius: 22, padding: 22, background: "rgba(255,255,255,.025)" }}>
        <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", opacity: .42 }}>Unified flow</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {["You", "JANET Memory", "DELIA Strategy", "MARISA Execution", "Safeguard", "JEI Creative Context", "Action / Connector", "Audit Trail"].map((step, index) => (
            <React.Fragment key={step}>
              <span style={{ padding: "9px 12px", borderRadius: 12, background: "rgba(255,255,255,.055)", fontSize: 12 }}>{step}</span>
              {index < 7 && <span style={{ opacity: .25, alignSelf: "center" }}>→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
