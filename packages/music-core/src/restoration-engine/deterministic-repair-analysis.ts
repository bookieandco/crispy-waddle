import type { DamageType } from "./damage-assessment.js";
import type { RestorationRepairOperation } from "./runtime-contract.js";

export type ImpulseDamageClass="click"|"pop"|"thump"|"crackle"|"digital-discontinuity"|"unknown";

export interface ImpulseDamageFeatures{
  durationMs:number;
  spectralCentroidHz:number;
  lowFrequencyEnergyRatio:number;
  eventCount:number;
  peakDerivativeRatio:number;
}

export interface ImpulseDamageClassification{
  type:ImpulseDamageClass;
  confidence:number;
  reasons:string[];
}

const clamp01=(v:number)=>Math.max(0,Math.min(1,v));

export function classifyImpulseDamage(input:ImpulseDamageFeatures):ImpulseDamageClassification{
  const values=[input.durationMs,input.spectralCentroidHz,input.lowFrequencyEnergyRatio,input.eventCount,input.peakDerivativeRatio];
  if(values.some(v=>!Number.isFinite(v))||input.durationMs<=0||input.eventCount<0)return {type:"unknown",confidence:0,reasons:["Impulse features are incomplete or invalid."]};
  if(input.eventCount>=6){
    return {type:"crackle",confidence:clamp01(0.65+Math.min(0.3,input.eventCount/40)),reasons:["Multiple short impulse events occur inside the inspected region."]};
  }
  if(input.durationMs<=30&&input.lowFrequencyEnergyRatio>=0.65){
    return {type:"thump",confidence:clamp01(0.65+0.3*input.lowFrequencyEnergyRatio),reasons:["Short impulse energy is concentrated in the low-frequency band."]};
  }
  if(input.durationMs<=10&&input.peakDerivativeRatio>=18&&input.spectralCentroidHz>=2500){
    return {type:"digital-discontinuity",confidence:clamp01(0.7+Math.min(0.25,(input.peakDerivativeRatio-18)/50)),reasons:["Extremely abrupt broadband derivative is more consistent with a discontinuity than an analog click."]};
  }
  if(input.durationMs<=12){
    return {type:"click",confidence:0.78,reasons:["Single short impulse is consistent with a click."]};
  }
  if(input.durationMs<=80){
    return {type:"pop",confidence:0.7,reasons:["Single impulse duration is longer than a click but remains locally bounded."]};
  }
  return {type:"unknown",confidence:0.35,reasons:["Impulse evidence does not fit an admitted deterministic subtype."]};
}

export interface DeterministicRepairRoute{
  damageType:DamageType;
  operation?:RestorationRepairOperation;
  abstained:boolean;
  reasons:string[];
}

export function routeDeterministicRepair(damageType:DamageType,impulse?:ImpulseDamageClassification):DeterministicRepairRoute{
  if(damageType==="hum"||damageType==="buzz")return {damageType,operation:"dehum",abstained:false,reasons:["Tonal interference routes to bounded dehum."]};
  if(damageType==="hiss"||damageType==="broadband-noise")return {damageType,operation:"denoise",abstained:false,reasons:["Stationary broadband contamination routes to learned denoise evidence."]};
  if(damageType==="spectral-hole")return {damageType,operation:"spectral-repair",abstained:false,reasons:["Localized missing/corrupted spectral content routes to bounded spectral repair."]};
  if(damageType==="click"||damageType==="crackle"||damageType==="pop"||damageType==="impulse-noise"){
    if(impulse?.type==="digital-discontinuity")return {damageType,operation:"spectral-repair",abstained:false,reasons:["Broadband discontinuity is routed away from generic declick toward localized spectral repair."]};
    if(impulse&&impulse.confidence<0.5)return {damageType,abstained:true,reasons:["Impulse subtype confidence is insufficient for deterministic routing."]};
    return {damageType,operation:"declick",abstained:false,reasons:["Bounded analog-style impulse damage routes to declick."]};
  }
  return {damageType,abstained:true,reasons:["No deterministic repair in CONVERGENCE.3 is admitted for this damage type."]};
}
