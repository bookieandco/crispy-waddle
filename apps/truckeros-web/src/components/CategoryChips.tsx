"use client"

import { PLACE_CATEGORIES, type PlaceCategorySlug } from "@jhadina/truckeros-core"

const LABELS: Record<PlaceCategorySlug, string> = {
  food: "Food",
  bbq: "BBQ",
  nightlife: "Nightlife",
  live_music: "Live Music",
  comedy: "Comedy",
  attractions: "Attractions",
  shopping: "Shopping",
  outdoors: "Outdoors",
  gyms: "Gyms",
  movie_theaters: "Movies",
  coffee: "Coffee",
  truck_stops: "Truck Stops",
  showers: "Showers",
  laundromats: "Laundromats",
}

interface CategoryChipsProps {
  active: PlaceCategorySlug | "all"
  onSelect: (category: PlaceCategorySlug | "all") => void
}

export function CategoryChips({ active, onSelect }: CategoryChipsProps) {
  return (
    <div className="chip-row">
      <button type="button" className={`chip ${active === "all" ? "chip-active" : ""}`} onClick={() => onSelect("all")}>
        All
      </button>
      {PLACE_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          className={`chip ${active === category ? "chip-active" : ""}`}
          onClick={() => onSelect(category)}
        >
          {LABELS[category]}
        </button>
      ))}
    </div>
  )
}
