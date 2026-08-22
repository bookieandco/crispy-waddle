import { NextRequest } from "next/server"
import { handlePostDispatcher } from "@/lib/routes/handlers"

export async function POST(req: NextRequest) {
  return handlePostDispatcher(req)
}
