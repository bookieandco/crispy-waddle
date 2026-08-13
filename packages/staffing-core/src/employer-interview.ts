import type { SqlExecutor } from "./postgres-adapters.js";

export type EmployerDecision = "INTERVIEW" | "HOLD" | "DECLINE";

export class EmployerInterviewService {
  constructor(private readonly db: SqlExecutor, private readonly ids:{next(prefix:string):string}, private readonly clock:{now():string}) {}

  async decide(input:{organizationId:string; applicationId:string; employerUserId:string; decision:EmployerDecision; note?:string}) {
    return this.db.transaction(async tx=>{
      const rows=await tx.query<any>(`select id,job_id as "jobId",candidate_id as "candidateId",status from staffing_applications where id=$1 and organization_id=$2 for update`,[input.applicationId,input.organizationId]);
      const application=rows[0]; if(!application) throw new Error("Application not found");
      if(application.status!=="REFERRED") throw new Error("Application must be REFERRED before an employer decision");
      const statusByDecision:Record<EmployerDecision,string>={INTERVIEW:"INTERVIEW",HOLD:"ON_HOLD",DECLINE:"DECLINED"};
      const now=this.clock.now(); const nextStatus=statusByDecision[input.decision];
      await tx.query(`update staffing_applications set status=$1,updated_at=$2 where id=$3 and organization_id=$4`,[nextStatus,now,input.applicationId,input.organizationId]);
      const decisionId=this.ids.next("employer-decision");
      await tx.query(`insert into staffing_employer_decisions (id,organization_id,application_id,employer_user_id,decision,note,created_at) values ($1,$2,$3,$4,$5,$6,$7)`,[decisionId,input.organizationId,input.applicationId,input.employerUserId,input.decision,input.note??null,now]);
      await tx.query(`insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at) values ($1,'EMPLOYER_DECISION',$2,$3,$4,$5,'PENDING',0,$4)`,[this.ids.next("event"),input.applicationId,input.organizationId,now,JSON.stringify({applicationId:input.applicationId,jobId:application.jobId,candidateId:application.candidateId,decision:input.decision})]);
      return {id:decisionId,applicationId:input.applicationId,decision:input.decision,status:nextStatus,occurredAt:now};
    });
  }
}
