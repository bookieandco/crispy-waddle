import type {ContextPacket,DecisionProposal} from "@jhadina/core-spine"
import {
 CapabilityAwareModelRouter,DeterministicTaskClassifier,ModelRegistry,
 type ModelProvider,type ModelRegistryEntry,type IntelligencePrivacyClass,type IntelligenceModality,
} from "@jhadina/intelligence-core"

/** Connects the existing capability-aware router to the canonical JLLM DecisionPort.
 * The model still returns a proposal only; Action Core owns execution and approvals.
 */
export class GovernedJllmModelRouter implements ModelProvider{
 readonly name="jllm-capability-router"
 private readonly classifier=new DeterministicTaskClassifier()
 private readonly routing:CapabilityAwareModelRouter
 constructor(bindings:readonly {model:ModelRegistryEntry;provider:ModelProvider}[],private readonly privacyClass:IntelligencePrivacyClass="restricted"){
  const registry=new ModelRegistry({version:1,models:bindings.map(b=>b.model)})
  this.routing=new CapabilityAwareModelRouter({registry,providers:bindings.map(b=>({modelId:b.model.id,provider:b.provider}))})
 }
 async propose(context:ContextPacket):Promise<DecisionProposal>{
  const images=(context.artifacts??[]).some(a=>a.kind==="image"||a.kind==="screen")
  const modalities:readonly IntelligenceModality[]=images?["text","vision"]:["text"]
  const task=this.classifier.classify({
   id:context.id,purpose:context.userGoal??context.purpose,modalities,
   privacyClass:this.privacyClass,
  })
  const route=await this.routing.select(task,{
   task,packet:context,evidenceIds:[],contextHash:"pre-governed-evidence-binding",
  })
  // Only explicitly supplied providers can be returned by this route.
  // This loop is not an action executor and never grants capabilities.
  let lastFailure:unknown
  for(const provider of [route.provider,...route.fallbackProviders]){
   try{return await provider.propose(context)}catch(error){lastFailure=error}
  }
  throw lastFailure instanceof Error?lastFailure:new Error("ROUTED_MODEL_UNAVAILABLE")
 }
}
