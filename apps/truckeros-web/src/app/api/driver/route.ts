import { handleGetDriver } from "@/lib/routes/handlers"

export async function GET() {
  return handleGetDriver()
}
