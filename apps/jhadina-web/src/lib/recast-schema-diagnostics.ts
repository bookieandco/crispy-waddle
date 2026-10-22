type ProbeError={code?:string|null;message?:string|null}|null|undefined
export type RecastRelationProbe =
  | 'READABLE'
  | 'MISSING_TABLE'
  | 'ACCESS_DENIED'
  | 'SERVICE_UNAVAILABLE'
export function classifyRecastRelationProbe(error:ProbeError):RecastRelationProbe{
  if(!error)return 'READABLE'
  const code=String(error.code??'').toUpperCase()
  const message=String(error.message??'').toLowerCase()
  if(code==='42P01'||code==='PGRST205'||/relation .+ does not exist/.test(message)||
    /could not find the table .+ in the schema cache/.test(message))return 'MISSING_TABLE'
  if(code==='42501'||code==='PGRST301'||/permission denied/.test(message))return 'ACCESS_DENIED'
  return 'SERVICE_UNAVAILABLE'
}
export type RecastSchemaDiagnosis=Readonly<{
  sourceBindingAvailable:boolean
  receiptStoreAvailable:boolean
  blockers:readonly string[]
  schemaDiagnostics:Readonly<{
    projectInputs:RecastRelationProbe
    reviewReceipts:RecastRelationProbe
    artifactStore:RecastRelationProbe
    castStore:RecastRelationProbe
  }>
  canMigrateAutomatically:false
  canRender:false
}>
export function diagnoseRecastSchema(input:{
  projectInputs:ProbeError
  reviewReceipts:ProbeError
  artifactStore:ProbeError
  castStore:ProbeError
}):RecastSchemaDiagnosis{
  const results={
    projectInputs:classifyRecastRelationProbe(input.projectInputs),
    reviewReceipts:classifyRecastRelationProbe(input.reviewReceipts),
    artifactStore:classifyRecastRelationProbe(input.artifactStore),
    castStore:classifyRecastRelationProbe(input.castStore),
  }
  const labels:Record<keyof typeof results,string>={
    projectInputs:'PROJECT_INPUTS',
    reviewReceipts:'REVIEW_RECEIPTS',
    artifactStore:'ARTIFACT_STORE',
    castStore:'CAST_STORE',
  }
  const blockers=(Object.entries(results) as [keyof typeof results,RecastRelationProbe][])
    .filter(([,value])=>value!=='READABLE')
    .map(([key,value])=>key==='projectInputs'&&value==='MISSING_TABLE'
      ? 'DIRECTOR_RECAST_WORKSTATION_PROJECT_INPUTS_MIGRATION_MISSING'
      : 'DIRECTOR_RECAST_'+labels[key]+'_'+value)
  return Object.freeze({
    sourceBindingAvailable:results.projectInputs==='READABLE'&&results.artifactStore==='READABLE',
    receiptStoreAvailable:results.reviewReceipts==='READABLE',
    blockers:Object.freeze(blockers),
    schemaDiagnostics:Object.freeze(results),
    canMigrateAutomatically:false,
    canRender:false,
  })
}
