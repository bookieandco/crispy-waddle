import {
  AnthropicProviderAdapter, CapabilityAwareModelRouter, CanonicalIntelligenceContextCompiler,
  CriticVerificationPipeline, DEFAULT_MODEL_REGISTRY, DeterministicTaskClassifier,
  DurableInferenceLedger, EvidenceBoundProposalVerifier, InMemoryInferenceLedgerSink,
  IntelligenceFabric, RegistryBackedModelProvider,
  type IntelligenceTaskClassificationInput,
} from "@jhadina/intelligence-core"
import type { ContextPacket, DecisionProposal } from "@jhadina/core-spine"

const classifier=new DeterministicTaskClassifier()
const inferenceSink=new InMemoryInferenceLedgerSink()
const inferenceLedger=new DurableInferenceLedger(inferenceSink)

export interface ProductionIntelligenceFabric {
 decide(input:IntelligenceTaskClassificationInput,context:ContextPacket):Promise<DecisionProposal>
}

export function createProductionIntelligenceFabric():ProductionIntelligenceFabric{
 const anthropic=new RegistryBackedModelProvider({
  modelId:"anthropic.reasoning.default",registry:DEFAULT_MODEL_REGISTRY,adapter:new AnthropicProviderAdapter(),
 })
 const routeSelector=new CapabilityAwareModelRouter({
  registry:DEFAULT_MODEL_REGISTRY,providers:[{modelId:"anthropic.reasoning.default",provider:anthropic}],
 })
 const fabric=new IntelligenceFabric({
  contextCompiler:new CanonicalIntelligenceContextCompiler(),
  routeSelector,
  proposalVerifier:new CriticVerificationPipeline({
   evidenceVerifier:new EvidenceBoundProposalVerifier(),
   // No production critic provider is falsely declared. Complex/high-risk work fails closed.
  }),
  ledger:inferenceLedger,
 })
 return {async decide(input,context){return fabric.decide(classifier.classify(input),context)}}
}

export function productionInferenceLedgerSnapshot(){return inferenceSink.snapshot()}
