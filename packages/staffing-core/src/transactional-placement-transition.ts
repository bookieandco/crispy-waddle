import type { Application } from "./applications.js";
import type { CandidatePipelineRecord } from "./candidate-pipeline.js";
import type { Placement } from "./placements.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export interface PlacementTransitionInput {
  startDate: string;
  endDate?: string;
  payRate?: number;
  currency?: string;
  agencyId?: string;
}

export class TransactionalPlacementTransitionService {
  constructor(
    private readonly db: SqlExecutor,
    private readonly ids: { next(prefix: string): string },
    private readonly clock: { now(): string },
  ) {}

  async place(application: Application, input: PlacementTransitionInput): Promise<{ pipeline: CandidatePipelineRecord; placement: Placement }> {
    return this.db.transaction(async (tx) => {
      const applicationRows = await tx.query<Application & { employerId: string; payRate: number; currency: string }>(
        `select a.id, a.organization_id as "organizationId", a.job_id as "jobId", a.worker_id as "workerId",
                a.status, a.cover_note as "coverNote", a.created_at as "createdAt", a.updated_at as "updatedAt",
                j.employer_id as "employerId", j.pay_rate as "payRate", j.currency
         from staffing_applications a
         join staffing_marketplace_jobs j on j.id = a.job_id
         where a.id = $1 and a.organization_id = $2
         for update of a`,
        [application.id, application.organizationId],
      );
      const source = applicationRows[0];
      if (!source) throw new Error("Application not found");

      const existingPipeline = await tx.query<CandidatePipelineRecord>(
        `select application_id as "applicationId", organization_id as "organizationId", job_id as "jobId",
                worker_id as "workerId", stage, note, updated_at as "updatedAt"
         from staffing_candidate_pipeline where application_id = $1 and organization_id = $2 for update`,
        [application.id, application.organizationId],
      );
      const current = existingPipeline[0]?.stage ?? "NEW";
      if (current !== "OFFER") throw new Error(`Placement requires candidate stage OFFER; current stage is ${current}`);

      const existingPlacement = await tx.query<Placement>(
        `select id, organization_id as "organizationId", application_id as "applicationId", job_id as "jobId",
                worker_id as "workerId", employer_id as "employerId", agency_id as "agencyId", status,
                start_date as "startDate", end_date as "endDate", pay_rate as "payRate", currency,
                created_at as "createdAt", updated_at as "updatedAt"
         from staffing_placements where application_id = $1 for update`, [application.id]);
      if (existingPlacement[0]) throw new Error("A placement already exists for this application");

      const now = this.clock.now();
      const payRate = input.payRate ?? Number(source.payRate);
      const currency = (input.currency ?? source.currency).toUpperCase();
      if (!input.startDate) throw new Error("startDate is required");
      if (!Number.isFinite(payRate) || payRate <= 0) throw new Error("payRate must be greater than zero");
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a 3-letter code");

      const placement: Placement = {
        id: this.ids.next("placement"), organizationId: application.organizationId, applicationId: application.id,
        jobId: source.jobId, workerId: source.workerId, employerId: source.employerId, agencyId: input.agencyId,
        status: "PENDING", startDate: input.startDate, endDate: input.endDate, payRate, currency,
        createdAt: now, updatedAt: now,
      };
      const placementRows = await tx.query<Placement>(
        `insert into staffing_placements
         (id, organization_id, application_id, job_id, worker_id, employer_id, agency_id, status,
          start_date, end_date, pay_rate, currency, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         returning id, organization_id as "organizationId", application_id as "applicationId", job_id as "jobId",
                   worker_id as "workerId", employer_id as "employerId", agency_id as "agencyId", status,
                   start_date as "startDate", end_date as "endDate", pay_rate as "payRate", currency,
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [placement.id, placement.organizationId, placement.applicationId, placement.jobId, placement.workerId,
         placement.employerId, placement.agencyId ?? null, placement.status, placement.startDate, placement.endDate ?? null,
         placement.payRate, placement.currency, placement.createdAt, placement.updatedAt],
      );
      const savedPlacement = placementRows[0];
      if (!savedPlacement) throw new Error("Placement insert returned no row");

      const pipelineRows = await tx.query<CandidatePipelineRecord>(
        `update staffing_candidate_pipeline
         set stage = 'PLACEMENT', note = $2, updated_at = $3
         where application_id = $1 and organization_id = $4
         returning application_id as "applicationId", organization_id as "organizationId", job_id as "jobId",
                   worker_id as "workerId", stage, note, updated_at as "updatedAt"`,
        [application.id, "Placement created", now, application.organizationId],
      );
      const pipeline = pipelineRows[0] ?? {
        applicationId: application.id, organizationId: application.organizationId, jobId: source.jobId,
        workerId: source.workerId, stage: "PLACEMENT" as const, note: "Placement created", updatedAt: now,
      };

      await tx.query(
        `insert into staffing_event_outbox
         (id, event_type, aggregate_id, organization_id, occurred_at, payload, status, attempts, available_at)
         values ($1,'CANDIDATE_STAGE_CHANGED',$2,$3,$4,$5,'PENDING',0,$4),
                ($6,'PLACEMENT_CREATED',$7,$3,$4,$8,'PENDING',0,$4)`,
        [this.ids.next("event"), application.id, application.organizationId, now, JSON.stringify(pipeline),
         this.ids.next("event"), savedPlacement.id, JSON.stringify(savedPlacement)],
      );

      return { pipeline, placement: savedPlacement };
    });
  }
}
