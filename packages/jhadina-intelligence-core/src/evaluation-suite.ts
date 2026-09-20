import type { IntelligenceEvaluationCase } from './evaluation-harness.js';
export interface IntelligenceRegressionChecks {
 routing():Promise<void>; evidence():Promise<void>; critic():Promise<void>; privacy():Promise<void>;
 fallback():Promise<void>; context():Promise<void>; cache():Promise<void>; perception():Promise<void>;
}
export function canonicalIntelligenceEvaluationSuite(c:IntelligenceRegressionChecks):readonly IntelligenceEvaluationCase[]{
 return Object.freeze([
  {id:'JLLM-EVAL-routing',category:'routing',run:()=>c.routing()},
  {id:'JLLM-EVAL-evidence-fidelity',category:'evidence',run:()=>c.evidence()},
  {id:'JLLM-EVAL-critic-downgrade',category:'critic',run:()=>c.critic()},
  {id:'JLLM-EVAL-privacy-isolation',category:'privacy',run:()=>c.privacy()},
  {id:'JLLM-EVAL-provider-fallback',category:'fallback',run:()=>c.fallback()},
  {id:'JLLM-EVAL-context-integrity',category:'context',run:()=>c.context()},
  {id:'JLLM-EVAL-cache-isolation',category:'cache',run:()=>c.cache()},
  {id:'JLLM-EVAL-perception-boundary',category:'perception',run:()=>c.perception()},
 ]);
}
