"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { OpenStreetMapProvider, isPlaceCategorySlug, type PlaceCategorySlug, type RankedPlace } from "@jhadina/truckeros-core"
import { apiGet } from "@/lib/apiClient"
import { CategoryChips } from "@/components/CategoryChips"
import { PlaceCard } from "@/components/PlaceCard"

const mapProvider = new OpenStreetMapProvider()
const DEFAULT_RADIUS_METERS = 16093 // ~10mi

export default function FunFinderPage() {
  return (
    <Suspense fallback={<main className="page empty-state">Loading FunFinder…</main>}>
      <FunFinderScreen />
    </Suspense>
  )
}

function FunFinderScreen() {
  const searchParams = useSearchParams()
  const latitude = Number(searchParams.get("lat"))
  const longitude = Number(searchParams.get("lng"))
  const initialCategory = searchParams.get("category")
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude)

  const [category, setCategory] = useState<PlaceCategorySlug | "all">(
    initialCategory && isPlaceCategorySlug(initialCategory) ? initialCategory : "all"
  )
  const [requireTruckParking, setRequireTruckParking] = useState(false)
  const [results, setResults] = useState<RankedPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!hasCoords) return
    setLoading(true)
    setErrorMessage(null)

    const params = new URLSearchParams({
      lat: String(latitude),
      lng: String(longitude),
      category,
      radiusMeters: String(DEFAULT_RADIUS_METERS),
      requireTruckParking: String(requireTruckParking),
    })

    apiGet<{ results: RankedPlace[] }>(`/api/funfinder/search?${params}`)
      .then((data) => setResults(data.results))
      .catch((err) => setErrorMessage(err instanceof Error ? err.message : "Search failed"))
      .finally(() => setLoading(false))
  }, [hasCoords, latitude, longitude, category, requireTruckParking])

  if (!hasCoords) {
    return (
      <main className="page">
        <div className="empty-state">No location provided. Go back to Home and grant GPS permission first.</div>
      </main>
    )
  }

  const mapUrl = mapProvider.buildEmbedUrl({ latitude, longitude }, DEFAULT_RADIUS_METERS)

  return (
    <main className="page stack">
      <header className="page-header">
        <div>
          <a className="back-link" href="/">
            ← Home
          </a>
          <h1 className="h1">FunFinder</h1>
        </div>
        <span className="subtle mono">
          {latitude.toFixed(3)}, {longitude.toFixed(3)}
        </span>
      </header>

      <div className="map-frame">
        <iframe src={mapUrl} title="Nearby area map" loading="lazy" />
      </div>

      <CategoryChips active={category} onSelect={setCategory} />

      <label className="row card" style={{ cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={requireTruckParking}
          onChange={(e) => setRequireTruckParking(e.target.checked)}
        />
        <span style={{ fontSize: 13, fontWeight: 600 }}>🚛 Require truck parking</span>
      </label>

      {loading && <div className="empty-state">Searching nearby…</div>}
      {errorMessage && <div className="empty-state">{errorMessage}</div>}
      {!loading && !errorMessage && results.length === 0 && (
        <div className="empty-state">No results match these filters.</div>
      )}

      <div className="stack">
        {results.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            onInteracted={(eventType) => {
              // "Not interested" drops the card immediately instead of
              // waiting for the driver to re-run the search.
              if (eventType === "dismissed") {
                setResults((prev) => prev.filter((p) => p.id !== place.id))
              }
            }}
          />
        ))}
      </div>
    </main>
  )
}
