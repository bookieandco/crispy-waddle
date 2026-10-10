"use client"

import { useEffect, useState } from "react"
import type { Driver, Memory, Place, SavedPlace } from "@jhadina/truckeros-core"
import { apiGet } from "@/lib/apiClient"

type SavedPlaceWithPlace = SavedPlace & { place: Place | null }

export default function ProfilePage() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceWithPlace[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiGet<{ driver: Driver }>("/api/driver"),
      apiGet<{ savedPlaces: SavedPlaceWithPlace[] }>("/api/saved-places"),
      apiGet<{ memories: Memory[] }>("/api/memory"),
    ])
      .then(([driverData, savedData, memoryData]) => {
        setDriver(driverData.driver)
        setSavedPlaces(savedData.savedPlaces)
        setMemories(memoryData.memories)
      })
      .catch((err) => console.error("[Profile] failed to load", err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="page">
        <div className="empty-state">Loading profile…</div>
      </main>
    )
  }

  return (
    <main className="page stack">
      <header className="page-header">
        <div>
          <a className="back-link" href="/">
            ← Home
          </a>
          <h1 className="h1">Profile</h1>
        </div>
      </header>

      <section className="card stack">
        <div style={{ fontWeight: 700 }}>{driver?.name}</div>
        <div className="subtle">{driver?.truckType}</div>
        <div className="subtle">Home base: {driver?.homeBaseLocation ?? "Not set"}</div>
        <div className="subtle">
          Preferred radius: {driver ? (driver.preferredRadiusMeters / 1609.344).toFixed(0) : "—"} mi
        </div>
      </section>

      <section className="stack">
        <div className="subtle">🧠 Committed memories</div>
        {memories.length === 0 && <div className="empty-state">No approved memories yet.</div>}
        {memories.map((memory) => (
          <div key={memory.id} className="card row-between">
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {memory.compiledPreferenceRule.key}: <span className="mono">{memory.compiledPreferenceRule.value}</span>
              </div>
              <div className="subtle" style={{ fontSize: 11 }}>
                Applied {new Date(memory.appliedAt).toLocaleString()}
              </div>
            </div>
            <span className="badge badge-verified">Committed</span>
          </div>
        ))}
      </section>

      <section className="stack">
        <div className="subtle">💾 Saved places</div>
        {savedPlaces.length === 0 && <div className="empty-state">Nothing saved yet.</div>}
        {savedPlaces.map((saved) => (
          <div key={saved.id} className="card">
            <div style={{ fontWeight: 600, fontSize: 13 }}>{saved.place?.name ?? "Unknown place"}</div>
            <div className="subtle" style={{ fontSize: 12 }}>
              {saved.place?.address ?? "—"}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
