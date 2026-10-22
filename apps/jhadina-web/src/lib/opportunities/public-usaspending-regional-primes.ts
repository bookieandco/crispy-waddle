/**
 * USAspending / Treasury official federal award history, not local bidder
 * verification. Manual owner research only; no scheduler, persistence or outreach.
 */
import {US_STATE_AND_DC_CODES,type UsStateOrDcCode} from '@jhadina/opportunity-core'
const endpoint='https://api.usaspending.gov/api/v2/search/spending_by_award/'
type RawAward={'Award ID'?:unknown;'Recipient Name'?:unknown;'Award Amount'?:unknown}
export type TreasuryRegionalPrimeObservation={
 awardedPrimeName:string;awardId:string;historicalAwardAmount:number|null
 placeOfPerformanceState:UsStateOrDcCode
 sourceUrl:string;capturedAt:string;evidenceRef:string
 historicalFederalAwardOnly:true
 registeredVendorVerified:false;localLicenseVerified:false;capacityVerified:false
 partnerConsentVerified:false;quoteVerified:false
}
export async function researchFederalPrimeAwardHistory(input:{
 state:UsStateOrDcCode;startDate:string;endDate:string
 limit?:number;fetchImpl?:typeof fetch;now?:string
}){
 const {state,startDate,endDate}=input
 if(!US_STATE_AND_DC_CODES.some(s=>s===state))throw Error('A supported U.S. state/DC code is required')
 const date=/^\d{4}-\d{2}-\d{2}$/
 const a=Date.parse(startDate),b=Date.parse(endDate)
 if(!date.test(startDate)||!date.test(endDate)||!Number.isFinite(a)||!Number.isFinite(b)||
  b<a||b-a>3*366*86400_000)throw Error('Date window must be valid and <= 3 years')
 const limit=Math.min(25,Math.max(1,input.limit??20))
 if(!Number.isInteger(limit))throw Error('Integer result limit required')
 const now=input.now??new Date().toISOString()
 const fetchImpl=input.fetchImpl??fetch
 const response=await fetchImpl(endpoint,{
  method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
  body:JSON.stringify({
   filters:{
    time_period:[{start_date:startDate,end_date:endDate}],
    award_type_codes:['A','B','C','D'],
    place_of_performance_locations:[{country:'USA',state}],
   },
   fields:['Award ID','Recipient Name','Award Amount'],
   sort:'Award Amount',order:'desc',page:1,limit
  }),
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15_000),
 })
 if(!response.ok)throw Error('USASPENDING_HISTORY_HTTP_'+response.status)
 if(!(response.headers.get('content-type')??'').includes('application/json'))
  throw Error('USASPENDING_HISTORY_NOT_JSON')
 const raw=await response.json() as {results?:RawAward[]}
 if(!Array.isArray(raw.results))throw Error('USASPENDING_RESULTS_INVALID')
 const seen=new Set<string>()
 const observations:TreasuryRegionalPrimeObservation[]=[]
 for(const row of raw.results.slice(0,limit)){
  const awardId=typeof row['Award ID']==='string'?row['Award ID'].trim():''
  const name=typeof row['Recipient Name']==='string'?row['Recipient Name'].trim():''
  if(!awardId||!name||awardId.length>180||name.length>250||seen.has(awardId))continue
  seen.add(awardId)
  const amount=row['Award Amount']
  observations.push({
   awardedPrimeName:name,awardId,historicalAwardAmount:typeof amount==='number'&&Number.isFinite(amount)?amount:null,
   placeOfPerformanceState:state,sourceUrl:endpoint,capturedAt:now,
   evidenceRef:'usaspending:'+state+':'+encodeURIComponent(awardId)+':'+now,
   historicalFederalAwardOnly:true,registeredVendorVerified:false,localLicenseVerified:false,
   capacityVerified:false,partnerConsentVerified:false,quoteVerified:false,
  })
 }
 return {source:'USASpending_Treasury_v2',sourceUrl:endpoint,mode:'manual_read_only_federal_award_research',
  state,observedAt:now,observations,sampled:true,complete:false,
  workPerformedInStateDoesNotProveSupplierIsLocal:true,
  localPrimeEligibilityVerified:false,contactAuthorized:false,bidSubmissionAuthorized:false,
  signingAuthorized:false,spendingAuthorized:false}
}
