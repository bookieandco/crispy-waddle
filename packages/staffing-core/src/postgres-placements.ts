import type { Placement, PlacementStore } from "./placements.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresPlacementStore implements PlacementStore {
  constructor(private readonly db: SqlExecutor) {}

  async create(p: Placement): Promise<Placement> {
    const rows = await this.db.query<Placement>(
      `insert into staffing_placements
       (id, organization_id, application_id, job_id, worker_id, employer_id, agency_id, status,
        start_date, end_date, pay_rate, currency, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning id, organization_id as "organizationId", application_id as "applicationId", job_id as "jobId",
                 worker_id as "workerId", employer_id as "employerId", agency_id as "agencyId", status,
                 start_date as "startDate", end_date as "endDate", pay_rate as "payRate", currency,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [p.id,p.organizationId,p.applicationId,p.jobId,p.workerId,p.employerId,p.agencyId ?? null,p.status,p.startDate,p.endDate ?? null,p.payRate,p.currency,p.createdAt,p.updatedAt],
    );
    if (!rows[0]) throw new Error("Placement insert returned no row");
    return rows[0];
  }

  async findByApplication(applicationId: string): Promise<Placement | null> {
    const rows = await this.db.query<Placement>(
      `select id, organization_id as "organizationId", application_id as "applicationId", job_id as "jobId",
              worker_id as "workerId", employer_id as "employerId", agency_id as "agencyId", status,
              start_date as "startDate", end_date as "endDate", pay_rate as "payRate", currency,
              created_at as "createdAt", updated_at as "updatedAt"
       from staffing_placements where application_id = $1 limit 1`, [applicationId]);
    return rows[0] ?? null;
  }
}
