import type { SqlExecutor } from "./postgres-adapters.js";

export type InterviewAction = "SCHEDULE" | "RESCHEDULE" | "CANCEL";

export class InterviewSchedulingService {
  constructor(private readonly db: SqlExecutor, private readonly ids:{next(prefix:string):string}, private readonly clock:{now():string}) {}

  async schedule(input:{organizationId:string; applicationId:string; createdBy:string; startsAt:string; endsAt:string; timezone:string; location?:string; meetingUrl?:string}) {
    return this.db.transaction(async tx=>{
      const rows=await tx.query<any>(`select id,job_id as "jobId",candidate_id as "candidateId",status from staffing_applications where id=$1 and organization_id=$2 for update`,[input.applicationId,input.organizationId]);
      const application=rows[0]; if(!application) throw new Error("Application not found");
      if(application.status!=="INTERVIEW") throw new Error("Application must be in INTERVIEW state before scheduling");
      if(new Date(input.endsAt)<=new Date(input.startsAt)) throw new Error("Interview end must be after start");
      const conflict=await tx.query<any>(`select id from staffing_interviews where organization_id=$1 and status='SCHEDULED' and starts_at < $3 and ends_at > $2 limit 1`,[input.organizationId,input.startsAt,input.endsAt]);
      if(conflict[0]) throw new Error("Interview time conflicts with an existing scheduled interview");
      const id=this.ids.next("interview"), now=this.clock.now();
      await tx.query(`insert into staffing_interviews (id,organization_id,application_id,created_by,starts_at,ends_at,timezone,location,meeting_url,status,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SCHEDULED',$10,$10)`,[id,input.organizationId,input.applicationId,input.createdBy,input.startsAt,input.endsAt,input.timezone,input.location??null,input.meetingUrl??null,now]);
      await tx.query(`update staffing_applications set status='INTERVIEW_SCHEDULED',updated_at=$1 where id=$2`,[now,input.applicationId]);
      await tx.query(`insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at) values ($1,'INTERVIEW_SCHEDULED',$2,$3,$4,$5,'PENDING',0,$4)`,[this.ids.next("event"),input.applicationId,input.organizationId,now,JSON.stringify({interviewId:id,applicationId:input.applicationId,startsAt:input.startsAt,endsAt:input.endsAt,timezone:input.timezone})]);
      return {id,applicationId:input.applicationId,status:"SCHEDULED",startsAt:input.startsAt,endsAt:input.endsAt,timezone:input.timezone};
    });
  }
}
