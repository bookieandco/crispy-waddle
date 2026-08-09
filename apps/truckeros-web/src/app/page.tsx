"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { Driver, RankedPlace } from "@jhadina/truckeros-core"
import { useDriverLocation } from "@/lib/useDriverLocation"
import { apiGet } from "@/lib/apiClient"
import { GpsStatusPill } from "@/components/GpsStatusPill"
import { PlaceCard } from "@/components/PlaceCard"

const QUICK_FILTERS: { label: string; category: string }[] = [
  { label: "Food", category: "food" },
  { label: "Truck Stops", category: "truck_stops" },
  { label: "Showers", category: "showers" },
  { label: "Entertainment", category: "attractions" },
]

export default function DriverHomePage() {
  const { coords, status, errorMessage } = useDriverLocation()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [nearby, setNearby] = useState<RankedPlace[]>([])
  const [loadingNearby, setLoadingNearby] = useState(false)

  useEffect(() => {
    apiGet<{ driver: Driver }>("/api/driver")
      .then((data) => setDriver(data.driver))
      .catch((err) => console.error("[Home] failed to load driver", err))
  }, [])

  useEffect(() => {
    if (!coords) return
    setLoadingNearby(true)
    const params = new URLSearchParams({
      lat: String(coords.latitude),
      lng: String(coords.longitude),
      category: "all",
    })
    apiGet<{ results: RankedPlace[] }>(`/api/funfinder/search?${params}`)
      .then((data) => setNearby(data.results.slice(0, 5)))
      .catch((err) => console.error("[Home] failed to load nearby places", err))
      .finally(() => setLoadingNearby(false))
  }, [coords?.latitude, coords?.longitude])

  const query = coords ? `lat=${coords.latitude}&lng=${coords.longitude}` : ""

  return (
    <main className="page stack">
      <header className="page-header">
        <div>
          <div className="subtle">Good {timeOfDayGreeting()}</div>
          <h1 className="h1">{driver?.name ?? "Driver"}</h1>
        </div>
        <GpsStatusPill status={status} />
      </header>

      <section className="card stack">
        <div className="row-between">
          <span className="subtle">📍 Current location</span>
        </div>
        {coords ? (
          <div className="mono subtle">
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            {coords.accuracy != null && ` · ±${Math.round(coords.accuracy)}m`}
          </div>
        ) : (
          <div className="subtle">{errorMessage ?? "Requesting location permission…"}</div>
        )}
      </section>

      <Link href={coords ? `/funfinder?${query}` : "#"} aria-disabled={!coords}>
        <button className="btn btn-primary" disabled={!coords} style={{ width: "100%" }}>
          ⚡ Find Something Fun
        </button>
      </Link>

      <div className="grid-2">
        {QUICK_FILTERS.map((filter) => (
          <Link key={filter.category} href={coords ? `/funfinder?${query}&category=${filter.category}` : "#"}>
            <button className="btn" disabled={!coords} style={{ width: "100%", textAlign: "left" }}>
              {filter.label}
            </button>
          </Link>
        ))}
      </div>

      <section className="stack">
        <div className="subtle">Nearby</div>
        {loadingNearby && <div className="empty-state">Searching nearby…</div>}
        {!loadingNearby && nearby.length === 0 && coords && (
          <div className="empty-state">No results yet — try Find Something Fun.</div>
        )}
        {nearby.map((place) => (
          <PlaceCard key={place.id} place={place} compact />
        ))}
      </section>

      <nav className="row" style={{ justifyContent: "center", gap: 24, paddingTop: 8 }}>
        <Link className="back-link" href="/profile">
          Profile
        </Link>
        <Link className="back-link" href="/activity">
          Activity
        </Link>
      </nav>
    </main>
  )
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}
