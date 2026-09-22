import type { GrowthId } from '../domain/types.js';

export interface CreativeAbVariantObservation {
  variantId: GrowthId;
  exposures: number;
  conversions: number;
  spend?: number;
  revenue?: number;
  contributionMargin?: number;
}

export interface CreativeAbExperiment {
  id: GrowthId;
  controlVariantId: GrowthId;
  treatmentVariantIds: readonly GrowthId[];
  observations: readonly CreativeAbVariantObservation[];
  minimumExposuresPerVariant: number;
  significanceLevel?: number;
  minimumRelativeLift?: number;
  minimumContributionRoas?: number;
  maximumCac?: number;
}

export interface CreativeAbComparison {
  controlVariantId: GrowthId;
  treatmentVariantId: GrowthId;
  controlRate: number;
  treatmentRate: number;
  absoluteLift: number;
  relativeLift?: number;
  standardError: number;
  zScore: number;
  pValueTwoSided: number;
  confidenceLevel: number;
  confidenceInterval95: readonly [number,number];
  sampleSufficient: boolean;
  statisticallySignificant: boolean;
  economicsAdmissible: boolean;
  reasonCodes: readonly string[];
}

export interface CreativeAbAssessment {
  experimentId: GrowthId;
  comparisons: readonly CreativeAbComparison[];
  bestSupportedTreatmentId?: GrowthId;
  status: 'insufficient-data' | 'no-supported-lift' | 'supported-lift';
  authority: 'LEARNING_EVIDENCE_ONLY';
}

function erf(x:number):number{
  const sign=x<0?-1:1;
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const ax=Math.abs(x);
  const t=1/(1+p*ax);
  const y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-ax*ax);
  return sign*y;
}

function normalCdf(x:number):number{
  return 0.5*(1+erf(x/Math.SQRT2));
}

function validateObservation(obs:CreativeAbVariantObservation):void{
  if(!obs.variantId.trim())throw new Error('GROWTH_AB_VARIANT_ID_REQUIRED');
  if(!Number.isInteger(obs.exposures)||obs.exposures<0)throw new Error('GROWTH_AB_EXPOSURES_INVALID');
  if(!Number.isInteger(obs.conversions)||obs.conversions<0||obs.conversions>obs.exposures)throw new Error('GROWTH_AB_CONVERSIONS_INVALID');
  for(const [value,code] of [
    [obs.spend,'GROWTH_AB_SPEND_INVALID'],
    [obs.revenue,'GROWTH_AB_REVENUE_INVALID'],
    [obs.contributionMargin,'GROWTH_AB_CONTRIBUTION_MARGIN_INVALID'],
  ] as const){
    if(value!==undefined&&!Number.isFinite(value))throw new Error(code);
  }
  if(obs.spend!==undefined&&obs.spend<0)throw new Error('GROWTH_AB_SPEND_INVALID');
}

function economicsReasons(
  obs:CreativeAbVariantObservation,
  experiment:CreativeAbExperiment,
):string[]{
  const reasons:string[]=[];
  if(experiment.minimumContributionRoas!==undefined){
    if(obs.spend===undefined||obs.contributionMargin===undefined||obs.spend<=0){
      reasons.push('GROWTH_AB_CONTRIBUTION_ROAS_EVIDENCE_REQUIRED');
    }else if(obs.contributionMargin/obs.spend<experiment.minimumContributionRoas){
      reasons.push('GROWTH_AB_CONTRIBUTION_ROAS_BELOW_FLOOR');
    }
  }
  if(experiment.maximumCac!==undefined){
    if(obs.spend===undefined||obs.conversions<=0){
      reasons.push('GROWTH_AB_CAC_EVIDENCE_REQUIRED');
    }else if(obs.spend/obs.conversions>experiment.maximumCac){
      reasons.push('GROWTH_AB_CAC_ABOVE_CEILING');
    }
  }
  return reasons;
}

export function compareCreativeAbVariants(
  control:CreativeAbVariantObservation,
  treatment:CreativeAbVariantObservation,
  input:{
    minimumExposuresPerVariant:number;
    adjustedSignificanceLevel:number;
    minimumRelativeLift:number;
    minimumContributionRoas?:number;
    maximumCac?:number;
  },
):CreativeAbComparison{
  validateObservation(control);
  validateObservation(treatment);
  if(input.minimumExposuresPerVariant<1||!Number.isInteger(input.minimumExposuresPerVariant)){
    throw new Error('GROWTH_AB_MINIMUM_EXPOSURES_INVALID');
  }
  if(input.adjustedSignificanceLevel<=0||input.adjustedSignificanceLevel>=1){
    throw new Error('GROWTH_AB_SIGNIFICANCE_LEVEL_INVALID');
  }

  const controlRate=control.exposures?control.conversions/control.exposures:0;
  const treatmentRate=treatment.exposures?treatment.conversions/treatment.exposures:0;
  const absoluteLift=treatmentRate-controlRate;
  const relativeLift=controlRate>0?absoluteLift/controlRate:undefined;
  const totalExposure=control.exposures+treatment.exposures;
  const pooled=totalExposure? (control.conversions+treatment.conversions)/totalExposure : 0;
  const standardError=(control.exposures>0&&treatment.exposures>0)
    ?Math.sqrt(Math.max(0,pooled*(1-pooled)*(1/control.exposures+1/treatment.exposures)))
    :0;
  const zScore=standardError>0?absoluteLift/standardError:0;
  const pValueTwoSided=standardError>0?Math.min(1,2*(1-normalCdf(Math.abs(zScore)))):1;

  const unpooledSe=(control.exposures>0&&treatment.exposures>0)
    ?Math.sqrt(
      controlRate*(1-controlRate)/control.exposures+
      treatmentRate*(1-treatmentRate)/treatment.exposures
    )
    :0;
  const ci:[number,number]=[
    absoluteLift-1.959963984540054*unpooledSe,
    absoluteLift+1.959963984540054*unpooledSe,
  ];

  const reasonCodes:string[]=[];
  const sampleSufficient=
    control.exposures>=input.minimumExposuresPerVariant&&
    treatment.exposures>=input.minimumExposuresPerVariant;
  if(!sampleSufficient)reasonCodes.push('GROWTH_AB_SAMPLE_INSUFFICIENT');

  const significant=sampleSufficient&&pValueTwoSided<=input.adjustedSignificanceLevel;
  if(sampleSufficient&&!significant)reasonCodes.push('GROWTH_AB_NOT_STATISTICALLY_SIGNIFICANT');

  if(relativeLift===undefined){
    if(treatmentRate<=0)reasonCodes.push('GROWTH_AB_NO_POSITIVE_LIFT');
  }else if(relativeLift<input.minimumRelativeLift){
    reasonCodes.push('GROWTH_AB_LIFT_BELOW_MINIMUM');
  }

  const experimentForEconomics:CreativeAbExperiment={
    id:'economics-check',
    controlVariantId:control.variantId,
    treatmentVariantIds:[treatment.variantId],
    observations:[control,treatment],
    minimumExposuresPerVariant:input.minimumExposuresPerVariant,
    minimumContributionRoas:input.minimumContributionRoas,
    maximumCac:input.maximumCac,
  };
  reasonCodes.push(...economicsReasons(treatment,experimentForEconomics));
  const economicsAdmissible=!reasonCodes.some(code=>
    code.includes('CONTRIBUTION_ROAS')||code.includes('CAC_')
  );

  return Object.freeze({
    controlVariantId:control.variantId,
    treatmentVariantId:treatment.variantId,
    controlRate,
    treatmentRate,
    absoluteLift,
    relativeLift,
    standardError,
    zScore,
    pValueTwoSided,
    confidenceLevel:1-input.adjustedSignificanceLevel,
    confidenceInterval95:Object.freeze(ci) as readonly [number,number],
    sampleSufficient,
    statisticallySignificant:significant,
    economicsAdmissible,
    reasonCodes:Object.freeze([...new Set(reasonCodes)]),
  });
}

export function assessCreativeAbExperiment(experiment:CreativeAbExperiment):CreativeAbAssessment{
  if(!experiment.id.trim()||!experiment.controlVariantId.trim())throw new Error('GROWTH_AB_EXPERIMENT_ID_REQUIRED');
  if(!experiment.treatmentVariantIds.length)throw new Error('GROWTH_AB_TREATMENT_REQUIRED');
  if(new Set(experiment.treatmentVariantIds).size!==experiment.treatmentVariantIds.length){
    throw new Error('GROWTH_AB_TREATMENT_DUPLICATE');
  }
  if(experiment.treatmentVariantIds.includes(experiment.controlVariantId))throw new Error('GROWTH_AB_CONTROL_CANNOT_BE_TREATMENT');

  for(const observation of experiment.observations)validateObservation(observation);
  const byId=new Map(experiment.observations.map(obs=>[obs.variantId,obs] as const));
  const control=byId.get(experiment.controlVariantId);
  if(!control)throw new Error('GROWTH_AB_CONTROL_OBSERVATION_REQUIRED');

  const alpha=experiment.significanceLevel??0.05;
  if(alpha<=0||alpha>=1)throw new Error('GROWTH_AB_SIGNIFICANCE_LEVEL_INVALID');
  const adjustedAlpha=alpha/experiment.treatmentVariantIds.length;
  const minimumRelativeLift=experiment.minimumRelativeLift??0;

  const comparisons=experiment.treatmentVariantIds.map(treatmentId=>{
    const treatment=byId.get(treatmentId);
    if(!treatment)throw new Error(`GROWTH_AB_TREATMENT_OBSERVATION_REQUIRED:${treatmentId}`);
    return compareCreativeAbVariants(control,treatment,{
      minimumExposuresPerVariant:experiment.minimumExposuresPerVariant,
      adjustedSignificanceLevel:adjustedAlpha,
      minimumRelativeLift,
      minimumContributionRoas:experiment.minimumContributionRoas,
      maximumCac:experiment.maximumCac,
    });
  });

  const supported=comparisons
    .filter(item=>
      item.sampleSufficient&&
      item.statisticallySignificant&&
      item.economicsAdmissible&&
      item.absoluteLift>0&&
      !item.reasonCodes.includes('GROWTH_AB_LIFT_BELOW_MINIMUM')
    )
    .sort((a,b)=>b.absoluteLift-a.absoluteLift);

  const anyInsufficient=comparisons.some(item=>!item.sampleSufficient);
  return Object.freeze({
    experimentId:experiment.id,
    comparisons:Object.freeze(comparisons),
    ...(supported[0]?{bestSupportedTreatmentId:supported[0].treatmentVariantId}:{}),
    status:supported.length?'supported-lift':anyInsufficient?'insufficient-data':'no-supported-lift',
    authority:'LEARNING_EVIDENCE_ONLY',
  });
}
