export type SamProviderSourceReadiness={
  id:string
  role:'provider_discovery'|'provider_verification'|'opportunity_discovery'|'manual_verification'
  configured:boolean
  mode:string
  note:string
}

const present=(value:string|undefined)=>Boolean(value?.trim())

export function collectSamProviderSourceReadiness(env:Record<string,string|undefined>=process.env):SamProviderSourceReadiness[]{
  const samKey=present(env.SAM_GOV_API_KEY)
  return[
    {
      id:'sam_entity',
      role:'provider_verification',
      configured:samKey,
      mode:'official_api_key',
      note:'SAM Entity identity/registration/UEI/CAGE/NAICS/PSC evidence.',
    },
    {
      id:'usaspending',
      role:'provider_verification',
      configured:true,
      mode:'public_keyless_api',
      note:'Federal award-history evidence.',
    },
    {
      id:'exa',
      role:'provider_discovery',
      configured:present(env.EXA_API_KEY),
      mode:'commercial_api_key',
      note:'Broad company discovery only; identity/country/NAICS remain unverified until corroborated.',
    },
    {
      id:'fmcsa',
      role:'provider_verification',
      configured:true,
      mode:present(env.FMCSA_APP_TOKEN)?'public_api_with_optional_app_token':'public_keyless_api',
      note:'USDOT/carrier/cargo/fleet evidence. Safety interpretation remains informational only.',
    },
    {
      id:'fsis',
      role:'provider_verification',
      configured:present(env.FSIS_MPI_CSV_URL),
      mode:'official_csv',
      note:'Federally inspected meat/poultry/egg establishment evidence. Demographic CSV is optional.',
    },
    {
      id:'denue',
      role:'provider_discovery',
      configured:present(env.INEGI_DENUE_TOKEN),
      mode:'official_api_token',
      note:'Mexico INEGI DENUE business discovery; SCIAN-to-NAICS compatibility requires review.',
    },
    {
      id:'canada_importer',
      role:'provider_discovery',
      configured:true,
      mode:'official_keyless_dataset',
      note:'ISED Canadian Importers Database historical importer evidence.',
    },
    {
      id:'canada_odbusiness',
      role:'provider_discovery',
      configured:present(env.CANADA_ODBUS_CSV_URL),
      mode:'official_cached_csv',
      note:'Statistics Canada ODBus cache; source does not cover every Canadian business.',
    },
    {
      id:'paca',
      role:'manual_verification',
      configured:false,
      mode:'manual_only',
      note:'USDA PACA remains manual until a sanctioned machine-readable interface is verified.',
    },
    {
      id:'sba_dsbs',
      role:'manual_verification',
      configured:false,
      mode:'official_bulk_endpoint_unresolved',
      note:'SBA SBS/DSBS bulk data-mining must use the official FOIA/bulk route; interactive search is not scraped.',
    },
    {
      id:'sba_subnet',
      role:'opportunity_discovery',
      configured:true,
      mode:'public_sba_listing',
      note:'Prime-posted subcontracting opportunity feed, not provider verification evidence.',
    },
  ]
}

export function summarizeSamProviderSourceReadiness(readiness=collectSamProviderSourceReadiness()){
  return{
    total:readiness.length,
    configured:readiness.filter(source=>source.configured).length,
    providerDiscoveryConfigured:readiness.filter(source=>source.role==='provider_discovery'&&source.configured).map(source=>source.id),
    providerVerificationConfigured:readiness.filter(source=>source.role==='provider_verification'&&source.configured).map(source=>source.id),
    unavailable:readiness.filter(source=>!source.configured).map(source=>source.id),
    sources:readiness,
  }
}
