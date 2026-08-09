"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { buildNavigationHandoffLinks, type Place } from "@jhadina/truckeros-core"
import { apiGet, apiPost } from "@/lib/apiClient"
import { TruckAttributeBadges } from "@/components/TruckAttributeBadges"

export default function PlaceDetailPage() {
  const params = useParams<{ id: string }>()
  const placeId = params.id

  const [place, setPlace] = useState<Place | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    apiGet<{ place: Place }>(`/api/places/${placeId}`)
      .then((data) => {
        setPlace(data.place)
        // Viewing the detail page is itself an interaction worth recording.
        return apiPost("/api/interactions", { placeId, eventType: "viewed" })
      })
      .catch((err) => setErrorMessage(err instanceof Error ? err.message : "Failed to load place"))
  }, [placeId])

  async function record(eventType: "navigated" | "saved" | "dismissed") {
    try {
      await apiPost("/api/interactions", { placeId, eventType })
      setStatusMessage(
        eventType === "saved" ? "Saved to your profile." : eventType === "dismissed" ? "Marked not interested." : "Handed off to navigation."
      )
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to record action")
    }
  }

  async function submitNote() {
    if (!note.trim()) return
    try {
      await apiPost("/api/interactions", { placeId, eventType: "viewed", notes: note.trim() })
      setStatusMessage("Note added.")
      setNote("")
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to add note")
    }
  }

  if (errorMessage) {
    return (
      <main className="page">
        <div className="empty-state">{errorMessage}</div>
      </main>
    )
  }

  if (!place) {
    return (
      <main className="page">
        <div className="empty-state">Loading place…</div>
      </main>
    )
  }

  const nav = buildNavigationHandoffLinks({ latitude: place.latitude, longitude: place.longitude }, place.name)

  return (
    <main className="page stack">
      <header className="page-header">
        <div>
          <a className="back-link" href="/funfinder">
            ← Back
          </a>
          <h1 className="h1">{place.name}</h1>
        </div>
        {place.rating != null && <span className="badge">★ {place.rating.toFixed(1)}</span>}
      </header>

      <section className="card stack">
        <div className="subtle">{place.category.replace(/_/g, " ")}</div>
        {place.address && <div>{place.address}</div>}
        {place.phone && <div className="subtle">{place.phone}</div>}
        <span className={`badge ${place.isOpenNow === true ? "badge-open" : place.isOpenNow === false ? "badge-closed" : "badge-unknown"}`}>
          {place.isOpenNow === true ? "Open now" : place.isOpenNow === false ? "Closed" : "Hours unknown"}
        </span>
        <div className="subtle mono" style={{ fontSize: 11 }}>
          Source: {place.providerName}
        </div>
      </section>

      <section className="stack">
        <div className="subtle">Truck attributes</div>
        <TruckAttributeBadges attributes={place.truckAttributes} />
      </section>

      <div className="btn-row">
        <a className="btn btn-primary" href={nav.geo} onClick={() => record("navigated")}>
          Navigate
        </a>
        <button className="btn" type="button" onClick={() => record("saved")}>
          Save
        </button>
        <button className="btn" type="button" onClick={() => record("dismissed")}>
          Not interested
        </button>
      </div>

      <div className="btn-row">
        <a className="btn" href={nav.googleMaps} target="_blank" rel="noreferrer">
          Open in Google Maps
        </a>
        <a className="btn" href={nav.appleMaps} target="_blank" rel="noreferrer">
          Open in Apple Maps
        </a>
      </div>

      <section className="card stack">
        <div className="subtle">Add note</div>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. good overnight parking, quiet lot" />
        <button className="btn" type="button" onClick={submitNote} disabled={!note.trim()}>
          Save note
        </button>
      </section>

      {statusMessage && <div className="subtle">{statusMessage}</div>}
    </main>
  )
}
