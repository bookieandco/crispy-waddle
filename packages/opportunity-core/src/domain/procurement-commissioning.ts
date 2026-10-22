/**
 * PROCURE.01–.05: read-only procurement commissioning / review.
 * Source observations and candidate companies are NOT contracting authority.
 * Canonical Opportunity Core provider, quote, plan and commercial gates remain authoritative.
 */
import type { FulfillmentProvider, FulfillmentProviderCredentialKind } from './fulfillment-provider.js'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import type { ProviderQuote } from './provider-quote.js'
import { qualifyProviders } from './provider-qualification-team.js'
import { evaluateCommercialDeal, type CommercialAssumptions, type CommercialDealGate, type FulfillmentCommercialDealStructure } from './commercial-deal-gate.js'

const unique = (items:string[])=>[...new Set(items.map(x=>x.trim()).filter(Boolean))]
const validDate = (value:string|undefined)=>Boolean(value&&Number.isFinite(Date.parse(value)))
const finitePositive=(x:number|undefined)=>typeof x==='number'&&Number.isFinite(x)&&x>0
const explicitStamp=(value:string)=>/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
const normalize=(x:string)=>x.trim().toLowerCase().replace(/\s+/g,' ')
export type ProcurementSource={
 id:string;name:string;sourceUrl:string;stateCode:string;jurisdictionLevel:string;
 verificationStatus:'official_owner_verified'|'official_portal_verified'|'candidate'|'rejected';
 adapterStatus:'active'|'degraded'|'adapter_required'|'deferred'|'disabled';
 accessReviewStatus:'approved_public_official'|'approved_platform'|'pending'|'blocked';
 lastSeenAt?:string|null;lastTrialAt?:string|null;
 sourceKinds:string[];
}
export type ProcurementSourceDecision={
 sourceId:string;sourceUrl:string;action:'retrial'|'commission'|'monitor'|'manual_review'|'skip';
 priority:number;reasons:string[];blockers:string[];externalFetchAuthorized:false;
}
function sourceUrlKey(value:string):string{
 try{
  const u=new URL(value)
  if(!['https:','http:'].includes(u.protocol))return ''
  u.hash=''
  for(const key of [...u.searchParams.keys()])if(/^utm_|^(?:sortn|sortd|fbclid|gclid)$/i.test(key))u.searchParams.delete(key)
  u.searchParams.sort()
  return u.toString().replace(/\/$/,'')
 }catch{return ''}
}
/** .01: prioritize targeted source recovery, never make a fetch or falsely activate an adapter. */
export function planProcurementSourceRecovery(sources:ProcurementSource[],now=new Date().toISOString(),limit=50):ProcurementSourceDecision[]{
 if(!validDate(now))throw new Error('Valid recovery clock required')
 const seen=new Set<string>()
 const candidates=[...sources].sort((a,b)=>a.id.localeCompare(b.id))
 const plans=candidates.map(source=>{
  const blockers:string[]=[],reasons:string[]=[]
  const key=sourceUrlKey(source.sourceUrl)
  if(!key)blockers.push('Invalid source URL.')
  else if(seen.has(key))blockers.push('Duplicate URL or sort/tracking variant; reconcile source identity.')
  else seen.add(key)
  const verified=['official_owner_verified','official_portal_verified'].includes(source.verificationStatus)
  if(!verified)blockers.push('Official buyer/platform ownership is not verified.')
  if(!['approved_public_official','approved_platform'].includes(source.accessReviewStatus))blockers.push('Site access/robots review not approved.')
  if(source.adapterStatus==='disabled'||source.verificationStatus==='rejected')blockers.push('Source is disabled or rejected.')
  const last=source.lastSeenAt&&Date.parse(source.lastSeenAt)
  const stale=!(last&&Number.isFinite(last))||(Date.parse(now)-last)>7*86400000
  if(stale)reasons.push('Source observation older than seven days or missing.')
  if(source.jurisdictionLevel==='school_district')reasons.push('School purchasing priority.')
  if(source.stateCode.toUpperCase()==='CA')reasons.push('California reference coverage.')
  let action:ProcurementSourceDecision['action']='skip'
  if(blockers.length)action='manual_review'
  else if(source.adapterStatus==='degraded')action='retrial'
  else if(source.adapterStatus==='adapter_required'||source.adapterStatus==='deferred')action='commission'
  else if(source.adapterStatus==='active')action='monitor'
  const priority=(source.stateCode.toUpperCase()==='CA'?20:0)+(source.jurisdictionLevel==='school_district'?30:0)+
   (action==='retrial'?25:action==='commission'?15:action==='monitor'?5:0)+(stale?10:0)
  return {sourceId:source.id,sourceUrl:source.sourceUrl,action,priority,reasons,blockers,externalFetchAuthorized:false as const}
 })
 return plans.sort((a,b)=>b.priority-a.priority||a.sourceId.localeCompare(b.sourceId))
  .slice(0,Math.max(1,Math.min(250,Math.floor(limit)||50)))
}

export type ProcurementBuyerContact={
 name?:string;department?:string;role?:string;email?:string;phone?:string;
 evidenceRef:string;sourceUrl:string;publishedAt:string;
}
export type ProcurementDocument={
 id:string;kind:'solicitation'|'addendum'|'buyer_contact'|'specifications'|'forms'|'secondary';
 version:string;publishedAt:string;sourceUrl:string;official:boolean;evidenceRef:string;
 deadlineAt?:string;buyerContacts?:Omit<ProcurementBuyerContact,'evidenceRef'|'sourceUrl'|'publishedAt'>[];
 requiredForms?:string[];bodyText?:string;
 scopeRefs?:string[];
}
export type ProcurementNoticeReview={
 opportunityId:string;documents:ProcurementDocument[];
 selectedDeadline?:string;deadlineEvidenceRef?:string;
 buyerContacts:ProcurementBuyerContact[];requiredForms:string[];
 scopeRefs:string[];status:'review_required'|'source_verified';blockers:string[];
 outreachAuthorized:false;bidSubmissionAuthorized:false;
}
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const validPhone=(value:string)=>/[0-9]/.test(value)&&value.replace(/\D/g,'').length>=7
/** Parse only nearby procurement-labeled contact lines from a previously verified official document.
 * This is a candidate extraction, not an independent verification of the speaker/agency.
 */
export function extractOfficialBuyerContacts(text:string):Array<Omit<ProcurementBuyerContact,'evidenceRef'|'sourceUrl'|'publishedAt'>>{
 const lines=text.split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,2000)
 const contacts:Array<Omit<ProcurementBuyerContact,'evidenceRef'|'sourceUrl'|'publishedAt'>>=[]
 for(let i=0;i<lines.length&&contacts.length<12;i++){
  const line=lines[i]!
  const role=line.match(/^(?:point of contact|contracting officer|procurement contact|buyer|purchasing contact|purchasing officer)\s*[:\-]\s*(.*)$/i)
  if(!role)continue
  const block=lines.slice(i,Math.min(i+4,lines.length)).join(' ')
  const email=block.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]
  const phone=block.match(/(?:\+1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d+)?/i)?.[0]
  if(!email&&!phone)continue
  const roleName=line.split(/\s*[:\-]\s*/)[0]?.trim()
  const name=(role[1]??'').split(/\b(?:email|telephone|phone|tel)\s*:/i)[0]?.trim()
  contacts.push({role:roleName,name:name||undefined,email,phone})
 }
 return contacts
}
/** .02: structured official document and addendum reconciliation; secondary listings never override an official deadline. */
export function reconcileProcurementNotice(opportunityId:string,documents:ProcurementDocument[],now=new Date().toISOString()):ProcurementNoticeReview{
 if(!opportunityId.trim()||!validDate(now))throw new Error('Valid opportunity and clock required')
 const blockers:string[]=[]
 const ordered=documents.filter(d=>d.official&&d.kind!=='secondary'&&d.id.trim()&&d.evidenceRef.trim()&&d.sourceUrl.startsWith('https://')&&validDate(d.publishedAt))
  .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||b.version.localeCompare(a.version))
 if(!ordered.length)blockers.push('No source-identified official solicitation or addendum evidence.')
 if(!ordered.some(d=>d.kind==='solicitation'))blockers.push('Official solicitation document is missing.')
 if(!ordered.some(d=>d.kind==='specifications'||(d.scopeRefs??[]).length>0))blockers.push('Scope/specification references are missing.')
 const deadlines=ordered.filter(d=>d.deadlineAt!==undefined)
 const latest=deadlines[0]
 if(!latest)blockers.push('Official response deadline not established; validate continuous/RFSQ status separately.')
 else if(!latest.deadlineAt||!explicitStamp(latest.deadlineAt)||!validDate(latest.deadlineAt))blockers.push('Latest official deadline lacks a valid offset-aware timestamp.')
 else if(Date.parse(latest.deadlineAt)<=Date.parse(now))blockers.push('Official response deadline has passed.')
 if(deadlines.length>1&&deadlines[0]?.publishedAt===deadlines[1]?.publishedAt&&deadlines[0]?.deadlineAt!==deadlines[1]?.deadlineAt){
  blockers.push('Conflicting latest official deadlines require buyer clarification.')
 }
 const buyerContacts:ProcurementBuyerContact[]=[]
 const contactKeys=new Set<string>()
 for(const doc of ordered){
  for(const contact of doc.buyerContacts?.length?doc.buyerContacts:extractOfficialBuyerContacts(doc.bodyText??'')){
   const email=contact.email?.trim().toLowerCase()
   const phone=contact.phone?.trim()
   if(!((email&&validEmail(email))||(phone&&validPhone(phone))))continue
   const key=email||phone!
   if(contactKeys.has(key))continue
   contactKeys.add(key)
   buyerContacts.push({...contact,email,phone,evidenceRef:doc.evidenceRef,sourceUrl:doc.sourceUrl,publishedAt:doc.publishedAt})
  }
 }
 if(!buyerContacts.length)blockers.push('No source-attributed official buyer contact verified.')
 const requiredForms=unique(ordered.flatMap(d=>d.requiredForms??[]))
 const scopeRefs=unique(ordered.flatMap(d=>d.scopeRefs??[]))
 if(!requiredForms.length)blockers.push('Solicitation forms checklist is not evidenced.')
 return {opportunityId,documents:ordered,selectedDeadline:latest&&explicitStamp(latest.deadlineAt??'')&&validDate(latest.deadlineAt)?latest.deadlineAt:undefined,
  deadlineEvidenceRef:latest?.evidenceRef,buyerContacts,requiredForms,scopeRefs,
  status:blockers.length?'review_required':'source_verified',blockers:unique(blockers),outreachAuthorized:false,bidSubmissionAuthorized:false}
}

export type ProcurementProviderRequirements={
 stateCode?:string;primeProviderId?:string;
 mandatoryCredentials?:{kind:FulfillmentProviderCredentialKind;name:string}[];
 requireVerifiedInsurance?:boolean;requireVerifiedBond?:boolean;requireDirRegistration?:boolean;
 requireSetAsideCredential?:string;
}
export type ProcurementProviderReview={
 providerId:string;legalName:string;status:'qualified_candidate'|'review_required'|'blocked';
 evidenceRefs:string[];blockers:string[];humanApprovalRequired:true;outreachAuthorized:false;
}
function verifiedCredential(provider:FulfillmentProvider,kind:FulfillmentProviderCredentialKind,name:string,now:string):boolean{
 return provider.credentials.some(c=>c.kind===kind&&normalize(c.name).includes(normalize(name))&&c.verified&&
  (!c.expiresAt||(validDate(c.expiresAt)&&Date.parse(c.expiresAt)>Date.parse(now)))&&
  c.evidenceRefs.length>0&&c.evidenceRefs.every(id=>provider.evidence.some(e=>e.id===id&&e.relationship==='supports_credential'&&Boolean(e.sourceId))))
}
/** .03: qualify against actual canonical provider evidence, not a scraped directory match. */
export function verifyProcurementProviders(set:OpportunityRequirementSet,providers:FulfillmentProvider[],req:ProcurementProviderRequirements,now=new Date().toISOString()):ProcurementProviderReview[]{
 const ranked=qualifyProviders(set,providers,now)
 return providers.map(provider=>{
  const base=ranked.find(x=>x.providerId===provider.id)
  const blockers=[...(base?.blockers??[])]
  if(!set.requirements.some(r=>r.severity==='required'&&r.evidenceStatus==='explicit'&&r.kind==='capability'&&r.sourceEvidenceIds.length))blockers.push('No official evidence-backed required capability scope has been decomposed.')
  if(provider.verificationStatus!=='verified'||provider.stage!=='verified')blockers.push('Canonical provider verification is incomplete.')
  if(!provider.identifiers.some(id=>id.verified&&id.evidenceRefs.length&&id.evidenceRefs.every(ref=>provider.evidence.some(e=>e.id===ref&&e.relationship==='supports_identity'))))blockers.push('Verified legal identity is missing.')
  if(!provider.capabilities.some(c=>c.verified&&c.evidenceRefs.length&&c.evidenceRefs.every(ref=>provider.evidence.some(e=>e.id===ref&&e.relationship==='supports_capability'))))blockers.push('Verified required service capability is missing.')
  if(provider.capacity.status!=='available'||!provider.capacity.evidenceRefs.some(id=>provider.evidence.some(e=>e.id===id&&e.relationship==='supports_capacity')))blockers.push('Current documented available capacity is missing.')
  if(req.stateCode&& !provider.serviceAreas.some(s=>s.state?.toUpperCase()===req.stateCode?.toUpperCase()&&
   s.evidenceRefs.some(id=>provider.evidence.some(e=>e.id===id&&e.relationship==='supports_geography'))))blockers.push('Verified service coverage for '+req.stateCode+' is missing.')
  for(const c of req.mandatoryCredentials??[])if(!verifiedCredential(provider,c.kind,c.name,now))blockers.push('Required current credential missing: '+c.name+'.')
  if(req.requireVerifiedInsurance&&!verifiedCredential(provider,'insurance','insurance',now))blockers.push('Verified current insurance is missing.')
  if(req.requireVerifiedBond&&!verifiedCredential(provider,'bond','bond',now))blockers.push('Verified current bond is missing.')
  if(req.requireDirRegistration&&!verifiedCredential(provider,'registration','DIR',now))blockers.push('Verified current DIR registration is missing.')
  // Set-aside qualification is lead/prime-only. A subcontractor credential never cures prime eligibility.
  if(req.requireSetAsideCredential&&provider.id===req.primeProviderId&&
    !verifiedCredential(provider,'socioeconomic',req.requireSetAsideCredential,now))blockers.push('Prime set-aside eligibility is unverified.')
  if(req.requireSetAsideCredential&&!req.primeProviderId)blockers.push('Prime assignment is missing for set-aside evaluation.')
  const blocked=provider.verificationStatus==='rejected'||provider.stage==='rejected'||provider.capacity.status==='unavailable'||
   (base?.status==='blocked')
  return {providerId:provider.id,legalName:provider.legalName,status:blocked?'blocked':blockers.length?'review_required':'qualified_candidate',
   evidenceRefs:unique([...(base?.evidenceRefs??[]),...provider.evidence.map(x=>x.id)]),blockers:unique(blockers),
   humanApprovalRequired:true,outreachAuthorized:false}
 })
}

export type ProcurementCostEvidence={name:'directCost'|'overhead'|'contingency'|'acquisitionCost'|'financingCost';amount:number;evidenceRef:string}
export type ProcurementCommercialReview={
 opportunityId:string;structure:FulfillmentCommercialDealStructure;
 status:'blocked'|'review_required';gate?:CommercialDealGate;
 disclosedEconomics?:CommercialDealGate['economics'];blockers:string[];
 humanApprovalRequired:true;pricingAuthorized:false;paymentAuthorized:false;
}
const COST_FIELDS=['directCost','overhead','contingency','acquisitionCost','financingCost'] as const
/** .04: require accepted, unexpired, scope-matching firm quotes and evidence for all cost fields. */
export function reviewProcurementCommercial(input:{
 plan:FulfillmentPlan;providers:ProcurementProviderReview[];quotes:ProviderQuote[];
 priceToBuyer?:number;buyerPriceEvidenceRef?:string;costEvidence:ProcurementCostEvidence[];
 structure?:FulfillmentCommercialDealStructure;now?:string;minimumMarginPercent?:number;
}):ProcurementCommercialReview{
 const now=input.now??new Date().toISOString(),blockers:string[]=[]
 if(!validDate(now))throw new Error('Valid commercial clock required')
 const plan=input.plan
 const providerCosts:Record<string,number>={}
 if(!finitePositive(input.priceToBuyer)||!input.buyerPriceEvidenceRef?.trim())blockers.push('Firm buyer-facing price and evidence not recorded; budget estimate is not revenue.')
 if(!plan.assignments.length)blockers.push('No provider assignments cover the work.')
 if(plan.uncoveredRequirementIds.length||plan.blockers.length)blockers.push('Fulfillment plan is incomplete or blocked.')
 for(const assignment of plan.assignments){
  const q=input.providers.find(p=>p.providerId===assignment.providerId)
  if(!q||q.status!=='qualified_candidate')blockers.push('Provider qualification not cleared: '+assignment.providerId+'.')
  const quotes=input.quotes.filter(x=>x.providerId===assignment.providerId&&x.opportunityId===plan.opportunityId&&x.status==='accepted_for_model')
  const eligible=quotes.filter(x=>x.quoteEvidenceRef?.trim()&&typeof x.quotedAmount==='number'&&Number.isFinite(x.quotedAmount)&&x.quotedAmount>=0&&
   x.currency==='USD'&&(!x.validUntil||(validDate(x.validUntil)&&Date.parse(x.validUntil)>Date.parse(now)))&&
   assignment.requirementIds.length===x.requirementIds.length&&assignment.requirementIds.every(id=>x.requirementIds.includes(id)))
  if(eligible.length!==1)blockers.push('Exactly one current accepted and scope-matched USD vendor quote required: '+assignment.providerId+'.')
  else providerCosts[assignment.providerId]=eligible[0]!.quotedAmount!
 }
 const costs:Partial<Record<typeof COST_FIELDS[number],number>>={}
 for(const field of COST_FIELDS){
  const matches=input.costEvidence.filter(x=>x.name===field)
  if(matches.length!==1||!Number.isFinite(matches[0]?.amount)||matches[0]!.amount<0||!matches[0]?.evidenceRef.trim())
   blockers.push('Evidence-backed cost field required (including evidenced zero): '+field+'.')
  else costs[field]=matches[0]!.amount
 }
 const structure=input.structure??(plan.structure==='direct_fulfillment'?'direct_fulfillment':plan.structure==='teaming'?'teaming':'subcontract_margin')
 if(['referral','success_fee','percentage','joint_venture','unresolved'].includes(structure))blockers.push('This business structure requires separate procurement/legal review.')
 let gate:CommercialDealGate|undefined
 if(blockers.length===0){
  const assumptions:CommercialAssumptions={contractValue:input.priceToBuyer!,providerCosts,
   directCost:costs.directCost,overhead:costs.overhead,contingency:costs.contingency,
   acquisitionCost:costs.acquisitionCost,financingCost:costs.financingCost,
   minimumMarginPercent:input.minimumMarginPercent??10}
  gate=evaluateCommercialDeal(plan,assumptions,structure)
  blockers.push(...gate.blockers)
 }
 return {opportunityId:plan.opportunityId,structure,status:blockers.length?'blocked':'review_required',
  gate,disclosedEconomics:blockers.length?undefined:gate?.economics,blockers:unique(blockers),
  humanApprovalRequired:true,pricingAuthorized:false,paymentAuthorized:false}
}
export type ProcurementBidPacket={
 id:string;opportunityId:string;status:'blocked'|'operator_review_ready';
 sourceDocuments:{version:string;sourceUrl:string;evidenceRef:string}[];
 buyerContacts:ProcurementBuyerContact[];
 requiredForms:{name:string;attachmentEvidenceRef?:string;status:'provided'|'missing'}[];
 blockers:string[];providerIds:string[];totalBidPrice?:number;commercialSummary?:CommercialDealGate['economics'];
 reviewChecklist:string[];humanApprovalRequired:true;
 outreachAuthorized:false;bidSubmissionAuthorized:false;signatureAuthorized:false;paymentAuthorized:false;
}
/** .05: produce a bounded, no-send package; never certify a bid merely because an estimate/provider match exists. */
export function prepareProcurementBidPacket(input:{
 notice:ProcurementNoticeReview;plan:FulfillmentPlan;providers:ProcurementProviderReview[];
 commercial:ProcurementCommercialReview;formAttachments:Record<string,string>;
 now?:string;
}):ProcurementBidPacket{
 const now=input.now??new Date().toISOString(),blockers=[...input.notice.blockers,...input.commercial.blockers]
 if(input.notice.opportunityId!==input.plan.opportunityId||input.plan.opportunityId!==input.commercial.opportunityId)throw new Error('Procurement case opportunity mismatch')
 if(!input.notice.selectedDeadline||Date.parse(input.notice.selectedDeadline)<=Date.parse(now))blockers.push('Official deadline not verified or already closed.')
 if(!input.plan.assignments.length)blockers.push('Fulfillment plan has no assigned providers.')
 const involved=input.plan.assignments.map(x=>x.providerId)
 for(const id of involved)if(input.providers.find(p=>p.providerId===id)?.status!=='qualified_candidate')blockers.push('Provider is not qualified: '+id+'.')
 const requiredForms=input.notice.requiredForms.map(name=>({name,attachmentEvidenceRef:input.formAttachments[name]?.trim()||undefined,
  status:(input.formAttachments[name]?.trim()?'provided':'missing') as 'provided'|'missing'}))
 for(const form of requiredForms)if(form.status==='missing')blockers.push('Required submission form not attached: '+form.name+'.')
 if(!input.notice.scopeRefs.length)blockers.push('Specifications missing; scope cannot be validated.')
 if(!input.commercial.disclosedEconomics)blockers.push('Commercial economics cannot be disclosed without valid quote/cost evidence.')
 return {id:'procurement-review:'+input.notice.opportunityId,opportunityId:input.notice.opportunityId,
  status:unique(blockers).length?'blocked':'operator_review_ready',
  sourceDocuments:input.notice.documents.map(d=>({version:d.version,sourceUrl:d.sourceUrl,evidenceRef:d.evidenceRef})),
  buyerContacts:input.notice.buyerContacts,requiredForms,blockers:unique(blockers),providerIds:unique(involved),
  totalBidPrice:input.commercial.disclosedEconomics?.grossRevenue,
  commercialSummary:input.commercial.disclosedEconomics,
  reviewChecklist:['Confirm all official amendments, bid deadline and mandatory site walk.',
   'Confirm prime registration, licenses, DIR/prevailing-wage, subcontract limits, insurance and bonds.',
   'Review subcontractor/team agreements, qualifications, exclusions, warranties and delivery schedule.',
   'Validate firm quotes, fees, cash needs and profitability against the actual scope.',
   'Obtain separate human approval for every contact, bid submission, signature or expenditure.'],
  humanApprovalRequired:true,outreachAuthorized:false,bidSubmissionAuthorized:false,signatureAuthorized:false,paymentAuthorized:false}
}
