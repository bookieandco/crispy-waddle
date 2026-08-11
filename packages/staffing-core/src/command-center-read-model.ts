import type { SqlExecutor } from "./postgres-adapters.js";

export interface CommandCenterSignal { label: string; value: number; href: string; description: string; }

export class PostgresCommandCenterReadModel {
  constructor(private readonly db: SqlExecutor) {}

  async signals(organizationId: string): Promise<CommandCenterSignal[]> {
    const rows = await Promise.all([
      this.db.query<any>(`select count(*)::int value from staffing_jobs where organization_id=$1 and status='OPEN'`, [organizationId]),
      this.db.query<any>(`select count(*)::int value from staffing_applications where organization_id=$1 and status in ('QUALIFIED','REVIEW')`, [organizationId]),
      this.db.query<any>(`select count(*)::int value from staffing_placements where organization_id=$1 and status='ACTIVE'`, [organizationId]),
      this.db.query<any>(`select count(*)::int value from staffing_timesheets where organization_id=$1 and status='SUBMITTED'`, [organizationId]),
      this.db.query<any>(`select count(*)::int value from staffing_invoices where organization_id=$1 and status<>'PAID'`, [organizationId]),
      this.db.query<any>(`select count(*)::int value from staffing_agreements where organization_id=$1 and status='ACTIVE' and expires_at is not null and expires_at <= now() + interval '30 days'`, [organizationId]),
    ]);
    return [
      { label:"Open Jobs", value:Number(rows[0][0]?.value??0), href:"/command-center/jobs", description:"Jobs currently accepting candidates." },
      { label:"Candidates to Review", value:Number(rows[1][0]?.value??0), href:"/command-center/candidates", description:"Qualified or review-ready candidates." },
      { label:"Active Placements", value:Number(rows[2][0]?.value??0), href:"/command-center/placements", description:"Placements currently in service." },
      { label:"Timesheets Awaiting Approval", value:Number(rows[3][0]?.value??0), href:"/command-center/timesheets", description:"Submitted timesheets requiring review." },
      { label:"Unpaid Invoices", value:Number(rows[4][0]?.value??0), href:"/finance", description:"Invoices not yet fully paid." },
      { label:"Agreements Expiring Soon", value:Number(rows[5][0]?.value??0), href:"/command-center/agreements", description:"Active agreements expiring within 30 days." },
    ];
  }
}
