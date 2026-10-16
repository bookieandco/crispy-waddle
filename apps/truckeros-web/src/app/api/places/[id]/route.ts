import { NextRequest } from "next/server"
import { handleGetPlace } from "@/lib/routes/handlers"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handleGetPlace(req, params.id)
}
