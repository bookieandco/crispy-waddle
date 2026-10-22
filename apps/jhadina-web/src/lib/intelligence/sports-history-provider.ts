import {
  buildSportsHistoryView,
  type SportsHistoricalStatRecord,
  type SportsHistoryQuery,
  type SportsHistoryScope,
  type SportsHistoryView,
} from "@jhadina/money-core"

export type SportsHistoryProviderRequest=Readonly<{
  rawQuery:string
  scopes:readonly SportsHistoryScope[]
  statKeys:readonly string[]
  asOf:string
  league?:string
}>

export interface SportsHistoryProvider {
  query(input:SportsHistoryProviderRequest):Promise<SportsHistoryView|null>
}

type FetchLike=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>

function parseRecord(value:unknown):SportsHistoricalStatRecord{
  if(!value||typeof value!=="object")throw new Error("SPORT_HISTORY_PROVIDER_RECORD_INVALID")
  const v=value as Record<string,unknown>
  const text=(k:string)=>typeof v[k]==="string"?(v[k] as string).trim():""
  const number=(k:string)=>typeof v[k]==="number"&&Number.isFinite(v[k])?v[k] as number:Number.NaN
  const evidenceIds=Array.isArray(v.evidenceIds)?v.evidenceIds.filter((x):x is string=>typeof x==="string"&&Boolean(x.trim())):[]
  const record:SportsHistoricalStatRecord={
    recordId:text("recordId"),
    entityKind:v.entityKind==="TEAM"?"TEAM":"PLAYER",
    entityId:text("entityId"),
    entityLabel:text("entityLabel"),
    sport:text("sport"),
    competition:text("competition"),
    season:text("season"),
    eventId:text("eventId"),
    eventDate:text("eventDate"),
    ...(text("opponentId")?{opponentId:text("opponentId")}:{}),
    ...(text("opponentLabel")?{opponentLabel:text("opponentLabel")}:{}),
    ...(text("teamId")?{teamId:text("teamId")}:{}),
    ...(text("teamLabel")?{teamLabel:text("teamLabel")}:{}),
    venue:v.venue==="HOME"||v.venue==="AWAY"||v.venue==="NEUTRAL"?v.venue:"UNKNOWN",
    phase:v.phase==="REGULAR"||v.phase==="PLAYOFFS"||v.phase==="TOURNAMENT"||v.phase==="PRESEASON"||v.phase==="OTHER"?v.phase:"UNKNOWN",
    statKey:text("statKey"),
    statLabel:text("statLabel"),
    value:number("value"),
    ...(typeof v.numerator==="number"&&Number.isFinite(v.numerator)?{numerator:v.numerator}:{}),
    ...(typeof v.denominator==="number"&&Number.isFinite(v.denominator)?{denominator:v.denominator}:{}),
    ...(text("unit")?{unit:text("unit")}:{}),
    ...(typeof v.minutesOrOpportunities==="number"&&Number.isFinite(v.minutesOrOpportunities)?{minutesOrOpportunities:v.minutesOrOpportunities}:{}),
    observedAt:text("observedAt"),
    availableAt:text("availableAt"),
    sourceProvider:text("sourceProvider"),
    sourceClass:v.sourceClass==="DATASET"||v.sourceClass==="DERIVED"||v.sourceClass==="REFERENCE_ONLY"?v.sourceClass:"PRIMARY_API",
    evidenceIds:Object.freeze(evidenceIds),
    authority:"HISTORICAL_EVIDENCE_ONLY",
    canExecute:false,
  }
  return Object.freeze(record)
}

export function createProductionSportsHistoryProvider(options:{
  baseUrl?:string
  token?:string
  vercelBypassSecret?:string
  fetchImpl?:FetchLike
}={}):SportsHistoryProvider{
  const baseUrl=options.baseUrl??process.env.SPORTS_HISTORY_URL
  const token=options.token??process.env.SPORTS_HISTORY_TOKEN
  const vercelBypassSecret=options.vercelBypassSecret??process.env.SPORTS_HISTORY_VERCEL_BYPASS_SECRET
  const fetchImpl=options.fetchImpl??fetch
  return {
    async query(input){
      if(!baseUrl?.trim())return null
      // A protection-bypass token grants access to the provider's whole
      // deployment. Never send it to plain HTTP or a non-Vercel hostname.
      if(vercelBypassSecret){
        let target:URL
        try{target=new URL(baseUrl)}catch{throw new Error("SPORT_HISTORY_PROVIDER_BYPASS_TARGET_INVALID")}
        if(target.protocol!=="https:"||!target.hostname.endsWith(".vercel.app")){
          throw new Error("SPORT_HISTORY_PROVIDER_BYPASS_TARGET_FORBIDDEN")
        }
      }
      const response=await fetchImpl(baseUrl,{
        method:"POST",
        headers:{
          "content-type":"application/json",
          ...(token?{authorization:"Bearer "+token}:{}),
          ...(vercelBypassSecret?{"x-vercel-protection-bypass":vercelBypassSecret}:{})
        },
        body:JSON.stringify({
          query:input.rawQuery,
          league:input.league,
          statKeys:input.statKeys,
          maxSeasons:60,
          maxRecords:100000,
        }),
        cache:"no-store",
      })
      if(response.status===404||response.status===422)return null
      if(!response.ok)throw new Error("SPORT_HISTORY_PROVIDER_HTTP_"+response.status)
      const body=await response.json() as Record<string,unknown>
      const entity=body.entity&&typeof body.entity==="object"?body.entity as Record<string,unknown>:null
      const entityId=entity&&typeof entity.id==="string"?entity.id.trim():""
      if(!entityId)throw new Error("SPORT_HISTORY_PROVIDER_ENTITY_REQUIRED")
      const entityKind=entity?.kind==="TEAM"?"TEAM":"PLAYER"
      const sourceRecords=(Array.isArray(body.records)?body.records:[]).map(parseRecord)
      // NBA "all-time" career totals conventionally mean regular-season totals.
      // Do not silently add playoff scoring to the requested career stat.
      const nbaRegularSeason=input.league==="nba"&&!input.scopes.some(scope=>scope.kind==="PLAYOFFS")
      const records=Object.freeze(nbaRegularSeason
        ?sourceRecords.filter(record=>record.phase==="REGULAR")
        :sourceRecords)
      const excludedUnclassified=nbaRegularSeason&&sourceRecords.some(record=>record.phase==="UNKNOWN")
      const query:SportsHistoryQuery=Object.freeze({
        queryId:"ask-history:"+crypto.randomUUID(),
        entityKind,
        entityId,
        ...(input.league?{competition:input.league.toUpperCase()}:{}),
        ...(input.statKeys.length?{statKeys:Object.freeze([...input.statKeys])}:{}),
        scopes:Object.freeze([...input.scopes]),
        asOf:input.asOf,
        limit:100000,
      })
      return buildSportsHistoryView({
        query,
        records,
        providerClaimsAllTimeCoverage:body.providerClaimsAllTimeCoverage===true&&!excludedUnclassified,
        warnings:Object.freeze([
          ...(Array.isArray(body.warnings)?body.warnings.filter((x):x is string=>typeof x==="string"):[]),
          ...(nbaRegularSeason?["NBA career totals here use regular-season records; playoffs are excluded unless requested."]:[]),
          ...(excludedUnclassified?["Some NBA records had unknown game phase and were excluded; complete career coverage is not certified."]:[]),
        ]),
      })
    },
  }
}
