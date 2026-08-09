import { NextRequest } from "next/server"
import { handleListAudit } from "@/lib/routes/handlers"

export async function GET(req: NextRequest) {
  return handleListAudit(req)
}
