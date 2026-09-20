import type { RetrievalAuthorizer,RetrievalAuthorizationRequest,RetrievalSource,RetrievalQuery,RetrievalCandidate } from '@jhadina/intelligence-core';
import type { MemoryRepository } from '../repositories/MemoryRepository';

export class ActorScopedMemoryRetrievalSource implements RetrievalSource{
 readonly name='actor-scoped-memory';
 constructor(private readonly repo:MemoryRepository,private readonly actorId:string){}
 async retrieve(q:RetrievalQuery):Promise<readonly RetrievalCandidate[]>{
  if(!this.actorId.trim()) throw new Error('MEMORY_RETRIEVAL_ACTOR_REQUIRED');
  const rows=await this.repo.search(this.actorId,{query:q.text,limit:q.limit});
  return rows.map((m:any)=>Object.freeze({
   evidenceId:`memory:${m.id}`,sourceKind:'memory' as const,sourceId:m.id,channel:'lexical' as const,
   summary:m.content,score:Number.isFinite(m.confidence)?Math.max(0,Math.min(1,m.confidence)):0.5,
   observedAt:m.approvedAt??m.createdAt,provenance:Object.freeze([`memory:${m.id}`,`actor:${this.actorId}`]),
  }));
 }
}

/** Defense-in-depth authorizer: re-reads memory through the actor-scoped repository. */
export class RepositoryRetrievalAuthorizer implements RetrievalAuthorizer{
 constructor(private readonly memoryRepo:MemoryRepository){}
 async authorize(r:RetrievalAuthorizationRequest):Promise<'allow'|'deny'>{
  if(!r.principal.actorId.trim()) return 'deny';
  if(r.sourceKind!=='memory') return 'deny'; // other source kinds need their own concrete ownership authorizer
  try{return await this.memoryRepo.getById(r.principal.actorId,r.sourceId)?'allow':'deny';}catch{return 'deny';}
 }
}
