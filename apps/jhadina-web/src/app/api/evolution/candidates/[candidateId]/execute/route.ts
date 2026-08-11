import { NextResponse } from "next/server";
import type { EvolutionApprovalGrant } from "@jhadina/evolution-core/approval-execution-gate";
import type { EvolutionExecutionPlan } from "@jhadina/evolution-core/evolution-executor";
import { getEvolutionRepairRuntime } from "@/lib/evolution-runtime";

export async function POST(request: Request, context: { params: { candidateId: string } }) {
  try {
    const actor = request.headers.get("x-jhadina-actor");
    if (!actor) return NextResponse.json({ error: "Missing actor" }, { status: 401 });

    const body = (await request.json()) as {
      approval?: EvolutionApprovalGrant;
      plan?: EvolutionExecutionPlan;
    };

    if (!body.approval || !body.plan) {
      return NextResponse.json({ error: "Approval grant and execution plan are required" }, { status: 400 });
    }
    if (body.approval.candidateId !== context.params.candidateId) {
      return NextResponse.json({ error: "Candidate ID does not match approval" }, { status: 409 });
    }
    if (body.approval.approvedBy !== actor) {
      return NextResponse.json({ error: "Approval actor does not match authenticated actor" }, { status: 403 });
    }
    if (!body.plan.requiresApproval) {
      return NextResponse.json({ error: "Self-evolution execution plans must require approval" }, { status: 400 });
    }

    const repositoryPath = process.env.JHADINA_REPAIR_REPOSITORY;
    if (!repositoryPath) {
      return NextResponse.json({ error: "Jhadina repair repository is not configured" }, { status: 503 });
    }

    const branch = `jhadina/evolution/${context.params.candidateId}`;
    const result = await getEvolutionRepairRuntime().execute({
      approval: body.approval,
      plan: body.plan,
      repair: {
        workspace: { path: repositoryPath, branch },
      },
    });

    return NextResponse.json({
      approvalId: body.approval.approvalId,
      candidateId: context.params.candidateId,
      status: result.context.state,
      taskId: result.workflowResult.taskId,
      runId: result.workflowResult.runId,
      draftPr: result.workflowResult.draftPr?.url ?? null,
      changedFiles: result.workflowResult.changedFiles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evolution execution failed";
    const status = /expired|changed after approval|does not match|not approved|invalid/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
