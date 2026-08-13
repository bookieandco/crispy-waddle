import type { Timesheet, TimesheetStatus } from "./timesheets.js";
import type { SqlExecutor } from "./postgres-adapters.js";

const transitions: Record<TimesheetStatus, TimesheetStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: ["SUBMITTED"],
  // BILLABLE is reached via TimesheetService.transition (billing pipeline),
  // not this workflow, and is terminal from this workflow's perspective.
  BILLABLE: [],
};

export class TransactionalTimesheetWorkflow {
  constructor(private readonly db: SqlExecutor, private readonly ids: { next(prefix: string): string }, private readonly clock: { now(): string }) {}

  async transition(timesheetId: string, organizationId: string, nextStatus: TimesheetStatus, note = ""): Promise<Timesheet> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<Timesheet>(
        `select id, organization_id as "organizationId", placement_id as "placementId", worker_id as "workerId",
                period_start as "periodStart", period_end as "periodEnd", regular_hours as "regularHours",
                overtime_hours as "overtimeHours", status, submitted_at as "submittedAt", approved_at as "approvedAt",
                created_at as "createdAt", updated_at as "updatedAt"
         from staffing_timesheets where id = $1 and organization_id = $2 for update`,
        [timesheetId, organizationId],
      );
      const current = rows[0];
      if (!current) throw new Error("Timesheet not found");
      if (!transitions[current.status].includes(nextStatus)) throw new Error(`Invalid timesheet transition: ${current.status} -> ${nextStatus}`);
      const now = this.clock.now();
      const submittedAt = nextStatus === "SUBMITTED" ? now : current.submittedAt ?? null;
      const approvedAt = nextStatus === "APPROVED" ? now : current.approvedAt ?? null;
      const updated = await tx.query<Timesheet>(
        `update staffing_timesheets set status=$1, submitted_at=$2, approved_at=$3, updated_at=$4 where id=$5
         returning id, organization_id as "organizationId", placement_id as "placementId", worker_id as "workerId",
                   period_start as "periodStart", period_end as "periodEnd", regular_hours as "regularHours",
                   overtime_hours as "overtimeHours", status, submitted_at as "submittedAt", approved_at as "approvedAt",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [nextStatus, submittedAt, approvedAt, now, timesheetId],
      );
      const saved = updated[0];
      if (!saved) throw new Error("Timesheet update returned no row");
      if (nextStatus === "APPROVED") {
        await tx.query(
          `insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at)
           values ($1,'TIMESHEET_APPROVED',$2,$3,$4,$5,'PENDING',0,$4)`,
          [this.ids.next("event"), saved.id, organizationId, now, JSON.stringify({ timesheet: saved, note: note.trim() })],
        );
      } else if (nextStatus === "SUBMITTED" || nextStatus === "REJECTED") {
        await tx.query(
          `insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at)
           values ($1,$2,$3,$4,$5,$6,'PENDING',0,$5)`,
          [this.ids.next("event"), saved.id, organizationId, now, JSON.stringify({ timesheet: saved, note: note.trim() }), `TIMESHEET_${nextStatus}`],
        );
      }
      return saved;
    });
  }
}
