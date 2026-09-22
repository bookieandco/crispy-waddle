export type ProductBootstrapView =
  | 'unknown'
  | 'hero'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'detail'
  | 'in-use';

export interface ProductReferenceUpload {
  id:string;
  assetId:string;
  sha256:string;
  view:ProductBootstrapView;
  rightsRef:string;
  evidenceIds:readonly string[];
}

export interface ProductReferenceBootstrapRequest {
  id:string;
  projectId:string;
  productId:string;
  displayName:string;
  uploads:readonly ProductReferenceUpload[];
  requiredLabelText?:readonly string[];
  requestedViews?:readonly ProductBootstrapView[];
}

export interface ProductReferenceBootstrapPlan {
  id:string;
  projectId:string;
  productId:string;
  canonicalUploadId:string;
  targetViews:readonly ProductBootstrapView[];
  buildLabelCloseups:boolean;
  stages:readonly (
    | 'admit-reference'
    | 'normalize'
    | 'multi-view'
    | 'label-closeups'
    | 'geometry'
    | 'qa'
    | 'lock'
  )[];
  authority:'PROPOSAL_ONLY';
}

export interface ProductDerivedReferenceCandidate {
  id:string;
  productId:string;
  assetId:string;
  sha256:string;
  view:ProductBootstrapView;
  parentReferenceAssetIds:readonly string[];
  identityScore:number;
  geometryScore:number;
  labelAccuracyScore:number;
  qualityScore:number;
  evidenceIds:readonly string[];
  generationAttemptId:string;
}

export function planProductReferenceBootstrap(
  request:ProductReferenceBootstrapRequest,
):ProductReferenceBootstrapPlan{
  if(!request.id.trim()||!request.projectId.trim()||!request.productId.trim()||!request.displayName.trim()){
    throw new Error('DIRECTOR_PRODUCT_BOOTSTRAP_IDENTITY_REQUIRED');
  }
  if(!request.uploads.length)throw new Error('DIRECTOR_PRODUCT_REFERENCE_REQUIRED');
  for(const upload of request.uploads){
    if(!upload.id.trim()||!upload.assetId.trim()||!upload.sha256.trim()||!upload.rightsRef.trim()||!upload.evidenceIds.length){
      throw new Error('DIRECTOR_PRODUCT_REFERENCE_INVALID');
    }
  }
  const canonical=[...request.uploads].sort((a,b)=>{
    const rank=(view:ProductBootstrapView)=>view==='front'?0:view==='hero'?1:view==='detail'?2:3;
    return rank(a.view)-rank(b.view)||a.id.localeCompare(b.id);
  })[0]!;
  const targetViews=request.requestedViews?.length
    ?[...new Set(request.requestedViews)]
    :['front','back','left','right','top','bottom','detail','in-use'] as ProductBootstrapView[];
  const buildLabelCloseups=(request.requiredLabelText?.length??0)>0;
  const stages: Array<ProductReferenceBootstrapPlan['stages'][number]> = [
    'admit-reference',
    'normalize',
    'multi-view',
    ...(buildLabelCloseups ? ['label-closeups' as const] : []),
    'geometry',
    'qa',
    'lock',
  ];
  return Object.freeze({
    id:request.id,
    projectId:request.projectId,
    productId:request.productId,
    canonicalUploadId:canonical.id,
    targetViews:Object.freeze(targetViews),
    buildLabelCloseups,
    stages:Object.freeze(stages),
    authority:'PROPOSAL_ONLY',
  });
}

export function evaluateProductDerivedReference(
  candidate:ProductDerivedReferenceCandidate,
  policy:{
    minimumIdentity:number;
    minimumGeometry:number;
    minimumLabelAccuracy:number;
    minimumQuality:number;
  },
):{admissible:boolean;score:number;reasons:readonly string[]}{
  const reasons:string[]=[];
  const values:Array<[number,number,string]>=[
    [candidate.identityScore,policy.minimumIdentity,'DIRECTOR_PRODUCT_IDENTITY_LOW'],
    [candidate.geometryScore,policy.minimumGeometry,'DIRECTOR_PRODUCT_GEOMETRY_LOW'],
    [candidate.labelAccuracyScore,policy.minimumLabelAccuracy,'DIRECTOR_PRODUCT_LABEL_ACCURACY_LOW'],
    [candidate.qualityScore,policy.minimumQuality,'DIRECTOR_PRODUCT_QUALITY_LOW'],
  ];
  for(const [value,minimum,code] of values){
    if(!Number.isFinite(value)||value<0||value>1)reasons.push('DIRECTOR_PRODUCT_REFERENCE_SCORE_INVALID');
    else if(value<minimum)reasons.push(code);
  }
  if(!candidate.parentReferenceAssetIds.length)reasons.push('DIRECTOR_PRODUCT_REFERENCE_PARENT_REQUIRED');
  if(!candidate.evidenceIds.length)reasons.push('DIRECTOR_PRODUCT_REFERENCE_EVIDENCE_REQUIRED');
  if(!candidate.generationAttemptId.trim())reasons.push('DIRECTOR_PRODUCT_REFERENCE_ATTEMPT_REQUIRED');
  const score=
    candidate.identityScore*0.35+
    candidate.geometryScore*0.25+
    candidate.labelAccuracyScore*0.25+
    candidate.qualityScore*0.15;
  return Object.freeze({admissible:reasons.length===0,score,reasons:Object.freeze([...new Set(reasons)])});
}

export function chooseBestProductReference(
  candidates:readonly ProductDerivedReferenceCandidate[],
  policy:{
    minimumIdentity:number;
    minimumGeometry:number;
    minimumLabelAccuracy:number;
    minimumQuality:number;
  },
):ProductDerivedReferenceCandidate|undefined{
  return [...candidates]
    .map(candidate=>({candidate,decision:evaluateProductDerivedReference(candidate,policy)}))
    .filter(item=>item.decision.admissible)
    .sort((a,b)=>b.decision.score-a.decision.score||a.candidate.id.localeCompare(b.candidate.id))[0]?.candidate;
}
