import { handleHealth } from "@/lib/routes/handlers"

export async function GET() {
  return handleHealth()
}
