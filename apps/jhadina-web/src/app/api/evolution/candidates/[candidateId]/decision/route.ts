import { NextResponse } from "next/server";
import { SupabaseEvolutionCandidateRepository } from "@jhadina/evolution-core/supabase-evolution-candidate-repository";

type Decision = "APPROVED" | "REJECTED" | "DEFERRED";

function repository() {
  const url = process.env.JHADINA_SUPABASE_URL;
  const key = process.env.JHADINA_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Jhadina evolution persistence is not configured");
  return new SupabaseEvolutionCandidateRepository({ url, key });
}

export async function POST(request: Request, context: { params: { candidateId: string } }) {
  try {
    const actor = request.headers.get("x-jhadina-actor");
    if (!actor) return NextResponse.json({ error: "Missing actor" }, { status: 401 });
    const body = (await request.json()) as { decision?: Decision; reason?: string };
    if (!body.decision || !["APPROVED", "REJECTED", "DEFERRED"].includes(body.decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }
    const candidate = await repository().decide(context.params.candidateId, body.decision, actor, body.reason);
    return NextResponse.json({ candidate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record decision";
    return NextResponse.json({ error: message }, { status: message.includes("already") ? 409 : 500 });
  }
}
