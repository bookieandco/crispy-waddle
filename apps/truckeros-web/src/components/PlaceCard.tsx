"use client"

import Link from "next/link"
import { buildNavigationHandoffLinks, resolveTruckAttribute, type RankedPlace } from "@jhadina/truckeros-core"
import { apiPost } from "@/lib/apiClient"

interface PlaceCardProps {
  place: RankedPlace
  /** Compact rendering (Driver Home) hides the action row. */
  compact?: boolean
  onInteracted?: (eventType: "navigated" | "saved" | "dismissed") => void
}

export function PlaceCard({ place, compact, onInteracted }: PlaceCardProps) {
  const miles = (place.distanceMeters / 1609.344).toFixed(1)
  const parking = resolveTruckAttribute(place.truckAttributes, "large_vehicle_parking")
  const accessible = resolveTruckAttribute(place.truckAttributes, "truck_accessible")
  const hasParkingSignal = parking.value === true || accessible.value === true
  const parkingVerified = parking.source === "provider_verified" || accessible.source === "provider_verified"
  const nav = buildNavigationHandoffLinks({ latitude: place.latitude, longitude: place.longitude }, place.name)

  async function record(eventType: "navigated" | "saved" | "dismissed") {
    try {
      await apiPost("/api/interactions", { placeId: place.id, eventType })
      onInteracted?.(eventType)
    } catch (err) {
      console.error("[PlaceCard] failed to record interaction", err)
    }
  }

  return (
    <div className="card stack">
      <div className="row-between">
        <div>
          <div style={{ fontWeight: 700 }}>{place.name}</div>
          <div className="subtle">
            {place.category.replace(/_/g, " ")} · {miles} mi · ~{place.etaMinutes} min drive
          </div>
        </div>
        {place.rating != null && <span className="badge">★ {place.rating.toFixed(1)}</span>}
      </div>

      <div className="chip-row">
        <span
          className={`badge ${
            place.isOpenNow === true ? "badge-open" : place.isOpenNow === false ? "badge-closed" : "badge-unknown"
          }`}
        >
          {place.isOpenNow === true ? "Open now" : place.isOpenNow === false ? "Closed" : "Hours unknown"}
        </span>
        <span className={`badge ${hasParkingSignal ? (parkingVerified ? "badge-verified" : "badge-inferred") : "badge-unknown"}`}>
          {hasParkingSignal ? `Truck parking (${parkingVerified ? "verified" : "inferred"})` : "Parking unknown"}
        </span>
      </div>

      {!compact && (
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
      )}

      <Link className="back-link" href={`/place/${place.id}`}>
        View details →
      </Link>
    </div>
  )
}
