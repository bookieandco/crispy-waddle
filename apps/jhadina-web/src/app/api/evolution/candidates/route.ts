import { NextResponse } from "next/server";
import { SupabaseEvolutionCandidateRepository } from "@jhadina/evolution-core/supabase-evolution-candidate-repository";

function repository() {
  const url = process.env.JHADINA_SUPABASE_URL;
  const key = process.env.JHADINA_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Jhadina evolution persistence is not configured");
  return new SupabaseEvolutionCandidateRepository({ url, key });
}

export async function GET(request: Request) {
  try {
    const actor = request.headers.get("x-jhadina-actor");
    if (!actor) return NextResponse.json({ error: "Missing actor" }, { status: 401 });
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const candidates = await repository().listPending(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ candidates });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load candidates" }, { status: 500 });
  }
}
