/**
 * Commissioning queue for 80k+ inventoried jurisdictions. Prioritizes
 * bounded *review*, never authorizes source fetch, contact, bidding or writes.
 */
export type NationalPursuitSeed={
 id:string;state:string;buyer:string;title?:string;publicNoticeUrl:string|null
 listedDeadlineLocal:string|null;localTimeZone:string|null
 officialBuyerVerified:boolean;accessReviewed:boolean;parserCertified:boolean
 fullSolicitationCertified:boolean;licensedPrimeQualified:boolean
 scopeSpecificPartnerConsent:boolean;firmQuoteVerified:boolean
}
export function prioritizeNationalProcurementBatch(input:{
 candidates:NationalPursuitSeed[];asOf:string;maxBatch?:number
}){
 const maxBatch=input.maxBatch??3
 if(!Number.isInteger(maxBatch)||maxBatch<1||maxBatch>10)throw Error('A 1–10-source review batch is required')
 if(!Number.isFinite(Date.parse(input.asOf)))throw Error('Current observation time required')
 const pending=input.candidates.map(c=>{
  const blockers:string[]=[]
  if(!/^[A-Z]{2}$/.test(c.state)||!c.id.trim()||!c.buyer.trim())blockers.push('canonical_buyer_identity_required')
  if(!c.officialBuyerVerified||!c.publicNoticeUrl)blockers.push('official_publisher_or_notice_missing')
  if(!c.accessReviewed)blockers.push('access_terms_review_missing')
  if(!c.parserCertified)blockers.push('active_parser_uncertified')
  if(!c.fullSolicitationCertified)blockers.push('complete_buyer_documents_missing')
  if(!c.licensedPrimeQualified)blockers.push('scope_specific_prime_qualification_missing')
  if(!c.scopeSpecificPartnerConsent)blockers.push('scope_specific_partner_consent_missing')
  if(!c.firmQuoteVerified)blockers.push('written_firm_quotes_missing')
  const deadline=c.listedDeadlineLocal
  let deadlineState:'not_proven'|'future_listed'|'past_or_due'='not_proven'
  if(deadline&&c.localTimeZone){
   // A local time without reliable zone resolution cannot be compared with
   // UTC by assuming an offset (DST differences matter).
   try{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:c.localTimeZone,year:'numeric',month:'2-digit',
      day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(input.asOf))
    const get=(k:string)=>parts.find(x=>x.type===k)?.value??'00'
    const now=get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute')+':'+get('second')
    deadlineState=now>=deadline?'past_or_due':'future_listed'
   }catch{deadlineState='not_proven'}
  }
  if(deadlineState==='past_or_due')blockers.push('deadline_past_or_due_recheck_buyer')
  if(deadlineState==='not_proven')blockers.push('official_deadline_unverified')
  const reviewScore=(c.officialBuyerVerified?25:0)+(c.accessReviewed?10:0)+(c.parserCertified?20:0)+
    (c.fullSolicitationCertified?15:0)+(c.licensedPrimeQualified?10:0)+
    (c.scopeSpecificPartnerConsent?10:0)+(c.firmQuoteVerified?10:0)
  return {id:c.id,buyer:c.buyer,state:c.state,title:c.title??c.id,listedDeadlineLocal:c.listedDeadlineLocal,reviewScore,deadlineState,
    blockers,canEnterManualResearch:c.officialBuyerVerified&&deadlineState==='future_listed',
    bidReady:false,sourceFetchAuthorized:false,contractorContactAuthorized:false,
    bidSubmissionAuthorized:false,paymentAuthorized:false}
 })
 const ranked=pending.sort((a,b)=>Number(b.canEnterManualResearch)-Number(a.canEnterManualResearch)||
  b.reviewScore-a.reviewScore||
  (a.deadlineState==='future_listed'&&b.deadlineState==='future_listed'?
   (a.listedDeadlineLocal??'').localeCompare(b.listedDeadlineLocal??''):0)||
  a.id.localeCompare(b.id))
 return {asOf:input.asOf,selected:ranked.slice(0,maxBatch),considered:ranked.length,
  skippedAfterBatch:Math.max(0,ranked.length-maxBatch),
  sourceJobsActivated:0,automatedCrawlerActivated:false,
  outreachAuthorized:false,signaturesAuthorized:false,tradingAuthorized:false}
}
