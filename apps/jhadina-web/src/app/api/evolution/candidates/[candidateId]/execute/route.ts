import { NextResponse } from "next/server";
import { executionPlanHash, type EvolutionApprovalGrant } from "@jhadina/evolution-core/approval-execution-gate";
import type { EvolutionExecutionPlan } from "@jhadina/evolution-core/evolution-executor";
import { SupabaseEvolutionCandidateRepository } from "@jhadina/evolution-core/supabase-evolution-candidate-repository";
import { ensureEvolutionRepairRuntime } from "../../../../../lib/evolution-runtime-bootstrap";
import { getEvolutionRepairRuntime } from "../../../../../lib/evolution-runtime";

function repository() {
  const url = process.env.JHADINA_SUPABASE_URL;
  const key = process.env.JHADINA_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Jhadina evolution persistence is not configured");
  return new SupabaseEvolutionCandidateRepository({ url, key });
}

function buildPlan(candidate: Awaited<ReturnType<ReturnType<typeof repository>["get"]>>): EvolutionExecutionPlan {
  if (!candidate) throw new Error("Evolution candidate not found");
  return {
    id: candidate.candidateId,
    title: candidate.title,
    risk: candidate.risk.toLowerCase() as EvolutionExecutionPlan["risk"],
    requiresApproval: true,
    allowedPaths: candidate.affectedPaths,
    testCommands: candidate.verificationPlan,
    securityChecks: ["protected-paths", ...candidate.verificationPlan],
  };
}

export async function POST(request: Request, context: { params: { candidateId: string } }) {
  try {
    const actor = request.headers.get("x-jhadina-actor");
    if (!actor) return NextResponse.json({ error: "Missing actor" }, { status: 401 });

    ensureEvolutionRepairRuntime();
    const candidate = await repository().get(context.params.candidateId);
    if (!candidate) return NextResponse.json({ error: "Evolution candidate not found" }, { status: 404 });

    const body = (await request.json()) as { approval?: EvolutionApprovalGrant };
    const approval = body.approval;
    if (!approval) return NextResponse.json({ error: "Missing approval grant" }, { status: 400 });
    if (approval.approvedBy !== actor) return NextResponse.json({ error: "Approval actor mismatch" }, { status: 403 });
    if (approval.candidateId !== candidate.candidateId) return NextResponse.json({ error: "Approval candidate mismatch" }, { status: 400 });

    const plan = buildPlan(candidate);
    if (approval.executionPlanHash !== executionPlanHash(plan)) {
      return NextResponse.json({ error: "Execution plan hash mismatch" }, { status: 409 });
    }

    const result = await getEvolutionRepairRuntime().execute({
      approval,
      plan,
      repair: {
        workspace: {
          path: process.env.JHADINA_GITHUB_REPOSITORY ?? "bookieandco/crispy-waddle",
          branch: process.env.JHADINA_EVOLUTION_BASE_BRANCH ?? "agent/jhadina-integration-spine",
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evolution execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
