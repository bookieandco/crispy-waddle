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
  minimumConversionsPerVariant?: number;
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
  adjustedConfidenceLevel: number;
  confidenceInterval95: readonly [number,number];
  adjustedConfidenceInterval: readonly [number,number];
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

function inverseNormalCdf(p:number):number{
  if(!(p>0&&p<1))throw new Error('GROWTH_AB_NORMAL_QUANTILE_INVALID');
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
  const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
  const cc=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
  const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  const plow=0.02425;
  const phigh=1-plow;
  if(p<plow){
    const q=Math.sqrt(-2*Math.log(p));
    return (((((cc[0]!*q+cc[1]!)*q+cc[2]!)*q+cc[3]!)*q+cc[4]!)*q+cc[5]!)/((((d[0]!*q+d[1]!)*q+d[2]!)*q+d[3]!)*q+1);
  }
  if(p>phigh){
    const q=Math.sqrt(-2*Math.log(1-p));
    return -(((((cc[0]!*q+cc[1]!)*q+cc[2]!)*q+cc[3]!)*q+cc[4]!)*q+cc[5]!)/((((d[0]!*q+d[1]!)*q+d[2]!)*q+d[3]!)*q+1);
  }
  const q=p-0.5;
  const r=q*q;
  return (((((a[0]!*r+a[1]!)*r+a[2]!)*r+a[3]!)*r+a[4]!)*r+a[5]!)*q/(((((b[0]!*r+b[1]!)*r+b[2]!)*r+b[3]!)*r+b[4]!)*r+1);
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
    minimumConversionsPerVariant:number;
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
  const ci95:[number,number]=[
    absoluteLift-1.959963984540054*unpooledSe,
    absoluteLift+1.959963984540054*unpooledSe,
  ];
  const adjustedCritical=inverseNormalCdf(1-input.adjustedSignificanceLevel/2);
  const adjustedCi:[number,number]=[
    absoluteLift-adjustedCritical*unpooledSe,
    absoluteLift+adjustedCritical*unpooledSe,
  ];

  const reasonCodes:string[]=[];
  const exposureSufficient=
    control.exposures>=input.minimumExposuresPerVariant&&
    treatment.exposures>=input.minimumExposuresPerVariant;
  const conversionSufficient=
    control.conversions>=input.minimumConversionsPerVariant&&
    treatment.conversions>=input.minimumConversionsPerVariant;
  const sampleSufficient=exposureSufficient&&conversionSufficient;
  if(!exposureSufficient)reasonCodes.push('GROWTH_AB_SAMPLE_INSUFFICIENT');
  if(!conversionSufficient)reasonCodes.push('GROWTH_AB_CONVERSIONS_INSUFFICIENT');

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
    minimumConversionsPerVariant:input.minimumConversionsPerVariant,
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
    adjustedConfidenceLevel:1-input.adjustedSignificanceLevel,
    confidenceInterval95:Object.freeze(ci95) as readonly [number,number],
    adjustedConfidenceInterval:Object.freeze(adjustedCi) as readonly [number,number],
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

  const expectedVariantIds=new Set([experiment.controlVariantId,...experiment.treatmentVariantIds]);
  const seenObservationIds=new Set<string>();
  for(const observation of experiment.observations){
    validateObservation(observation);
    if(!expectedVariantIds.has(observation.variantId))throw new Error(`GROWTH_AB_OBSERVATION_UNKNOWN:${observation.variantId}`);
    if(seenObservationIds.has(observation.variantId))throw new Error(`GROWTH_AB_OBSERVATION_DUPLICATE:${observation.variantId}`);
    seenObservationIds.add(observation.variantId);
  }
  const byId=new Map(experiment.observations.map(obs=>[obs.variantId,obs] as const));
  const control=byId.get(experiment.controlVariantId);
  if(!control)throw new Error('GROWTH_AB_CONTROL_OBSERVATION_REQUIRED');

  const alpha=experiment.significanceLevel??0.05;
  if(alpha<=0||alpha>=1)throw new Error('GROWTH_AB_SIGNIFICANCE_LEVEL_INVALID');
  const adjustedAlpha=alpha/experiment.treatmentVariantIds.length;
  const minimumRelativeLift=experiment.minimumRelativeLift??0;
  const minimumConversionsPerVariant=experiment.minimumConversionsPerVariant??0;
  if(!Number.isInteger(minimumConversionsPerVariant)||minimumConversionsPerVariant<0){
    throw new Error('GROWTH_AB_MINIMUM_CONVERSIONS_INVALID');
  }

  const comparisons=experiment.treatmentVariantIds.map(treatmentId=>{
    const treatment=byId.get(treatmentId);
    if(!treatment)throw new Error(`GROWTH_AB_TREATMENT_OBSERVATION_REQUIRED:${treatmentId}`);
    return compareCreativeAbVariants(control,treatment,{
      minimumExposuresPerVariant:experiment.minimumExposuresPerVariant,
      minimumConversionsPerVariant,
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
