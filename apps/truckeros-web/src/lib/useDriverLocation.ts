"use client"

import { useEffect, useRef, useState } from "react"
import { BrowserLocationProvider, type GPSCoordinates } from "@jhadina/truckeros-core"

export type GpsStatus = "acquiring" | "live" | "denied" | "error"

const LOCATION_PING_INTERVAL_MS = 10000

/**
 * Client hook around ILocationProvider's concrete browser adapter. Requests
 * permission on mount, keeps a live watch running while the component is
 * mounted, and pings /api/location (throttled) so the driver's position and
 * every GPS fix are recorded server-side, not just held in component state.
 */
export function useDriverLocation() {
  const [coords, setCoords] = useState<GPSCoordinates | null>(null)
  const [status, setStatus] = useState<GpsStatus>("acquiring")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const lastPingRef = useRef(0)

  useEffect(() => {
    const provider = new BrowserLocationProvider()

    const handleUpdate = (next: GPSCoordinates) => {
      setCoords(next)
      setStatus("live")
      setErrorMessage(null)

      const now = Date.now()
      if (now - lastPingRef.current > LOCATION_PING_INTERVAL_MS) {
        lastPingRef.current = now
        void fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        }).catch(() => {
          // Best-effort telemetry; the UI already has the fix locally.
        })
      }
    }

    const handleError = (err: Error) => {
      setStatus(err.message.toLowerCase().includes("denied") ? "denied" : "error")
      setErrorMessage(err.message)
    }

    // watchPosition's first callback already delivers an initial fix (per
    // the Geolocation API spec), so calling getCurrentPosition separately
    // here would issue two concurrent location requests — and on some
    // browsers, prompt for permission twice — for the same first fix.
    const watchId = provider.watchLocation(handleUpdate, handleError)
    return () => provider.clearWatch(watchId)
  }, [])

  return { coords, status, errorMessage }
}
