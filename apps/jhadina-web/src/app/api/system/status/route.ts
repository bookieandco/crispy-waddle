import { NextResponse } from "next/server"

const modules = [
  { id: "janet", name: "JANET", role: "Memory & identity", state: "online" },
  { id: "delia", name: "DELIA", role: "Strategy & intelligence", state: "online" },
  { id: "marisa", name: "MARISA", role: "Production & execution", state: "online" },
  { id: "safeguard", name: "Safeguard", role: "Policy & security", state: "online" },
  { id: "jei", name: "JEI", role: "Entertainment intelligence", state: "building" },
  { id: "music", name: "Music Core", role: "Music & playback", state: "connected" },
  { id: "opportunity", name: "Opportunity", role: "Opportunity intelligence", state: "connected" },
  { id: "social", name: "Social", role: "Authorized publishing", state: "connected" },
  { id: "money", name: "Money Core", role: "Financial intelligence", state: "building" },
] as const

export async function GET() {
  const online = modules.filter((module) => module.state === "online").length
  const connected = modules.filter((module) => module.state === "connected").length
  const building = modules.filter((module) => module.state === "building").length

  return NextResponse.json({
    ok: true,
    system: "jhadina",
    version: "integration-spine",
    timestamp: new Date().toISOString(),
    summary: { total: modules.length, online, connected, building },
    modules,
    flow: [
      "user",
      "janet-memory",
      "delia-strategy",
      "marisa-execution",
      "safeguard-policy",
      "creative-context",
      "action-connector",
      "audit-trail",
    ],
  })
}
