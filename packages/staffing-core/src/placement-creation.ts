import type { SqlExecutor } from "./postgres-adapters.js";

export interface PlacementCommercialResolution {
  agencyId:string;
  employerId:string;
  contractId:string;
  agreementId:string;
  splitBasisPoints:number;
}

export class PlacementCreationService {
  constructor(
    private readonly db:SqlExecutor,
    private readonly ids:{next(prefix:string):string},
    private readonly clock:{now():string},
  ) {}

  async create(input:{
    organizationId:string;
    applicationId:string;
    createdBy:string;
    startDate:string;
    hourlyBillRate:number;
    commercial:PlacementCommercialResolution;
  }) {
    if(input.hourlyBillRate<=0) throw new Error("Hourly bill rate must be positive");
    if(input.commercial.splitBasisPoints<0||input.commercial.splitBasisPoints>10000) {
      throw new Error("Commercial split must be between 0 and 10000 basis points");
    }

    return this.db.transaction(async tx=>{
      const rows=await tx.query<any>(
        `select a.id,
                a.job_id as "jobId",
                a.worker_id as "workerId",
                coalesce(a.candidate_id,a.worker_id::text) as "candidateId",
                a.status,
                j.pay_rate as "payRate",
                j.currency,
                j.employer_id as "jobEmployerId"
           from staffing_applications a
           join staffing_marketplace_jobs j on j.id=a.job_id
          where a.id=$1 and a.organization_id=$2
          for update of a`,
        [input.applicationId,input.organizationId],
      );
      const application=rows[0];
      if(!application) throw new Error("Application not found");
      if(application.status!=="PLACEMENT_READY") {
        throw new Error("Application must be PLACEMENT_READY before placement creation");
      }
      if(String(application.jobEmployerId)!==String(input.commercial.employerId)) {
        throw new Error("Commercial employer does not match the job employer");
      }

      const duplicate=await tx.query<any>(
        `select id from staffing_placements
          where organization_id=$1 and application_id=$2 and status in ('ACTIVE','PENDING')
          limit 1`,
        [input.organizationId,input.applicationId],
      );
      if(duplicate[0]) throw new Error("An active or pending placement already exists for this application");

      const agreement=await tx.query<any>(
        `select a.id
           from staffing_commercial_agreements a
           join staffing_agency_contracts c on c.id=a.contract_id
          where a.id=$1
            and c.organization_id=$2
            and c.status='ACTIVE'
            and c.effective_at <= now()
            and (c.expires_at is null or c.expires_at >= now())
            and a.effective_at <= now()
            and (a.expires_at is null or a.expires_at >= now())
          for update of a`,
        [input.commercial.agreementId,input.organizationId],
      );
      if(!agreement[0]) throw new Error("Commercial agreement is not active");

      const placementId=this.ids.next("placement");
      const now=this.clock.now();
      await tx.query(
        `insert into staffing_placements
          (id,organization_id,application_id,job_id,worker_id,employer_id,agency_id,status,
           start_date,end_date,pay_rate,currency,created_at,updated_at,
           candidate_id,contract_id,commercial_agreement_id,split_basis_points,hourly_bill_rate,created_by)
         values
          ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,null,$9,$10,$11,$11,$12,$13,$14,$15,$16,$17)`,
        [
          placementId,input.organizationId,input.applicationId,application.jobId,application.workerId,
          input.commercial.employerId,input.commercial.agencyId,input.startDate,Number(application.payRate),
          String(application.currency).toUpperCase(),now,application.candidateId,input.commercial.contractId,
          input.commercial.agreementId,input.commercial.splitBasisPoints,input.hourlyBillRate,input.createdBy,
        ],
      );

      await tx.query(
        `update staffing_applications set status='PLACED',updated_at=$1
          where id=$2 and organization_id=$3`,
        [now,input.applicationId,input.organizationId],
      );
      await tx.query(
        `insert into staffing_event_outbox
          (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at)
         values ($1,'PLACEMENT_CREATED',$2,$3,$4,$5,'PENDING',0,$4)`,
        [
          this.ids.next("event"),placementId,input.organizationId,now,
          JSON.stringify({
            placementId,
            applicationId:input.applicationId,
            jobId:application.jobId,
            candidateId:application.candidateId,
            workerId:application.workerId,
            commercial:input.commercial,
            startDate:input.startDate,
            hourlyBillRate:input.hourlyBillRate,
          }),
        ],
      );
      return {
        placementId,
        applicationId:input.applicationId,
        status:"PENDING" as const,
        commercial:input.commercial,
        createdAt:now,
      };
    });
  }
}
