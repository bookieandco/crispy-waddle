import { describe, expect, it } from "vitest"
import { resolveNamedPlaceScope } from "./named-place-resolver"

describe("named-place spatial resolver", () => {
  it.each([
    "What cameras are near LAX?",
    "What flights are around KLAX?",
    "Show traffic near Los Angeles International Airport",
  ])("resolves LAX aliases deterministically: %s", (input) => {
    const scope = resolveNamedPlaceScope(input)
    expect(scope).toMatchObject({
      lat: 33.942501,
      lon: -118.407997,
      radiusKm: 25,
      resolvedPlace: {
        canonicalName: "Los Angeles International Airport",
        source: "OurAirports",
        sourceRef: "ourairports:KLAX",
        iata: "LAX",
        icao: "KLAX",
        confidence: 1,
      },
    })
  })

  it("uses a tighter radius for at-LAX queries", () => {
    expect(resolveNamedPlaceScope("Show cameras at LAX")?.radiusKm).toBe(5)
  })

  it("honors an explicit distance in miles", () => {
    expect(resolveNamedPlaceScope("What flights are within 50 miles of LAX?")?.radiusKm).toBe(80.467)
  })

  it("honors an explicit distance in kilometers", () => {
    expect(resolveNamedPlaceScope("Show traffic within 12 km of KLAX")?.radiusKm).toBe(12)
  })

  it("fails closed on an oversized explicit radius", () => {
    expect(resolveNamedPlaceScope("Show cameras within 500 miles of LAX")).toBeUndefined()
  })

  it("does not match LAX inside an unrelated word", () => {
    expect(resolveNamedPlaceScope("Help me relax about this")).toBeUndefined()
  })

  it("fails closed for unresolved named places", () => {
    expect(resolveNamedPlaceScope("Show cameras near Springfield")).toBeUndefined()
  })
})
