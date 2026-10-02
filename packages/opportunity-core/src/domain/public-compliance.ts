import type { UsStateOrDcCode } from './public-opportunity-grid.js'

export type PublicCompliancePhase='pre_bid'|'pre_award'|'performance'
export type PublicComplianceRequirementKind='license'|'registration'|'prevailing_wage'|'certified_payroll'|'apprenticeship'|'state_pack'

export type PublicComplianceRequirement={
  id:string
  label:string
  kind:PublicComplianceRequirementKind
  phase:PublicCompliancePhase
  evidenceRequired:boolean
  condition:string
  sourceUrls:string[]
}

export type PublicCompliancePack={
  id:string
  state:UsStateOrDcCode
  version:string
  status:'verified'|'discovery_required'
  sourceUrls:string[]
}

export type PublicPackageComplianceAssessment={
  pack:PublicCompliancePack
  status:'evidence_complete'|'review_required'|'blocked'
  requirements:PublicComplianceRequirement[]
  missingEvidenceIds:string[]
  blockers:string[]
  evidenceRefs:string[]
  legalConclusionAuthorized:false
  bidSubmissionAuthorized:false
}

export type PublicProviderComplianceAssessment={
  status:'evidence_complete'|'review_required'|'blocked'
  requiredEvidenceIds:string[]
  matchedEvidenceIds:string[]
  missingEvidenceIds:string[]
  reasons:string[]
  eligibilityConclusionAuthorized:false
}

const CA_DIR='https://www.dir.ca.gov/Public-Works/Contractor-Registration.html'
const CA_DIR_CONTRACTORS='https://www.dir.ca.gov/public-works/contractors.html'
const CA_DIR_PAYROLL='https://www.dir.ca.gov/Public-Works/Certified-Payroll-Reporting.html'
const CA_CSLB='https://www2.cslb.ca.gov/Contractors/Applicants/Contractors_License/Exam_Application/Before_Applying_For_License.aspx'
const CA_CSLB_CLASSES='https://cslb.ca.gov/About_Us/Library/Licensing_Classifications/'

export const CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK:PublicCompliancePack={
  id:'local-gov-compliance:CA:2026-10',
  state:'CA',
  version:'2026-10',
  status:'verified',
  sourceUrls:[CA_DIR,CA_DIR_CONTRACTORS,CA_DIR_PAYROLL,CA_CSLB,CA_CSLB_CLASSES],
}

export function publicCompliancePackForState(state:UsStateOrDcCode):PublicCompliancePack{
  if(state==='CA')return CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK
  return {
    id:`local-gov-compliance:${state}:discovery-required`,
    state,
    version:'discovery-required',
    status:'discovery_required',
    sourceUrls:[],
  }
}

const normalize=(value:string|undefined)=>value?.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()??''
const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]

function constructionLike(input:{label:string;description?:string;category?:string;keywords?:string[];requiredLicenses?:string[]}){
  const haystack=normalize([
    input.label,input.description??'',input.category??'',...(input.keywords??[]),...(input.requiredLicenses??[]),
  ].join(' '))
  return /\b(construction|contractor|building|electrical|plumb|roof|hvac|concrete|demolition|installation|repair|excavat|grading|road|highway|public works?)\b/.test(haystack)
}

function maintenanceLike(input:{label:string;description?:string;category?:string;keywords?:string[]}){
  const haystack=normalize([input.label,input.description??'',input.category??'',...(input.keywords??[])].join(' '))
  return /\bmaintenance\b/.test(haystack)
}

function californiaRequirements(input:{
  label:string
  description?:string
  category?:string
  keywords?:string[]
  requiredLicenses?:string[]
  estimatedValue?:{min?:number;max?:number;currency:string}
}):PublicComplianceRequirement[]{
  if(!constructionLike(input))return[]
  const maintenance=maintenanceLike(input)
  const amount=input.estimatedValue?.max??input.estimatedValue?.min
  const dirThreshold=maintenance?15_000:25_000
  const dirCondition=amount===undefined
    ?`Review whether this public-work scope is subject to California prevailing-wage registration; package value is unknown (small-project reference threshold ${dirThreshold}).`
    :amount>dirThreshold
      ?`Observed package value exceeds the California small-project reference threshold of ${dirThreshold} for ${maintenance?'maintenance':'construction'} work.`
      :`Observed package value does not itself establish an exemption; verify project/contract facts before relying on the small-project threshold.`

  return [
    {
      id:'CA_CSLB_LICENSE_IF_APPLICABLE',
      label:'Applicable California contractor license/classification',
      kind:'license',
      phase:'pre_bid',
      evidenceRequired:true,
      condition:'Construction contracting in California generally requires an active CSLB license/classification when licensure applies; project value, permits and worker use affect the exemption analysis.',
      sourceUrls:[CA_CSLB,CA_CSLB_CLASSES],
    },
    {
      id:'CA_DIR_PWCR_IF_APPLICABLE',
      label:'California DIR Public Works Contractor Registration',
      kind:'registration',
      phase:'pre_bid',
      evidenceRequired:true,
      condition:dirCondition,
      sourceUrls:[CA_DIR,CA_DIR_CONTRACTORS],
    },
    {
      id:'CA_PREVAILING_WAGE_REVIEW',
      label:'California prevailing-wage obligation review',
      kind:'prevailing_wage',
      phase:'pre_award',
      evidenceRequired:true,
      condition:'Determine the applicable prevailing-wage coverage and classification from the awarding-body/project evidence before pricing or commitment.',
      sourceUrls:[CA_DIR_CONTRACTORS],
    },
    {
      id:'CA_CERTIFIED_PAYROLL_PLAN',
      label:'California certified payroll reporting plan',
      kind:'certified_payroll',
      phase:'performance',
      evidenceRequired:false,
      condition:'Contractors and subcontractors on most California public works must maintain and submit certified payroll records, subject to documented exemptions.',
      sourceUrls:[CA_DIR_PAYROLL],
    },
    {
      id:'CA_APPRENTICESHIP_REVIEW',
      label:'California public-works apprenticeship review',
      kind:'apprenticeship',
      phase:'performance',
      evidenceRequired:false,
      condition:'Confirm apprenticeship obligations for the actual trade/project before performance.',
      sourceUrls:[CA_DIR_CONTRACTORS],
    },
  ]
}

export function assessPublicWorkPackageCompliance(input:{
  state:UsStateOrDcCode
  label:string
  description?:string
  category?:string
  keywords?:string[]
  requiredLicenses?:string[]
  requiredCertifications?:string[]
  estimatedValue?:{min?:number;max?:number;currency:string}
  evidenceIds?:string[]
}):PublicPackageComplianceAssessment{
  const pack=publicCompliancePackForState(input.state)
  const supplied=new Set(uniq(input.evidenceIds??[]))
  const requirements=pack.status==='verified'&&input.state==='CA'
    ?californiaRequirements(input)
    :[{
      id:`${input.state}_STATE_COMPLIANCE_PACK_REQUIRED`,
      label:`${input.state} state/local compliance pack required`,
      kind:'state_pack' as const,
      phase:'pre_bid' as const,
      evidenceRequired:true,
      condition:'State-specific licensing, registration, prevailing-wage and local vendor requirements must be verified from authoritative sources before eligibility is represented.',
      sourceUrls:[],
    }]

  for(const license of uniq(input.requiredLicenses??[])){
    requirements.push({
      id:`SOLICITATION_LICENSE:${license}`,
      label:`Solicitation-required license: ${license}`,
      kind:'license',
      phase:'pre_bid',
      evidenceRequired:true,
      condition:'Explicit scope/solicitation requirement.',
      sourceUrls:[],
    })
  }
  for(const certification of uniq(input.requiredCertifications??[])){
    requirements.push({
      id:`SOLICITATION_CERT:${certification}`,
      label:`Solicitation-required certification: ${certification}`,
      kind:'registration',
      phase:'pre_bid',
      evidenceRequired:true,
      condition:'Explicit scope/solicitation requirement.',
      sourceUrls:[],
    })
  }

  const missing=requirements.filter(req=>req.evidenceRequired&&!supplied.has(req.id)).map(req=>req.id)
  const blockers:string[]=[]
  if(pack.status==='discovery_required')blockers.push('Authoritative state-specific compliance pack has not been admitted yet.')
  if(missing.length)blockers.push(...missing.map(id=>`Missing compliance evidence: ${id}`))
  return {
    pack,
    status:blockers.length?'review_required':'evidence_complete',
    requirements,
    missingEvidenceIds:missing,
    blockers,
    evidenceRefs:uniq(requirements.flatMap(req=>req.sourceUrls)),
    legalConclusionAuthorized:false,
    bidSubmissionAuthorized:false,
  }
}

export function assessPublicProviderCompliance(input:{
  packageAssessment:PublicPackageComplianceAssessment
  providerEvidenceIds?:string[]
}):PublicProviderComplianceAssessment{
  const required=input.packageAssessment.requirements.filter(req=>req.evidenceRequired).map(req=>req.id)
  const matched=uniq(input.providerEvidenceIds??[]).filter(id=>required.includes(id))
  const missing=required.filter(id=>!matched.includes(id))
  const reasons:string[]=[]
  if(input.packageAssessment.pack.status==='discovery_required')reasons.push('State-specific compliance pack is not yet authoritative.')
  if(missing.length)reasons.push(...missing.map(id=>`Provider evidence missing: ${id}`))
  return {
    status:missing.length||input.packageAssessment.pack.status==='discovery_required'?'review_required':'evidence_complete',
    requiredEvidenceIds:required,
    matchedEvidenceIds:matched,
    missingEvidenceIds:missing,
    reasons,
    eligibilityConclusionAuthorized:false,
  }
}
