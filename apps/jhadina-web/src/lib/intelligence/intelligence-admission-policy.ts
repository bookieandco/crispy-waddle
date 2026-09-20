import type { IntelligencePrivacyClass, IntelligenceRiskClass } from '@jhadina/intelligence-core';
export interface TrustedIntelligenceAdmission {readonly privacyClass:IntelligencePrivacyClass;readonly riskClass:IntelligenceRiskClass;}
export interface IntelligenceAdmissionPolicy {classify(input:{actorId:string;purpose:string;capability:string}):TrustedIntelligenceAdmission;}
/** Conservative production admission: unknown purposes never become public/low risk by default. */
export class ConservativeIntelligenceAdmissionPolicy implements IntelligenceAdmissionPolicy{
 classify(input:{actorId:string;purpose:string;capability:string}):TrustedIntelligenceAdmission{
  if(!input.actorId.trim()) throw new Error('INTELLIGENCE_ADMISSION_ACTOR_REQUIRED');
  const text=`${input.purpose} ${input.capability}`.toLowerCase();
  const restricted=/credential|secret|password|private key|seed phrase|medical|health record|ssn|social security/.test(text);
  const high=/execute|transfer|payment|trade|delete|publish|send|emergency|self_modify/.test(text);
  return Object.freeze({privacyClass:restricted?'restricted':'internal',riskClass:high?'high':'standard'});
 }
}
