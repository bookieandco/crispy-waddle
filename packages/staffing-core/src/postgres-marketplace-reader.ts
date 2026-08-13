import type { Job } from "./jobs.js";
import type { MarketplaceJobQuery, MarketplaceJobReader, MarketplaceJobResult } from "./marketplace-query.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresMarketplaceJobReader implements MarketplaceJobReader {
  constructor(private readonly db: SqlExecutor) {}

  async search(query: MarketplaceJobQuery): Promise<MarketplaceJobResult> {
    const params: unknown[] = [];
    const where: string[] = ["status = 'PUBLISHED'"];
    const add = (value: unknown) => { params.push(value); return `$${params.length}`; };

    if (query.organizationId) where.push(`organization_id = ${add(query.organizationId)}`);
    if (query.search) {
      const p = add(`%${query.search}%`);
      where.push(`(title ilike ${p} or description ilike ${p})`);
    }
    if (query.location) where.push(`location ilike ${add(`%${query.location}%`)}`);
    if (query.remote !== undefined) where.push(`remote = ${add(query.remote)}`);
    if (query.currency) where.push(`currency = ${add(query.currency)}`);
    if (query.minPayRate !== undefined) where.push(`pay_rate >= ${add(query.minPayRate)}`);
    if (query.maxPayRate !== undefined) where.push(`pay_rate <= ${add(query.maxPayRate)}`);

    const limit = Math.min(query.limit ?? 25, 100);
    const cursor = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
    if (query.cursor && !Number.isFinite(cursor)) throw new Error("Invalid marketplace cursor");
    where.push(`extract(epoch from created_at)::bigint < ${add(cursor || 9223372036854)}`);

    const rows = await this.db.query<Job>(
      `select id, organization_id as "organizationId", employer_id as "employerId", title,
              description, location, pay_rate as "payRate", currency, remote, status,
              created_at as "createdAt", updated_at as "updatedAt"
       from staffing_marketplace_jobs
       where ${where.join(" and ")}
       order by created_at desc, id desc
       limit ${add(limit + 1)}`,
      params,
    );

    const jobs = rows.slice(0, limit);
    const next = rows.length > limit ? String(Math.floor(Date.parse(jobs[jobs.length - 1].createdAt) / 1000)) : null;
    return { jobs, nextCursor: next };
  }

  async getById(id: string): Promise<Job | null> {
    const rows = await this.db.query<Job>(
      `select id, organization_id as "organizationId", employer_id as "employerId", title,
              description, location, pay_rate as "payRate", currency, remote, status,
              created_at as "createdAt", updated_at as "updatedAt"
       from staffing_marketplace_jobs where id = $1 and status = 'PUBLISHED' limit 1`,
      [id],
    );
    return rows[0] ?? null;
  }
}
