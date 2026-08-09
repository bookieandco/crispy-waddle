import { NextRequest } from "next/server"
import { handlePostLocation } from "@/lib/routes/handlers"

export async function POST(req: NextRequest) {
  return handlePostLocation(req)
}
