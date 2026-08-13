import type { SqlExecutor } from "./postgres-adapters.js";

export type InterviewOutcome = "PASS" | "HOLD" | "FAIL";

export class InterviewOutcomeService {
  constructor(private readonly db: SqlExecutor, private readonly ids:{next(prefix:string):string}, private readonly clock:{now():string}) {}

  async record(input:{organizationId:string; interviewId:string; employerUserId:string; outcome:InterviewOutcome; note?:string}) {
    return this.db.transaction(async tx=>{
      const rows=await tx.query<any>(`select i.id,i.application_id as "applicationId",i.status as "interviewStatus",a.job_id as "jobId",a.candidate_id as "candidateId",a.status as "applicationStatus" from staffing_interviews i join staffing_applications a on a.id=i.application_id where i.id=$1 and i.organization_id=$2 for update`,[input.interviewId,input.organizationId]);
      const interview=rows[0]; if(!interview) throw new Error("Interview not found");
      if(interview.interviewStatus!=="SCHEDULED") throw new Error("Interview must be scheduled before an outcome is recorded");
      if(interview.applicationStatus!=="INTERVIEW_SCHEDULED") throw new Error("Application is not ready for an interview outcome");
      const statusByOutcome:Record<InterviewOutcome,string>={PASS:"PLACEMENT_READY",HOLD:"ON_HOLD",FAIL:"INTERVIEW_FAILED"};
      const now=this.clock.now(); const nextStatus=statusByOutcome[input.outcome]; const id=this.ids.next("interview-outcome");
      await tx.query(`insert into staffing_interview_outcomes (id,organization_id,interview_id,application_id,employer_user_id,outcome,note,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)`,[id,input.organizationId,input.interviewId,interview.applicationId,input.employerUserId,input.outcome,input.note??null,now]);
      await tx.query(`update staffing_interviews set status='COMPLETED',updated_at=$1 where id=$2`,[now,input.interviewId]);
      await tx.query(`update staffing_applications set status=$1,updated_at=$2 where id=$3`,[nextStatus,now,interview.applicationId]);
      await tx.query(`insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at) values ($1,'INTERVIEW_OUTCOME',$2,$3,$4,$5,'PENDING',0,$4)`,[this.ids.next("event"),interview.applicationId,input.organizationId,now,JSON.stringify({interviewId:input.interviewId,applicationId:interview.applicationId,jobId:interview.jobId,candidateId:interview.candidateId,outcome:input.outcome,placementReady:input.outcome==='PASS'})]);
      return {id,interviewId:input.interviewId,applicationId:interview.applicationId,outcome:input.outcome,status:nextStatus,placementReady:input.outcome==='PASS',occurredAt:now};
    });
  }
}
