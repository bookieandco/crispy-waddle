import {
 AnthropicProviderAdapter,AuthorizedRetrievalPipeline,CapabilityAwareModelRouter,
 CanonicalIntelligenceContextCompiler,CriticVerificationPipeline,DEFAULT_MODEL_REGISTRY,
 DeterministicTaskClassifier,DurableInferenceLedger,EvidenceBoundProposalVerifier,
 HybridRetrievalBridge,IntelligenceFabric,RegistryBackedModelProvider,
 type IntelligenceTaskClassificationInput,
} from "@jhadina/intelligence-core"
import type { ContextPacket,DecisionProposal } from "@jhadina/core-spine"
import type { ActionLedger } from "@jhadina/action-core"
import type { MemoryRepository } from "../repositories/MemoryRepository"
import { ActionAuditInferenceLedgerSink } from "./durable-inference-ledger"
import { ActorScopedMemoryRetrievalSource,RepositoryRetrievalAuthorizer } from "./production-retrieval-authorization"

const classifier=new DeterministicTaskClassifier()

export interface ProductionIntelligenceFabric {
 decide(input:IntelligenceTaskClassificationInput,context:ContextPacket):Promise<DecisionProposal>
}

export function createProductionIntelligenceFabric(input:{ledger:ActionLedger;actorId:string;memoryRepo:MemoryRepository}):ProductionIntelligenceFabric{
 if(!input.actorId.trim()) throw new Error("PRODUCTION_INTELLIGENCE_ACTOR_REQUIRED")
 const inferenceLedger=new DurableInferenceLedger(new ActionAuditInferenceLedgerSink(input.ledger,input.actorId))
 const retrieval=new HybridRetrievalBridge([new ActorScopedMemoryRetrievalSource(input.memoryRepo,input.actorId)])
 const authorized=new AuthorizedRetrievalPipeline(new RepositoryRetrievalAuthorizer(input.memoryRepo))
 const compiler=new CanonicalIntelligenceContextCompiler({augmentation:async(task,packet)=>{
   const text=packet.userGoal?.trim()||packet.purpose
   const query={taskId:task.id,text,limit:8}
   const raw=await retrieval.retrieve(query)
   const safe=await authorized.process({principal:{actorId:input.actorId},query,candidates:raw.candidates})
   return {candidates:safe.candidates,deniedEvidenceIds:safe.deniedEvidenceIds}
 }})
 const anthropic=new RegistryBackedModelProvider({modelId:"anthropic.reasoning.default",registry:DEFAULT_MODEL_REGISTRY,adapter:new AnthropicProviderAdapter()})
 const routeSelector=new CapabilityAwareModelRouter({registry:DEFAULT_MODEL_REGISTRY,providers:[{modelId:"anthropic.reasoning.default",provider:anthropic}]})
 const fabric=new IntelligenceFabric({
  contextCompiler:compiler,routeSelector,
  proposalVerifier:new CriticVerificationPipeline({evidenceVerifier:new EvidenceBoundProposalVerifier()}),
  ledger:inferenceLedger,
 })
 return {async decide(taskInput,context){return fabric.decide(classifier.classify(taskInput),context)}}
}
