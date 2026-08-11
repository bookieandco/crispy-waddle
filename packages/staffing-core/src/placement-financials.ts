import type { ID } from "./agency-agreements.js";
import type { AgencyContractRepository } from "./agency-agreements.js";
import { AgreementResolutionService } from "./agreement-resolution.js";
import type { Invoice, InvoiceLedgerService, InvoiceRepository } from "./invoice-ledger.js";
import type { BillingCalculation } from "./billing.js";
import type { FinancialIdempotencyGuard, FinancialOperationRecord } from "./financial-idempotency.js";

export interface PlacementFinancialInput { organizationId: ID; placementId: ID; employerId: ID; agencyId: ID; timesheetId: ID; invoiceNumber: string; dueAt: string; occurredAt: string; billing: BillingCalculation; grossSpread: number; idempotencyKey?: string; }
export interface PlacementFinancialResult { invoice: Invoice; agreementId: ID; contractId: ID; basisAmount: number; platformFee: number; agencyRevenue: number; platformRevenue: number; }
export interface CommercialLedgerEntry { id:string; organizationId:ID; placementId:ID; invoiceId:ID; agreementId:ID; type:"PLATFORM_FEE"|"AGENCY_REVENUE"|"PLATFORM_REVENUE"; amount:number; currency:string; occurredAt:string; }
export interface PlacementFinancialRepository extends AgencyContractRepository, InvoiceRepository { saveCommercialLedgerEntry(entry:CommercialLedgerEntry):Promise<void>; }

export class PlacementFinancialService {
  constructor(private readonly repository:PlacementFinancialRepository, private readonly invoiceLedger:InvoiceLedgerService, private readonly resolution:AgreementResolutionService, private readonly idempotency?:FinancialIdempotencyGuard, private readonly clock:{now():string}={now:()=>new Date().toISOString()}) {}

  async finalize(input:PlacementFinancialInput):Promise<PlacementFinancialResult>{
    if(input.grossSpread<0) throw new Error("Gross spread cannot be negative");
    const key=input.idempotencyKey ?? `placement-financial:${input.organizationId}:${input.timesheetId}`;
    const record:FinancialOperationRecord={organizationId:input.organizationId,idempotencyKey:key,operation:"PLACEMENT_FINANCIAL_FINALIZE",placementId:input.placementId,timesheetId:input.timesheetId,invoiceId:input.invoiceNumber,createdAt:input.occurredAt,status:"PROCESSING"};
    if(this.idempotency){
      const state=await this.idempotency.begin(record);
      if(state.kind==="COMPLETED") return state.result as PlacementFinancialResult;
      if(state.kind==="PROCESSING") throw new Error("Financial operation is already processing; retry after the current attempt completes");
    }
    try {
      const resolved=await this.resolution.resolve({placementId:input.placementId,agencyId:input.agencyId,employerId:input.employerId,organizationId:input.organizationId,at:input.occurredAt,billingTotal:input.billing.employerBill,grossSpread:input.grossSpread,currency:input.billing.currency});
      const invoice=await this.invoiceLedger.draftFromBilling({organizationId:input.organizationId,employerId:input.employerId,agencyId:input.agencyId,timesheetId:input.timesheetId,invoiceNumber:input.invoiceNumber,dueAt:input.dueAt,billing:input.billing});
      await this.invoiceLedger.issue(invoice.id);
      const entries:CommercialLedgerEntry[]=[["PLATFORM_FEE",resolved.split.platformFee],["AGENCY_REVENUE",resolved.split.agencyRevenue],["PLATFORM_REVENUE",resolved.split.platformRevenue]].map(([type,amount])=>({id:`commercial:${input.placementId}:${resolved.agreement.id}:${type}`,organizationId:input.organizationId,placementId:input.placementId,invoiceId:invoice.id,agreementId:resolved.agreement.id,type:type as CommercialLedgerEntry["type"],amount:amount as number,currency:resolved.split.currency,occurredAt:input.occurredAt}));
      for(const entry of entries) await this.repository.saveCommercialLedgerEntry(entry);
      const result={invoice,agreementId:resolved.agreement.id,contractId:resolved.contract.id,basisAmount:resolved.split.basisAmount,platformFee:resolved.split.platformFee,agencyRevenue:resolved.split.agencyRevenue,platformRevenue:resolved.split.platformRevenue};
      if(this.idempotency) await this.idempotency.complete({organizationId:input.organizationId,idempotencyKey:key},result,this.clock.now());
      return result;
    } catch(error) {
      if(this.idempotency) await this.idempotency.fail({organizationId:input.organizationId,idempotencyKey:key},this.clock.now());
      throw error;
    }
  }
}
