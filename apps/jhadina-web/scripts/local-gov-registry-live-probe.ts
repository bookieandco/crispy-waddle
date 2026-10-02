import { probePublicBuyerRegistrySources } from '../src/lib/opportunities/public-buyer-registry-runtime'

async function main(){
  const result=await probePublicBuyerRegistrySources()
  console.log(JSON.stringify(result))
  if(result.ipeds.publicInstitutions<100){
    throw new Error(`IPEDS_PUBLIC_INSTITUTION_COUNT_IMPLAUSIBLE:${result.ipeds.publicInstitutions}`)
  }
  if(result.census.probe.status!=='READY_FOR_FIXTURE_REVIEW'){
    throw new Error(`CENSUS_GOVERNMENT_UNITS_SCHEMA_UNRESOLVED:${result.census.probe.blockers.join('|')}`)
  }
  if(result.census.specialDistricts<100){
    throw new Error(`CENSUS_SPECIAL_DISTRICT_COUNT_IMPLAUSIBLE:${result.census.specialDistricts}`)
  }
}

main().catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error))
  process.exitCode=1
})
