import type { Timesheet } from "./timesheets.js";
import type { PlacementFinancialInput, PlacementFinancialResult, PlacementFinancialService } from "./placement-financials.js";

export interface BillableTimesheetResult { timesheetId:string; status:"BILLABLE"; financial:PlacementFinancialResult; }

export interface BillableTimesheetStore {
  findById(id:string, organizationId:string): Promise<Timesheet | null>;
  transitionToBillable(id:string, organizationId:string, updatedAt:string): Promise<Timesheet>;
}

export class BillableTimesheetService {
  constructor(private readonly store:BillableTimesheetStore, private readonly financials:PlacementFinancialService, private readonly clock:{now():string}) {}

  async finalize(input: { organizationId:string; timesheetId:string; financial:Omit<PlacementFinancialInput,"timesheetId"|"organizationId"> }): Promise<BillableTimesheetResult> {
    const sheet=await this.store.findById(input.timesheetId,input.organizationId);
    if(!sheet) throw new Error("Timesheet not found");
    if(sheet.status==="BILLABLE") throw new Error("Timesheet has already been finalized");
    if(sheet.status!=="APPROVED") throw new Error("Timesheet must be APPROVED before billing");
    const updated=await this.store.transitionToBillable(sheet.id,input.organizationId,this.clock.now());
    try {
      const financial=await this.financials.finalize({...input.financial,organizationId:input.organizationId,timesheetId:sheet.id});
      return {timesheetId:updated.id,status:"BILLABLE",financial};
    } catch(error) {
      // The financial layer must be idempotent/retriable; do not create a second invoice on retry.
      throw error;
    }
  }
}
