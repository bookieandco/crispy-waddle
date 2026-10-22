/**
 * PROCURE.COMMISSION.09–.10 — source-attributed first procurement pilot.
 * This is a research-only dossier, not a live vendor relationship or an award.
 */
export type PilotVendor = {
 id:string;name:string;capabilityClaim:string;sourceUrl:string;
 qualification:'research_candidate';quote:'not_requested';partnerConsent:'not_requested';
 requiredChecks:string[];
}
export type PilotProcurement = {
 id:string;buyer:string;title:string;kind:'school_rf_q'|'continuous_rfsq';
 officialSourceUrl:string;buyerContactSourceUrl:string;buyerPhone?:string;buyerEmail?:string;
 officialListingObservedAt:string;deadlineAt?:string;deadlineStatus:'source_listed'|'continuous_official';
 description:string;scopeComplete:false;requiredFormsVerified:false;addendaComplete:false;
 awardedContract:false;bidSubmitted:false;buyerContactVerifiedFromOfficialPage:boolean;
 candidates:PilotVendor[];blockers:string[];nextActions:string[];
}
export type PilotDocket = {
 snapshotAt:string;status:'research_only_no_send';opportunities:PilotProcurement[];
 outreachAuthorized:false;bidSubmissionAuthorized:false;signatureAuthorized:false;paymentAuthorized:false;
}
const truckVendors:PilotVendor[]=[
 {id:'fritts-ford-fleet',name:'Fritts Ford Fleet Center',capabilityClaim:'Ford commercial chassis, work trucks and custom box-truck upfits (advertised)',sourceUrl:'https://frittsfleet.com/customorders',qualification:'research_candidate',quote:'not_requested',partnerConsent:'not_requested',requiredChecks:['Exact vented body ventilation','Chassis/engine/payload and Ford-equivalent compliance','Stock and delivery before bid schedule','Tax/freight/upfit written quote','Dealership eligibility and public-sector terms']},
 {id:'sunrise-ford-pro',name:'Sunrise Ford Pro Fontana',capabilityClaim:'Fleet Ford truck and box-truck upfit inventory (advertised)',sourceUrl:'https://www.sunrisefordfleet.com/',qualification:'research_candidate',quote:'not_requested',partnerConsent:'not_requested',requiredChecks:['Exact vented body and spec equivalency','Delivery and allocation','Confirmed fleet quote','Authorized warranty and upfit certification']},
 {id:'envision-motors-fleet',name:'Envision Motors Fleet',capabilityClaim:'Government/commercial fleet orders, upfits and direct delivery (advertised)',sourceUrl:'https://envisionmotorsfleet.com/fleet-inland-empire/',qualification:'research_candidate',quote:'not_requested',partnerConsent:'not_requested',requiredChecks:['Exact body and emission/safety compliance','Availability and delivery plan','Validate claimed government eligibility independently','Written all-in fleet quote']},
]
export function assembleProcurementPilot(snapshotAt=new Date().toISOString()):PilotDocket{
 if(!Number.isFinite(Date.parse(snapshotAt)))throw new Error('Valid pilot snapshot timestamp required')
 const truck:PilotProcurement={
  id:'RUSD-2026-27-11',buyer:'Riverside Unified School District',
  title:'RFQ Nutrition Services Vented Box Truck',kind:'school_rf_q',
  officialSourceUrl:'https://webapps.riversideunified.org/apps/planholdersregistration/BidsSelect.aspx',
  buyerContactSourceUrl:'https://www.riversideunified.org/departments/business-services/purchasing',
  buyerPhone:'(951) 352-6729 x82601',
  officialListingObservedAt:'2026-10-22',deadlineAt:'2026-11-04T10:00:00-08:00',deadlineStatus:'source_listed',
  description:'One vented box truck for Nutrition Services. Model, ventilation, engine, registration, warranty, taxes, delivery and all bid-specific requirements await official planholder package.',
  scopeComplete:false,requiredFormsVerified:false,addendaComplete:false,awardedContract:false,bidSubmitted:false,
  buyerContactVerifiedFromOfficialPage:true,candidates:truckVendors,
  blockers:['Planholder registration and official PDF package not yet downloaded or version-certified.',
   'Addenda/site-visit/submission instructions unknown.',
   'Exact chassis, box ventilation and delivery specifications unverified.',
   'No provider consent, manufacturer compliance certificate, firm quote or capacity confirmation.',
   'Prime/vendor eligibility, purchase structure, financing, total cost and economics unverified.'],
  nextActions:['Register as RUSD planholder with an authorized business identity.',
   'Download latest RFQ PDF and all addenda, confirm deadline and response channel.',
   'Extract line-by-line vehicle specifications and mandatory forms.',
   'Review three advertised fleet candidates against the exact requirements.',
   'After separate approval, request written quotes and establish legally permissible prime/fulfillment role.',
   'Run canonical provider qualification, firm quote and commercial gates; prepare no-send proposal.']
 }
 const fasma:PilotProcurement={
  id:'LAC-GCS-10639-S',buyer:'Los Angeles County Internal Services Department',
  title:'Facility Ancillary Services Master Agreement (FASMA)',kind:'continuous_rfsq',
  officialSourceUrl:'https://camisvr.co.la.ca.us/LACoBids/BidLookUp/BidDetail?BidNumber=GCS-10639-S',
  buyerContactSourceUrl:'https://camisvr.co.la.ca.us/LACoBids/BidLookUp/BidDetail?BidNumber=GCS-10639-S',
  buyerPhone:'(323) 607-1153',buyerEmail:'FASMA@isd.lacounty.gov',
  officialListingObservedAt:'2026-10-22',deadlineStatus:'continuous_official',
  description:'Continuous qualifications for facility ancillary master agreements including as-needed custodial services. Qualification is not a funded task order or guaranteed revenue.',
  scopeComplete:false,requiredFormsVerified:false,addendaComplete:false,awardedContract:false,bidSubmitted:false,
  buyerContactVerifiedFromOfficialPage:true,
  candidates:[],blockers:['Full official RFSQ PDF, appendices and amendments still require controlled document intake.',
   'No qualified custodial provider verified for the selected service category.',
   'No statement-of-qualifications package, CBE form or employer/cost documentation confirmed.',
   'This is a continuous vendor qualification, not a priced award or revenue.'],
  nextActions:['Download two buyer-listed attachments and official amendments.',
   'Pick exact as-needed service category and all minimum qualifications.',
   'Find 2–3 providers with documented staffing, references, insurance and registration.',
   'Prepare no-send statement of qualifications for owner review.']
 }
 // Filtering is display-only: expired opportunities must not be advertised as available.
 if(Date.parse(truck.deadlineAt!)<=Date.parse(snapshotAt)){
  truck.blockers.push('Official listed RFQ deadline has passed; remove from active pursuing and verify any extension.')
 }
 return {snapshotAt,status:'research_only_no_send',opportunities:[truck,fasma],
  outreachAuthorized:false,bidSubmissionAuthorized:false,signatureAuthorized:false,paymentAuthorized:false}
}
