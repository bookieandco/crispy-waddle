import type { PlacementCommandApi, PlacementCommandContext } from "./command-api.js";
import type { Assignment, CareerPassportSnapshot, JobOrder, MatchDecision, Placement, Referral } from "./domain.js";

export interface HttpRequest {
  method: string;
  path: string;
  requestId: string;
  actor: PlacementCommandContext["actor"];
  body: unknown;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

export async function handlePlacementCommand(api: PlacementCommandApi, request: HttpRequest): Promise<HttpResponse> {
  const ctx = { actor: request.actor, requestId: request.requestId };

  try {
    switch (`${request.method} ${request.path}`) {
      case "POST /jobs":
        return { status: 201, body: await api.createJob(ctx, request.body as JobOrder) };
      case "POST /referrals":
        return { status: 201, body: await api.createReferral(ctx, request.body as {
          job: JobOrder;
          worker: CareerPassportSnapshot;
          agencyId: string;
          match: MatchDecision;
          consentId: string;
        }) };
      case "POST /placements":
        return { status: 201, body: await api.acceptAndPlace(ctx, request.body as {
          referral: Referral;
          job: JobOrder;
          worker: CareerPassportSnapshot;
          agreedPayRate: number;
          startsAt: string;
        }) };
      case "POST /assignments":
        return { status: 201, body: await api.createAssignment(ctx, request.body as {
          placement: Placement;
          schedule: string;
          supervisorId?: string;
        }) };
      case "POST /timesheets":
        return { status: 201, body: await api.submitTimesheet(ctx, request.body as {
          assignment: Assignment;
          workerId: string;
          periodStart: string;
          periodEnd: string;
          hours: number;
        }) };
      default:
        return { status: 404, body: { error: "NOT_FOUND", requestId: request.requestId } };
    }
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return { status: 403, body: { error: "FORBIDDEN", requestId: request.requestId } };
    }
    return { status: 400, body: { error: "COMMAND_REJECTED", requestId: request.requestId } };
  }
}
