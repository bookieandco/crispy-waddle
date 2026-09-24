export type ResolvedNamedPlaceScope = {
  lat: number
  lon: number
  radiusKm: number
  resolvedPlace: {
    canonicalName: string
    placeType: "airport"
    source: "OurAirports"
    sourceRef: string
    iata: string
    icao: string
    confidence: 1
  }
}

type AirportGazetteerEntry = {
  canonicalName: string
  iata: string
  icao: string
  lat: number
  lon: number
  sourceRef: string
}

/**
 * Deterministic airport-code fast path.
 *
 * OurAirports publishes its airport dataset in the Public Domain. This seed is
 * intentionally small and provenance-pinned; future expansion should be
 * generated from the current OurAirports CSV rather than hand-entering large
 * airport lists.
 *
 * Source: https://ourairports.com/airports/KLAX/
 */
const AIRPORT_GAZETTEER: readonly AirportGazetteerEntry[] = [
  {
    canonicalName: "Los Angeles International Airport",
    iata: "LAX",
    icao: "KLAX",
    lat: 33.942501,
    lon: -118.407997,
    sourceRef: "ourairports:KLAX",
  },
]

const milesToKm = (miles: number): number => miles * 1.609344

function explicitRadiusKm(text: string): number | null {
  const patterns = [
    /\\bwithin\\s+(\\d+(?:\\.\\d+)?)\\s*(km|kilometers?|kilometres?|mi|miles?)\\b/i,
    /\\b(\\d+(?:\\.\\d+)?)\\s*(km|kilometers?|kilometres?|mi|miles?)\\s+(?:of|around|from|near)\\b/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) continue
    const unit = match[2].toLowerCase()
    const km = unit === "mi" || unit.startsWith("mile") ? milesToKm(value) : value
    if (km < 0.5 || km > 250) return null
    return Number(km.toFixed(3))
  }
  return null
}

function defaultRadiusKm(text: string): number {
  if (/\\b(?:at|inside)\\s+(?:the\\s+)?(?:lax|klax|los angeles international airport)\\b/i.test(text)) return 5
  if (/\\b(?:near|around|nearby|within)\\b/i.test(text)) return 25
  return 25
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\\]\\\\]/g, "\\$&")
}

function matchesAirport(text: string, airport: AirportGazetteerEntry): boolean {
  const escapedName = escapeRegExp(airport.canonicalName)
  return new RegExp(`\\b(?:${airport.iata}|${airport.icao}|${escapedName})\\b`, "i").test(text)
}

/**
 * Resolves only unambiguous public named places currently present in the
 * deterministic gazetteer. It never guesses coordinates for unknown names.
 */
export function resolveNamedPlaceScope(text: string): ResolvedNamedPlaceScope | undefined {
  const input = text.trim()
  if (!input) return undefined

  const matches = AIRPORT_GAZETTEER.filter((airport) => matchesAirport(input, airport))
  if (matches.length !== 1) return undefined

  const airport = matches[0]
  const explicit = explicitRadiusKm(input)
  return {
    lat: airport.lat,
    lon: airport.lon,
    radiusKm: explicit ?? defaultRadiusKm(input),
    resolvedPlace: {
      canonicalName: airport.canonicalName,
      placeType: "airport",
      source: "OurAirports",
      sourceRef: airport.sourceRef,
      iata: airport.iata,
      icao: airport.icao,
      confidence: 1,
    },
  }
}
