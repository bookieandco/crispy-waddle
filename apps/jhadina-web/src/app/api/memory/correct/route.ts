import { NextRequest } from "next/server"
import { handleCorrectMemory } from "@/lib/routes/handlers"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  return handleCorrectMemory(req)
}
