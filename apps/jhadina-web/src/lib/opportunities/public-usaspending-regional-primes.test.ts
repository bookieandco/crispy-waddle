import {test,expect} from 'vitest'
import {researchFederalPrimeAwardHistory} from './public-usaspending-regional-primes'

test('bounded federal history never certifies an incumbent or sends outreach',async()=>{
 let observed:unknown
 const fake=async (_url:RequestInfo|URL,init?:RequestInit)=>{
  observed=JSON.parse(String(init?.body))
  return new Response(JSON.stringify({results:[
   {'Award ID':'123','Recipient Name':'Example federal contractor','Award Amount':1000000},
   {'Award ID':'123','Recipient Name':'Duplicate','Award Amount':1000000},
   {'Award ID':'456','Recipient Name':'Second candidate','Award Amount':500000},
  ]}),{status:200,headers:{'content-type':'application/json'}})
 }
 const response=await researchFederalPrimeAwardHistory({state:'CA',startDate:'2025-10-01',endDate:'2026-10-01',
  limit:3,fetchImpl:fake as typeof fetch,now:'2026-10-22T18:00:00Z'})
 expect(response.observations).toHaveLength(2)
 expect(response.observations[0]?.partnerConsentVerified).toBe(false)
 expect(response.observations[0]?.capacityVerified).toBe(false)
 expect(response.localPrimeEligibilityVerified).toBe(false)
 expect(response.complete).toBe(false)
 expect(response.contactAuthorized).toBe(false)
 expect((observed as {filters:{award_type_codes:string[];place_of_performance_locations:Array<{state:string}>}}).filters.award_type_codes).toEqual(['A','B','C','D'])
 expect((observed as {filters:{place_of_performance_locations:Array<{state:string}>}}).filters.place_of_performance_locations[0].state).toBe('CA')
})
test('invalid state and date windows fail before fetching',async()=>{
 await expect(researchFederalPrimeAwardHistory({state:'XX' as 'CA',startDate:'2025-01-01',endDate:'2026-10-22'})).rejects.toThrow()
 await expect(researchFederalPrimeAwardHistory({state:'CA',startDate:'2020-01-01',endDate:'2026-10-22'})).rejects.toThrow()
})
test('response with invalid content type is rejected',async()=>{
 const fake=async()=>new Response('not an official JSON result',{status:200,headers:{'content-type':'text/html'}})
 await expect(researchFederalPrimeAwardHistory({state:'CA',startDate:'2025-01-01',endDate:'2026-10-22',
  fetchImpl:fake as typeof fetch})).rejects.toThrow('NOT_JSON')
})
