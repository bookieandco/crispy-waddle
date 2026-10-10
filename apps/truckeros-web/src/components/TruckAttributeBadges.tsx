import { resolveTruckAttribute, type TruckAttributeKey, type TruckAttributes } from "@jhadina/truckeros-core"

const LABELS: Record<TruckAttributeKey, string> = {
  truck_accessible: "Truck accessible",
  large_vehicle_parking: "Truck parking",
  overnight_parking: "Overnight parking",
  showers: "Showers",
  food: "Food",
  fuel: "Fuel",
  restrooms: "Restrooms",
  "24_hours": "24 hours",
}

const SOURCE_CLASS: Record<string, string> = {
  provider_verified: "badge-verified",
  user_reported: "badge-user-reported",
  inferred: "badge-inferred",
  unknown: "badge-unknown",
}

const SOURCE_LABEL: Record<string, string> = {
  provider_verified: "verified",
  user_reported: "driver-reported",
  inferred: "inferred",
  unknown: "unknown",
}

/**
 * Renders every truck attribute with its resolved value AND which trust
 * tier it came from — never presents an inferred guess the same way as a
 * provider-confirmed fact.
 */
export function TruckAttributeBadges({ attributes }: { attributes: TruckAttributes }) {
  const keys = Object.keys(LABELS) as TruckAttributeKey[]

  return (
    <div className="chip-row" style={{ flexWrap: "wrap" }}>
      {keys.map((key) => {
        const resolved = resolveTruckAttribute(attributes, key)
        if (resolved.value === null) return null
        return (
          <span key={key} className={`badge ${SOURCE_CLASS[resolved.source]}`} title={`Source: ${resolved.source}`}>
            {resolved.value ? "✓" : "✕"} {LABELS[key]} · {SOURCE_LABEL[resolved.source]}
          </span>
        )
      })}
      {keys.every((key) => resolveTruckAttribute(attributes, key).value === null) && (
        <span className="badge badge-unknown">No truck attributes reported yet</span>
      )}
    </div>
  )
}
