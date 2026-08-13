import type { Timesheet, TimesheetStore } from "./timesheets.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresTimesheetStore implements TimesheetStore {
  constructor(private readonly db: SqlExecutor) {}

  async create(t: Timesheet): Promise<Timesheet> {
    const rows = await this.db.query<Timesheet>(
      `insert into staffing_timesheets
       (id, organization_id, placement_id, worker_id, period_start, period_end, regular_hours, overtime_hours, status, submitted_at, approved_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning id, organization_id as "organizationId", placement_id as "placementId", worker_id as "workerId",
                 period_start as "periodStart", period_end as "periodEnd", regular_hours as "regularHours",
                 overtime_hours as "overtimeHours", status, submitted_at as "submittedAt", approved_at as "approvedAt",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [t.id,t.organizationId,t.placementId,t.workerId,t.periodStart,t.periodEnd,t.regularHours,t.overtimeHours,t.status,t.submittedAt ?? null,t.approvedAt ?? null,t.createdAt,t.updatedAt],
    );
    if (!rows[0]) throw new Error("Timesheet insert returned no row");
    return rows[0];
  }

  async update(t: Timesheet): Promise<Timesheet> {
    const rows = await this.db.query<Timesheet>(
      `update staffing_timesheets
       set regular_hours=$2, overtime_hours=$3, status=$4, submitted_at=$5, approved_at=$6, updated_at=$7
       where id=$1
       returning id, organization_id as "organizationId", placement_id as "placementId", worker_id as "workerId",
                 period_start as "periodStart", period_end as "periodEnd", regular_hours as "regularHours",
                 overtime_hours as "overtimeHours", status, submitted_at as "submittedAt", approved_at as "approvedAt",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [t.id, t.regularHours, t.overtimeHours, t.status, t.submittedAt ?? null, t.approvedAt ?? null, t.updatedAt],
    );
    if (!rows[0]) throw new Error("Timesheet update returned no row");
    return rows[0];
  }

  async findByPlacementPeriod(placementId: string, periodStart: string, periodEnd: string): Promise<Timesheet | null> {
    const rows = await this.db.query<Timesheet>(
      `select id, organization_id as "organizationId", placement_id as "placementId", worker_id as "workerId",
              period_start as "periodStart", period_end as "periodEnd", regular_hours as "regularHours",
              overtime_hours as "overtimeHours", status, submitted_at as "submittedAt", approved_at as "approvedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       from staffing_timesheets where placement_id = $1 and period_start = $2 and period_end = $3 limit 1`,
      [placementId, periodStart, periodEnd],
    );
    return rows[0] ?? null;
  }
}
