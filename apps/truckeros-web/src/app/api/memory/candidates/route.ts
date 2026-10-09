import { handleListMemoryCandidates } from "@/lib/routes/handlers"

export async function GET() {
  return handleListMemoryCandidates()
}
