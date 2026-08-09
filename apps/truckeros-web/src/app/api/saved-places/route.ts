import { handleListSavedPlaces } from "@/lib/routes/handlers"

export async function GET() {
  return handleListSavedPlaces()
}
