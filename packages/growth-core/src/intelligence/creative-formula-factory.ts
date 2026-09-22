import type { GrowthId } from '../domain/types.js';

export type FormulaNodeKind=
  |'product_input'
  |'image_generation'
  |'video_generation'
  |'text_overlay'
  |'audio_policy'
  |'loop'
  |'quality_control'
  |'output';

export interface CreativeFormulaNode{
  id:GrowthId;
  kind:FormulaNodeKind;
  inputs:readonly GrowthId[];
  config:Readonly<Record<string,unknown>>;
}

export interface CreativeFormula{
  id:GrowthId;
  name:string;
  description:string;
  nodes:readonly CreativeFormulaNode[];
  outputNodeId:GrowthId;
  authority:'PRODUCTION_PLAN_ONLY';
}

export interface ProductCreativeInput{
  productId:GrowthId;
  productName:string;
  productDescription?:string;
  primaryImageRef:string;
  landingUrl?:string;
}

export interface ProductVideoFormulaOptions{
  imageModel:string;
  videoModel:string;
  aspectRatio:'9:16'|'1:1'|'4:5';
  imageResolution:'1k'|'2k';
  videoResolution:'480p'|'720p'|'1080p';
  durationSeconds:number;
  reversePlayback:boolean;
  muteGeneratedAudio:boolean;
  overlayTemplate?:string;
  minimumQcScore:number;
}

export function createStoreDisplayFormula(
  options:ProductVideoFormulaOptions,
):CreativeFormula{
  if(options.durationSeconds<=0||options.durationSeconds>60)throw new Error('GROWTH_FORMULA_DURATION_INVALID');
  if(options.minimumQcScore<0||options.minimumQcScore>1)throw new Error('GROWTH_FORMULA_QC_THRESHOLD_INVALID');
  const nodes:CreativeFormulaNode[]=[
    {
      id:'formula-node:product',
      kind:'product_input',
      inputs:[],
      config:{fields:['productName','productDescription','primaryImageRef']},
    },
    {
      id:'formula-node:image',
      kind:'image_generation',
      inputs:['formula-node:product'],
      config:{
        model:options.imageModel,
        aspectRatio:options.aspectRatio,
        resolution:options.imageResolution,
        sceneInstruction:'Place the supplied product in a plausible retail environment appropriate to the product. Preserve product identity. Avoid invented price tags, store branding, or background people unless explicitly requested.',
      },
    },
    {
      id:'formula-node:video',
      kind:'video_generation',
      inputs:['formula-node:image'],
      config:{
        model:options.videoModel,
        resolution:options.videoResolution,
        durationSeconds:options.durationSeconds,
        motionInstruction:'Use restrained native handheld or slow-pan motion. Preserve product geometry and packaging. Do not invent new logos, labels, people, or product features.',
      },
    },
    {
      id:'formula-node:overlay',
      kind:'text_overlay',
      inputs:['formula-node:video','formula-node:product'],
      config:{
        template:options.overlayTemplate??'Why is {productName} suddenly everywhere?',
        userEditable:true,
        nativePlatformStyle:true,
      },
    },
    {
      id:'formula-node:audio',
      kind:'audio_policy',
      inputs:['formula-node:overlay'],
      config:{
        muteGeneratedAudio:options.muteGeneratedAudio,
        platformAudioAddedLater:true,
      },
    },
    {
      id:'formula-node:loop',
      kind:'loop',
      inputs:['formula-node:audio'],
      config:{reversePlayback:options.reversePlayback},
    },
    {
      id:'formula-node:qc',
      kind:'quality_control',
      inputs:['formula-node:loop','formula-node:product'],
      config:{
        minimumQcScore:options.minimumQcScore,
        checks:['product_identity','text_legibility','geometry','brand_integrity','no_unrequested_people','no_invented_claims'],
      },
    },
    {
      id:'formula-node:output',
      kind:'output',
      inputs:['formula-node:qc'],
      config:{requiresQcPass:true,autoPublish:false},
    },
  ];
  return Object.freeze({
    id:'creative-formula:store-display-v1',
    name:'Store Display',
    description:'Repeatable product-in-store short-form video formula with evidence-preserving QC.',
    nodes:Object.freeze(nodes),
    outputNodeId:'formula-node:output',
    authority:'PRODUCTION_PLAN_ONLY',
  });
}

export interface GeneratedCreativeCandidate{
  candidateId:GrowthId;
  productId:GrowthId;
  productIdentityScore:number;
  textLegibilityScore:number;
  geometryScore:number;
  brandIntegrityScore:number;
  noUnrequestedPeople:boolean;
  noInventedClaims:boolean;
  outputRef:string;
}

export interface CreativeQcResult{
  candidateId:GrowthId;
  qcScore:number;
  passed:boolean;
  reasonCodes:readonly string[];
}

export function evaluateGeneratedCreative(
  candidate:GeneratedCreativeCandidate,
  minimumQcScore=0.8,
):CreativeQcResult{
  if(minimumQcScore<0||minimumQcScore>1)throw new Error('GROWTH_FORMULA_QC_THRESHOLD_INVALID');
  const scores=[
    candidate.productIdentityScore,
    candidate.textLegibilityScore,
    candidate.geometryScore,
    candidate.brandIntegrityScore,
  ];
  if(scores.some(score=>!Number.isFinite(score)||score<0||score>1))throw new Error('GROWTH_FORMULA_QC_SCORE_INVALID');
  const qcScore=scores.reduce((sum,score)=>sum+score,0)/scores.length;
  const reasonCodes:string[]=[];
  if(candidate.productIdentityScore<minimumQcScore)reasonCodes.push('PRODUCT_IDENTITY_WEAK');
  if(candidate.textLegibilityScore<minimumQcScore)reasonCodes.push('TEXT_LEGIBILITY_WEAK');
  if(candidate.geometryScore<minimumQcScore)reasonCodes.push('GEOMETRY_WEAK');
  if(candidate.brandIntegrityScore<minimumQcScore)reasonCodes.push('BRAND_INTEGRITY_WEAK');
  if(!candidate.noUnrequestedPeople)reasonCodes.push('UNREQUESTED_PEOPLE');
  if(!candidate.noInventedClaims)reasonCodes.push('INVENTED_CLAIMS');
  return{
    candidateId:candidate.candidateId,
    qcScore,
    passed:qcScore>=minimumQcScore&&reasonCodes.length===0,
    reasonCodes:Object.freeze(reasonCodes),
  };
}

export interface BatchFormulaResult{
  total:number;
  passed:number;
  passRate:number;
  acceptedCandidateIds:readonly GrowthId[];
  rejectedCandidateIds:readonly GrowthId[];
  status:'accepted'|'needs_prompt_revision';
}

export function evaluateFormulaBatch(
  candidates:readonly GeneratedCreativeCandidate[],
  input:{minimumQcScore?:number;minimumPassRate?:number}={},
):BatchFormulaResult{
  if(!candidates.length)throw new Error('GROWTH_FORMULA_BATCH_REQUIRED');
  const minimumQcScore=input.minimumQcScore??0.8;
  const minimumPassRate=input.minimumPassRate??0.8;
  if(minimumPassRate<0||minimumPassRate>1)throw new Error('GROWTH_FORMULA_PASS_RATE_INVALID');
  const results=candidates.map(candidate=>evaluateGeneratedCreative(candidate,minimumQcScore));
  const accepted=results.filter(result=>result.passed).map(result=>result.candidateId);
  const rejected=results.filter(result=>!result.passed).map(result=>result.candidateId);
  const passRate=accepted.length/results.length;
  return{
    total:results.length,
    passed:accepted.length,
    passRate,
    acceptedCandidateIds:Object.freeze(accepted),
    rejectedCandidateIds:Object.freeze(rejected),
    status:passRate>=minimumPassRate?'accepted':'needs_prompt_revision',
  };
}
