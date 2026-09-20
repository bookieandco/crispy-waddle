"use client"

import { useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

type EvidenceRef = { id: string; source: string; observedAt: string; summary: string; immutable?: boolean }
type SpatialContext = {
  observations: EvidenceRef[]
  evidence: EvidenceRef[]
  claims: EvidenceRef[]
  reality: EvidenceRef[]
  attention: EvidenceRef[]
  conflicts: string[]
  uncertainty: string[]
  limitations: string[]
  provenance: EvidenceRef[]
}

const layerOptions = ["camera", "aircraft", "vessel", "fire"] as const

export default function SpatialWorkspacePage() {
  const [layers, setLayers] = useState<string[]>(["camera", "aircraft", "vessel", "fire"])
  const [lat, setLat] = useState("")
  const [lon, setLon] = useState("")
  const [radiusKm, setRadiusKm] = useState("50")
  const [context, setContext] = useState<SpatialContext | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [revisionId, setRevisionId] = useState("")

  function toggleLayer(layer: string) {
    setLayers((current) => current.includes(layer) ? current.filter((value) => value !== layer) : [...current, layer])
  }

  async function refresh() {
    setBusy(true)
    setError("")
    try {
      const userId = await getCurrentUserId()
      if (!userId) throw new Error("Not signed in")
      const latitude = Number(lat)
      const longitude = Number(lon)
      const radius = Number(radiusKm)
      const geographicScope = Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { lat: latitude, lon: longitude, ...(Number.isFinite(radius) && radius > 0 ? { radiusKm: radius } : {}) }
        : undefined
      const activeTask = layers.length ? `inspect ${layers.join(" ")} spatial context` : "inspect spatial context"
      const response = await fetch("/api/spatial/context", {
        method: "POST",
        headers: { "content-type": "application/json", "x-jhadina-user-id": userId },
        body: JSON.stringify({ activeTask, geographicScope, layers, workspaceId: "spatial-default" }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Spatial query failed")
      setContext(json.data?.context ?? null)
      setRevisionId(json.data?.workspaceRevision?.revisionId ?? "")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Spatial query failed")
      setContext(null)
      setRevisionId("")
    } finally {
      setBusy(false)
    }
  }

  const refs = context?.evidence ?? []
  return (
    <main style={{ minHeight: "100vh", padding: "28px 18px 120px", background: "linear-gradient(180deg,#0c1417,#111d1c 50%,#17221e)", color: "#eef5ef", fontFamily: 'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={eyebrow}>Jhadina · Spatial Intelligence</div>
        <h1 style={{ margin: "10px 0 8px", fontFamily: 'Georgia,"Times New Roman",serif', fontSize: "clamp(34px,7vw,60px)", fontWeight: 400, letterSpacing: "-.045em" }}>Spatial Workspace</h1>
        <p style={{ maxWidth: 720, color: "#aab9b1", lineHeight: 1.6 }}>
          Live public-world observations enter as evidence first. Source data, inferred claims and admitted reality stay visibly separate.
        </p>

        <section style={panel}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {layerOptions.map((layer) => {
              const active = layers.includes(layer)
              return <button key={layer} onClick={() => toggleLayer(layer)} style={{ ...chip, background: active ? "#d7f3df" : "#172723", color: active ? "#193027" : "#b7c5bd", borderColor: active ? "#d7f3df" : "#344a42" }}>{layer}</button>
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 16 }}>
            <input aria-label="Latitude" value={lat} onChange={(event) => setLat(event.target.value)} placeholder="Latitude (optional)" style={input} />
            <input aria-label="Longitude" value={lon} onChange={(event) => setLon(event.target.value)} placeholder="Longitude (optional)" style={input} />
            <input aria-label="Radius km" value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)} placeholder="Radius km" style={input} />
            <button onClick={refresh} disabled={busy || layers.length === 0} style={primary}>{busy ? "Reading sources…" : "Refresh context"}</button>
          </div>
          {error && <div role="alert" style={{ marginTop: 12, color: "#ffb8aa" }}>{error}</div>}
          {revisionId && <div style={{ marginTop: 10, fontSize: 11, color: "#7f968a" }}>Saved workspace revision · {revisionId.slice(0, 24)}…</div>}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginTop: 16 }}>
          <Metric label="Observations" value={context?.observations.length ?? 0} />
          <Metric label="Evidence" value={context?.evidence.length ?? 0} />
          <Metric label="Claims" value={context?.claims.length ?? 0} />
          <Metric label="Admitted reality" value={context?.reality.length ?? 0} />
        </section>

        <section style={{ ...panel, marginTop: 16 }}>
          <div style={eyebrow}>Evidence stream</div>
          {refs.length === 0 ? <p style={{ color: "#93a59c" }}>No evidence loaded yet.</p> : refs.slice(0, 100).map((ref) => (
            <article key={ref.id} style={{ padding: "12px 0", borderBottom: "1px solid #2a3a35" }}>
              <div style={{ fontSize: 13 }}>{ref.summary}</div>
              <div style={{ marginTop: 5, fontSize: 11, color: "#7f968a" }}>{ref.source} · {ref.observedAt}</div>
            </article>
          ))}
        </section>

        {(context?.limitations.length || context?.uncertainty.length || context?.conflicts.length) ? (
          <section style={{ ...panel, marginTop: 16 }}>
            <div style={eyebrow}>Limits & uncertainty</div>
            {[...(context?.conflicts ?? []), ...(context?.uncertainty ?? []), ...(context?.limitations ?? [])].map((item, index) => <p key={`${index}:${item}`} style={{ margin: "10px 0 0", color: "#b7c5bd", lineHeight: 1.5 }}>{item}</p>)}
          </section>
        ) : null}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={panel}><div style={eyebrow}>{label}</div><div style={{ fontSize: 30, marginTop: 8 }}>{value}</div></div>
}

const panel = { border: "1px solid #2d4039", borderRadius: 20, background: "rgba(17,31,27,.78)", padding: 18 }
const eyebrow = { fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase" as const, color: "#7fa08f" }
const chip = { border: "1px solid", borderRadius: 999, padding: "8px 13px", font: "inherit", cursor: "pointer" }
const input = { minWidth: 0, borderRadius: 12, border: "1px solid #344a42", background: "#0f1c18", color: "#eef5ef", padding: "11px 12px", font: "inherit" }
const primary = { border: 0, borderRadius: 12, background: "#d7f3df", color: "#193027", padding: "11px 14px", fontWeight: 700, cursor: "pointer" }
