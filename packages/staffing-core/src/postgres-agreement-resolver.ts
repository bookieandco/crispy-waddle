import type { AgencyContract, AgencyContractRepository, CommercialAgreement, ID } from "./agency-agreements.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresAgreementResolver implements AgencyContractRepository {
  constructor(private readonly db: SqlExecutor) {}

  async getActiveAgreement(input: { agencyId: ID; employerId: ID; at: string }): Promise<CommercialAgreement | null> {
    const rows = await this.db.query<CommercialAgreement>(
      `select a.id, a.contract_id as "contractId", a.billing_rate as "billingRate",
              a.worker_pay_rate as "workerPayRate", a.agency_split_percent as "agencySplitPercent",
              a.currency, a.effective_from as "effectiveFrom", a.effective_to as "effectiveTo", a.status
       from staffing_commercial_agreements a
       join staffing_agency_contracts c on c.id = a.contract_id
       where c.agency_id = $1 and c.employer_id = $2
         and c.status = 'ACTIVE'
         and a.status = 'ACTIVE'
         and c.effective_from <= $3 and (c.effective_to is null or c.effective_to >= $3)
         and a.effective_from <= $3 and (a.effective_to is null or a.effective_to >= $3)
       order by a.effective_from desc limit 1`,
      [input.agencyId, input.employerId, input.at],
    );
    return rows[0] ?? null;
  }

  async getContract(id: ID): Promise<AgencyContract | null> {
    const rows = await this.db.query<AgencyContract>(
      `select id, agency_id as "agencyId", employer_id as "employerId",
              effective_from as "effectiveFrom", effective_to as "effectiveTo", status
       from staffing_agency_contracts where id = $1 limit 1`,
      [id],
    );
    return rows[0] ?? null;
  }
}
