import type { SqlExecutor } from "./postgres-adapters.js";

export class CandidateReferralService {
  constructor(private readonly db: SqlExecutor, private readonly ids:{next(prefix:string):string}, private readonly clock:{now():string}) {}

  async refer(input:{organizationId:string; applicationId:string; agencyUserId:string; employerUserId:string; subject?:string; message?:string}) {
    return this.db.transaction(async tx => {
      const rows=await tx.query<any>(`select a.id,a.job_id as "jobId",a.candidate_id as "candidateId",j.title as "jobTitle" from staffing_applications a join staffing_jobs j on j.id=a.job_id where a.id=$1 and a.organization_id=$2 for update`,[input.applicationId,input.organizationId]);
      const application=rows[0]; if(!application) throw new Error("Application not found");
      const existing=await tx.query<any>(`select c.id from staffing_conversations c join staffing_conversation_participants p1 on p1.conversation_id=c.id and p1.participant_id=$2 join staffing_conversation_participants p2 on p2.conversation_id=c.id and p2.participant_id=$3 where c.organization_id=$1 and c.subject=$4 limit 1`,[input.organizationId,input.agencyUserId,input.employerUserId,input.subject ?? `Candidate referral: ${application.jobTitle}`]);
      const now=this.clock.now(); let conversationId=existing[0]?.id;
      if(!conversationId){ conversationId=this.ids.next("conversation"); const subject=input.subject ?? `Candidate referral: ${application.jobTitle}`; await tx.query(`insert into staffing_conversations (id,organization_id,subject,created_by,created_at) values ($1,$2,$3,$4,$5)`,[conversationId,input.organizationId,subject,input.agencyUserId,now]); for(const participantId of [input.agencyUserId,input.employerUserId]) await tx.query(`insert into staffing_conversation_participants (conversation_id,organization_id,participant_id,created_at) values ($1,$2,$3,$4)`,[conversationId,input.organizationId,participantId,now]); }
      const messageId=this.ids.next("message"); const body=input.message ?? `Candidate ${application.candidateId} has been referred for ${application.jobTitle}. Application: ${application.id}`;
      await tx.query(`insert into staffing_messages (id,conversation_id,organization_id,sender_id,body,created_at) values ($1,$2,$3,$4,$5,$6)`,[messageId,conversationId,input.organizationId,input.agencyUserId,body,now]);
      await tx.query(`update staffing_applications set status='REFERRED', updated_at=$1 where id=$2 and organization_id=$3`,[now,input.applicationId,input.organizationId]);
      await tx.query(`insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at) values ($1,'CANDIDATE_REFERRED',$2,$3,$4,$5,'PENDING',0,$4)`,[this.ids.next("event"),input.applicationId,input.organizationId,now,JSON.stringify({applicationId:input.applicationId,candidateId:application.candidateId,jobId:application.jobId,conversationId,messageId})]);
      return {applicationId:input.applicationId,conversationId,messageId,status:"REFERRED",occurredAt:now};
    });
  }
}
