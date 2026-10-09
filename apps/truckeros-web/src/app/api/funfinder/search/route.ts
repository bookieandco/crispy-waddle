import { NextRequest } from "next/server"
import { handleFunFinderSearch } from "@/lib/routes/handlers"

export async function GET(req: NextRequest) {
  return handleFunFinderSearch(req)
}
