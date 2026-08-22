import { NextRequest } from "next/server"
import { handlePostDispatcherFromProvider } from "@/lib/routes/dispatcherHandler"

export async function POST(req: NextRequest) {
  return handlePostDispatcherFromProvider(req)
}
