import { NextRequest } from "next/server"
import { handleForgetMemory } from "@/lib/routes/handlers"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  return handleForgetMemory(req)
}
