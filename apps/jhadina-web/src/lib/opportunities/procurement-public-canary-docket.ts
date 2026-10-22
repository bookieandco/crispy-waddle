/**
 * Official PUBLIC notice observations — NOT complete buyer bid packages.
 * Human-entered evidence from first-party buyer PDFs, dated 2026-10-22.
 * Never treat a public NIB or selected addendum as the full solicited document set.
 */
export type PublicNoticeCanary={
 id:string;sourceId:string;buyer:string;state:'CA';county:string
 specification:string;title:string;noticeUrl:string;officialBidListUrl:string
 submissionPortalUrl:string;deadlineLocal:string;timeZone:'America/Los_Angeles'
 scopeSummary:string;scopeDetailVerified:false;fullPlansVerified:false
 bidSecurityFraction:number|null;performanceBondFraction:number|null;paymentBondFraction:number|null
 requiredPrimeLicenseClass:string|null;dirRegistrationRequired:boolean|null
 prevailingWageRequired:boolean|null;retainageFraction:number|null
 addenda:Array<{number:number;url:string;summary:string;fullAttachmentsVerified:false;acknowledged:false}>
 sourceVerified:'official_public_notice';lastChecked:'2026-10-22';fullPortalDocumentSetComplete:false
 bidSubmissionAuthorized:false;contactAuthorized:false;priceVerified:false
 complianceEvidenceMissing:string[]
}
const buyer='City of Oxnard'
const officialBidListUrl='https://www.oxnard.gov/finance/purchasing/public-project-bidding'
const submissionPortalUrl='https://vendors.planetbids.com/portal/69575/portal-home'
const missing=[
 'Registered planholder access and current portal solicitations',
 'Complete bidder instructions, drawings, schedules and official Q&A',
 'All subsequent amendments with replacement plans and verified acknowledgments',
 'Specific required subcontractors, licenses, DIR verification, bond issuer and insurance',
 'Site and scope validation plus qualified prime/teaming consent',
 'Firm supplier/subcontractor quotes and total all-in costs',
 'Required buyer forms, cash-flow, retainage, warranty and owner approval'
]
export const PUBLIC_PROCUREMENT_CANARY_NOTICES:readonly PublicNoticeCanary[]=[
 {
  id:'OXNARD-PW-25-96',
  sourceId:'public-source:city:0654652:oxnard-official-public-project-bids-20261022',
  buyer,state:'CA',county:'Ventura',specification:'PW 25-96',
  title:'Well 20 Rehabilitation Project Phase II',
  noticeUrl:'https://www.oxnard.gov/wp-content/uploads/pdfs/departments/finance/nib-pw-25-96.pdf',
  officialBidListUrl,submissionPortalUrl,
  deadlineLocal:'2026-11-16T14:00:00',timeZone:'America/Los_Angeles',
  scopeSummary:'Public notice: replace Well 20 pump and aboveground piping, with mechanical equipment, electrical work, installation, start-up and commissioning.',
  scopeDetailVerified:false,fullPlansVerified:false,
  bidSecurityFraction:0.10,performanceBondFraction:1,paymentBondFraction:1,
  requiredPrimeLicenseClass:'A',dirRegistrationRequired:true,prevailingWageRequired:true,
  retainageFraction:0.05,
  addenda:[{number:1,url:'https://www.oxnard.gov/wp-content/uploads/pdfs/departments/finance/signed-addendum-no-1-pw-25-96.pdf',
   summary:'Replace original plan set with resized plans; full replacement drawings not independently verified.',
   fullAttachmentsVerified:false,acknowledged:false}],
  sourceVerified:'official_public_notice',lastChecked:'2026-10-22',fullPortalDocumentSetComplete:false,
  bidSubmissionAuthorized:false,contactAuthorized:false,priceVerified:false,
  complianceEvidenceMissing:[
   ...missing,'10% bid security must be delivered physically by deadline at City Clerk office',
   '10/22 pre-bid meeting has no verified attendance or minutes; do not claim site visit',
   '5% progress-payment retainage and 325 working-day schedule must be priced',
  ],
 },
 {
  id:'OXNARD-PW-24-109',
  sourceId:'public-source:city:0654652:oxnard-official-public-project-bids-20261022',
  buyer,state:'CA',county:'Ventura',specification:'PW 24-109',
  title:'John C. Zaragoza Oxnard Transit Center Improvements (Interior)',
  noticeUrl:'https://www.oxnard.gov/wp-content/uploads/pdfs/departments/finance/pw-24-109-john-zaragoza-otc-improvements.pdf',
  officialBidListUrl,submissionPortalUrl,
  deadlineLocal:'2026-10-28T14:00:00',timeZone:'America/Los_Angeles',
  scopeSummary:'Public notice: improve transit center building interior to meet ADA requirements; full drawings and detailed bid set remain in PlanetBids.',
  scopeDetailVerified:false,fullPlansVerified:false,
  bidSecurityFraction:0.10,performanceBondFraction:1,paymentBondFraction:1,
  requiredPrimeLicenseClass:'B',dirRegistrationRequired:true,prevailingWageRequired:true,
  retainageFraction:0.05,addenda:[],
  sourceVerified:'official_public_notice',lastChecked:'2026-10-22',fullPortalDocumentSetComplete:false,
  bidSubmissionAuthorized:false,contactAuthorized:false,priceVerified:false,
  complianceEvidenceMissing:[
   ...missing,'10% bid security must be delivered physically to City Clerk by bid deadline',
   'Original nonmandatory site meeting was 10/14; attendance/site conditions unverified',
   'State-grant contract obligations and 125-working-day timeline not verified against full package',
  ],
 },
] as const
export function readPublicProcurementCanary(id:string,asOfIso:string){
 const notice=PUBLIC_PROCUREMENT_CANARY_NOTICES.find(x=>x.id===id)
 if(!notice)return null
 const local=new Intl.DateTimeFormat('en-CA',{
  timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
 }).formatToParts(new Date(asOfIso))
 const get=(name:string)=>local.find(p=>p.type===name)?.value??'00'
 const now=get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute')+':'+get('second')
 return {...notice,
  deadlineState:now>=notice.deadlineLocal?'past_or_due':'future_listed_recheck_required' as const,
  officialListMayHaveChanged:true,fullBidDocumentSetCertified:false,
  externalActionAuthorized:false,proposalSubmissionAuthorized:false,
 }
}
