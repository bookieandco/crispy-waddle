import { NextResponse } from "next/server"
import { checkLiveContextProductionHealth } from "@/lib/context/live-context-production-health"

export const dynamic="force-dynamic"

export async function GET(){
  const health=checkLiveContextProductionHealth()
  return NextResponse.json(health,{
    status:health.status==="READY"?200:503,
    headers:{"cache-control":"no-store"},
  })
}
