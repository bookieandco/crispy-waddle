import type { SqlExecutor } from "./postgres-adapters.js";

export interface Conversation { id:string; organizationId:string; subject?:string; createdBy:string; createdAt:string; }
export interface Message { id:string; conversationId:string; organizationId:string; senderId:string; body:string; createdAt:string; }

export class CommunicationService {
  constructor(private readonly db: SqlExecutor, private readonly ids:{next(prefix:string):string}, private readonly clock:{now():string}) {}

  async createConversation(input:{organizationId:string; createdBy:string; subject?:string; participantIds:string[]}) {
    return this.db.transaction(async tx => {
      const id=this.ids.next("conversation"), now=this.clock.now();
      await tx.query(`insert into staffing_conversations (id,organization_id,subject,created_by,created_at) values ($1,$2,$3,$4,$5)`,[id,input.organizationId,input.subject??null,input.createdBy,now]);
      for (const participantId of [...new Set(input.participantIds)]) await tx.query(`insert into staffing_conversation_participants (conversation_id,organization_id,participant_id,created_at) values ($1,$2,$3,$4)`,[id,input.organizationId,participantId,now]);
      return {id,organizationId:input.organizationId,subject:input.subject,createdBy:input.createdBy,createdAt:now};
    });
  }

  async sendMessage(input:{organizationId:string; conversationId:string; senderId:string; body:string}) {
    if (!input.body.trim()) throw new Error("Message body cannot be empty");
    return this.db.transaction(async tx => {
      const allowed=await tx.query(`select 1 from staffing_conversation_participants where conversation_id=$1 and organization_id=$2 and participant_id=$3`,[input.conversationId,input.organizationId,input.senderId]);
      if (!allowed[0]) throw new Error("Sender is not a conversation participant");
      const id=this.ids.next("message"), now=this.clock.now();
      const rows=await tx.query<Message>(`insert into staffing_messages (id,conversation_id,organization_id,sender_id,body,created_at) values ($1,$2,$3,$4,$5,$6) returning id,conversation_id as "conversationId",organization_id as "organizationId",sender_id as "senderId",body,created_at as "createdAt"`,[id,input.conversationId,input.organizationId,input.senderId,input.body.trim(),now]);
      await tx.query(`insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at) values ($1,'MESSAGE_SENT',$2,$3,$4,$5,'PENDING',0,$4)`,[this.ids.next("event"),input.conversationId,input.organizationId,now,JSON.stringify({messageId:id,conversationId:input.conversationId,senderId:input.senderId})]);
      if(!rows[0]) throw new Error("Message insert returned no row"); return rows[0];
    });
  }
}
