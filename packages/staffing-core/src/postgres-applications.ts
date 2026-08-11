import type { Application, ApplicationStore } from "./applications.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresApplicationStore implements ApplicationStore {
  constructor(private readonly db: SqlExecutor) {}

  async create(application: Application): Promise<Application> {
    const rows = await this.db.query<Application>(
      `insert into staffing_applications
       (id, organization_id, job_id, worker_id, status, cover_note, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, organization_id as "organizationId", job_id as "jobId", worker_id as "workerId",
                 status, cover_note as "coverNote", created_at as "createdAt", updated_at as "updatedAt"`,
      [application.id, application.organizationId, application.jobId, application.workerId, application.status, application.coverNote, application.createdAt, application.updatedAt],
    );
    if (!rows[0]) throw new Error("Application insert returned no row");
    return rows[0];
  }

  async findByJobAndWorker(jobId: string, workerId: string): Promise<Application | null> {
    const rows = await this.db.query<Application>(
      `select id, organization_id as "organizationId", job_id as "jobId", worker_id as "workerId",
              status, cover_note as "coverNote", created_at as "createdAt", updated_at as "updatedAt"
       from staffing_applications where job_id = $1 and worker_id = $2
       and status <> 'WITHDRAWN' limit 1`,
      [jobId, workerId],
    );
    return rows[0] ?? null;
  }
}
