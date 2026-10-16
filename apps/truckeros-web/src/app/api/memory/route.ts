import { handleListMemories } from "@/lib/routes/handlers"

export async function GET() {
  return handleListMemories()
}
