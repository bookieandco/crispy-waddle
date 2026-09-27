import { createHash } from 'node:crypto'
import type {
  SportsLatentFactor,
  SportsPlayerStatModel,
  SportsSimMarketLeg,
  SportsSimSport,
  SportsSimulationRequestedStat,
  SportsTeamScoreModel,
} from '@jhadina/money-core'
import type {
  SportsSimulationContextProvider,
  SportsSimulationResolvedContext,
} from './ask-sports-simulation-command'

export type SportsEventProviderSnapshot=Readonly<{
  snapshotId:string
  providerId:'thesportsdb'
  providerEventId:string
  eventId:string
  eventLabel:string
  sport:SportsSimSport
  league?:string
  scheduledAt?:string
  status:'SCHEDULED'|'LIVE'|'FINAL'|'UNKNOWN'
  progress?:string
  homeTeam:string
  awayTeam:string
  homeScore:number
  awayScore:number
  observedAt:string
  receivedAt:string
  evidenceIds:readonly string[]
  sourceMode:'V1_EVENT_SEARCH'|'V2_LIVESCORE'
  authority:'EVENT_REALITY_ONLY'
  canProject:false
  canExecute:false
}>

export type SportsSimulationModelInputs=Readonly<{
  modelSnapshotId:string
  eventId:string
  modelVersion:string
  observedAt:string
  teamModels:readonly SportsTeamScoreModel[]
  playerModels:readonly SportsPlayerStatModel[]
  latentFactors:readonly SportsLatentFactor[]
  marketLegs:readonly SportsSimMarketLeg[]
  jointSets:readonly Readonly<{jointId:string;legIds:readonly string[]}>[]
  heavyTailRegimeBps:number
  requestedStats:readonly SportsSimulationRequestedStat[]
  assumptions:readonly string[]
  scenarioNotes:readonly string[]
  warnings:readonly string[]
  evidenceIds:readonly string[]
  authority:'SIMULATION_MODEL_INPUT_ONLY'
  canExecute:false
}>

export interface SportsEventResolver {
  resolve(input:{query:string;liveRequested:boolean}):Promise<SportsEventProviderSnapshot|null>
}

export interface SportsSimulationModelInputProvider {
  resolve(input:{
    event:SportsEventProviderSnapshot
    activeTask:string
    liveRequested:boolean
  }):Promise<SportsSimulationModelInputs|null>
}

type FetchLike=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>

const DEFAULT_V1_BASE='https://www.thesportsdb.com/api/v1/json'
const DEFAULT_V2_BASE='https://www.thesportsdb.com/api/v2/json'
const DEFAULT_V1_KEY='123'

const SPORT_MAP:Record<string,SportsSimSport>={
  'american football':'FOOTBALL',
  'football':'FOOTBALL',
  'basketball':'BASKETBALL',
  'baseball':'BASEBALL',
  'ice hockey':'HOCKEY',
  'hockey':'HOCKEY',
  'tennis':'TENNIS',
  'boxing':'BOXING',
  'soccer':'SOCCER',
}

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()
const stringOrEmpty=(value:unknown)=>typeof value==='string'?value.trim():''
const numberOrZero=(value:unknown)=>{const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)?n:0}

function parseSport(value:unknown):SportsSimSport{
  const sport=SPORT_MAP[normalize(stringOrEmpty(value))]
  if(!sport)throw new Error('SPORT_CONTEXT_UNSUPPORTED_SPORT')
  return sport
}

function eventNames(row:Record<string,unknown>){
  const home=stringOrEmpty(row.strHomeTeam??row.homeTeam)
  const away=stringOrEmpty(row.strAwayTeam??row.awayTeam)
  const label=stringOrEmpty(row.strEvent??row.event)||[home,away].filter(Boolean).join(' vs ')
  if(!home||!away||!label)throw new Error('SPORT_CONTEXT_EVENT_TEAMS_REQUIRED')
  return {home,away,label}
}

function providerEventId(row:Record<string,unknown>):string{
  const id=stringOrEmpty(row.idEvent??row.eventId)
  if(!id)throw new Error('SPORT_CONTEXT_EVENT_ID_REQUIRED')
  return id
}

function canonicalEventId(row:Record<string,unknown>):string{
  return 'thesportsdb:'+providerEventId(row)
}

function parseScheduledAt(row:Record<string,unknown>):string|undefined{
  const date=stringOrEmpty(row.dateEvent??row.date)
  const time=stringOrEmpty(row.strTime??row.time)
  if(!date)return undefined
  const parsed=Date.parse(date+'T'+(time||'00:00:00'))
  return Number.isNaN(parsed)?undefined:new Date(parsed).toISOString()
}

function parseStatus(row:Record<string,unknown>,live:boolean):SportsEventProviderSnapshot['status']{
  const raw=normalize([
    stringOrEmpty(row.strStatus??row.status),
    stringOrEmpty(row.strProgress??row.progress),
  ].filter(Boolean).join(' '))
  if(/(final|finished|ended|complete)/.test(raw))return 'FINAL'
  if(live||/(quarter|period|inning|half|round|set|live|[0-9]{1,2}:[0-9]{2})/.test(raw))return 'LIVE'
  if(/(scheduled|not started|pre)/.test(raw))return 'SCHEDULED'
  return live?'LIVE':'SCHEDULED'
}

function matchScore(query:string,row:Record<string,unknown>):number{
  const names=eventNames(row)
  const q=new Set(normalize(query).split(' ').filter(Boolean))
  const words=normalize(names.home+' '+names.away+' '+names.label).split(' ').filter(Boolean)
  if(!words.length)return 0
  return words.filter(word=>q.has(word)).length/words.length
}

export function extractSportsEventQuery(activeTask:string):string{
  return activeTask
    .replace(/\b(jhadina|please)\b/gi,' ')
    .replace(/\b(simulate|simulation|monte carlo|run sims?|run simulations?)\b/gi,' ')
    .replace(/\b\d[\d,]{2,}\s*(?:times|simulations?|sims?|runs?)\b/gi,' ')
    .replace(/\b(show|give|tell)\s+me\b.*$/gi,' ')
    .replace(/\b(?:live|right now|in[- ]game|mid[- ]game)\b/gi,' ')
    .replace(/\bfrom\s+(?:q[1-4]|quarter|half|inning|period|round|set|game)\b.*$/gi,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/^(?:the\s+)?(?:game|match|fight|bout)\s+/i,'')
    .trim()
}

function snapshotFromRow(input:{
  row:Record<string,unknown>
  receivedAt:string
  sourceMode:SportsEventProviderSnapshot['sourceMode']
  live:boolean
}):SportsEventProviderSnapshot{
  const id=providerEventId(input.row)
  const names=eventNames(input.row)
  const evidenceId='thesportsdb:'+(input.live?'live:':'event:')+id+':'+hash(input.row).slice(0,16)
  return Object.freeze({
    snapshotId:'sports-event:'+hash({id,row:input.row,receivedAt:input.receivedAt}),
    providerId:'thesportsdb',
    providerEventId:id,
    eventId:canonicalEventId(input.row),
    eventLabel:names.label,
    sport:parseSport(input.row.strSport??input.row.sport),
    league:stringOrEmpty(input.row.strLeague??input.row.league)||undefined,
    scheduledAt:parseScheduledAt(input.row),
    status:parseStatus(input.row,input.live),
    progress:stringOrEmpty(input.row.strProgress??input.row.progress)||undefined,
    homeTeam:names.home,
    awayTeam:names.away,
    homeScore:numberOrZero(input.row.intHomeScore??input.row.homeScore),
    awayScore:numberOrZero(input.row.intAwayScore??input.row.awayScore),
    observedAt:input.receivedAt,
    receivedAt:input.receivedAt,
    evidenceIds:Object.freeze([evidenceId]),
    sourceMode:input.sourceMode,
    authority:'EVENT_REALITY_ONLY',
    canProject:false,
    canExecute:false,
  })
}

function chooseBest(query:string,rows:readonly Record<string,unknown>[]):Record<string,unknown>|null{
  const ranked=rows
    .map(row=>({row,score:matchScore(query,row)}))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score||canonicalEventId(a.row).localeCompare(canonicalEventId(b.row)))
  return ranked[0]&&ranked[0].score>=0.34?ranked[0].row:null
}

export function createTheSportsDbEventResolver(options:{
  fetchImpl?:FetchLike
  now?:()=>Date
  v1BaseUrl?:string
  v2BaseUrl?:string
  v1ApiKey?:string
  v2ApiKey?:string
}={}):SportsEventResolver{
  const fetchImpl=options.fetchImpl??fetch
  const now=options.now??(()=>new Date())
  const v1Base=(options.v1BaseUrl??DEFAULT_V1_BASE).replace(/\/+$/,'')
  const v2Base=(options.v2BaseUrl??DEFAULT_V2_BASE).replace(/\/+$/,'')
  const v1Key=options.v1ApiKey??process.env.THESPORTSDB_V1_API_KEY??DEFAULT_V1_KEY
  const v2Key=options.v2ApiKey??process.env.THESPORTSDB_V2_API_KEY

  return {
    async resolve(input){
      const receivedAt=now().toISOString()
      const query=extractSportsEventQuery(input.query)
      if(!query)return null

      if(input.liveRequested){
        if(!v2Key)return null
        const response=await fetchImpl(v2Base+'/livescore/all',{
          method:'GET',
          headers:{'X-API-KEY':v2Key,accept:'application/json'},
          cache:'no-store',
        })
        if(!response.ok)throw new Error('SPORT_CONTEXT_THESPORTSDB_LIVE_HTTP_'+response.status)
        const body=await response.json() as Record<string,unknown>
        const rows=(Array.isArray(body.events)?body.events:Array.isArray(body.livescores)?body.livescores:Array.isArray(body.event)?body.event:[]) as Record<string,unknown>[]
        const best=chooseBest(query,rows)
        return best?snapshotFromRow({row:best,receivedAt,sourceMode:'V2_LIVESCORE',live:true}):null
      }

      const url=new URL(v1Base+'/'+encodeURIComponent(v1Key)+'/searchevents.php')
      url.searchParams.set('e',query.replace(/\s+/g,'_'))
      const response=await fetchImpl(url,{method:'GET',cache:'no-store'})
      if(!response.ok)throw new Error('SPORT_CONTEXT_THESPORTSDB_SEARCH_HTTP_'+response.status)
      const body=await response.json() as Record<string,unknown>
      const rows=(Array.isArray(body.event)?body.event:Array.isArray(body.events)?body.events:[]) as Record<string,unknown>[]
      const best=chooseBest(query,rows)
      return best?snapshotFromRow({row:best,receivedAt,sourceMode:'V1_EVENT_SEARCH',live:false}):null
    },
  }
}

function stringArray(value:unknown):readonly string[]{
  return Object.freeze(Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'&&Boolean(x.trim())):[])
}

function validateModelInputs(value:unknown,expectedEventId:string,now:Date):SportsSimulationModelInputs{
  if(!value||typeof value!=='object')throw new Error('SPORT_CONTEXT_MODEL_INPUT_INVALID')
  const v=value as Record<string,unknown>
  const modelSnapshotId=stringOrEmpty(v.modelSnapshotId)
  const eventId=stringOrEmpty(v.eventId)
  const modelVersion=stringOrEmpty(v.modelVersion)
  const observedAt=stringOrEmpty(v.observedAt)
  if(!modelSnapshotId||!eventId||!modelVersion)throw new Error('SPORT_CONTEXT_MODEL_IDENTITY_REQUIRED')
  if(eventId!==expectedEventId)throw new Error('SPORT_CONTEXT_MODEL_EVENT_MISMATCH')
  if(!observedAt||Number.isNaN(Date.parse(observedAt)))throw new Error('SPORT_CONTEXT_MODEL_TIME_INVALID')
  if(Date.parse(observedAt)>now.getTime())throw new Error('SPORT_CONTEXT_MODEL_TIME_IN_FUTURE')
  const teamModels=Array.isArray(v.teamModels)?v.teamModels as unknown as readonly SportsTeamScoreModel[]:[]
  if(teamModels.length!==2||new Set(teamModels.map(x=>x.team)).size!==2)throw new Error('SPORT_CONTEXT_MODEL_TEAM_MODELS_INVALID')
  const heavyTailRegimeBps=Number(v.heavyTailRegimeBps)
  if(!Number.isInteger(heavyTailRegimeBps)||heavyTailRegimeBps<0||heavyTailRegimeBps>5000)throw new Error('SPORT_CONTEXT_MODEL_TAIL_INVALID')
  const evidenceIds=stringArray(v.evidenceIds)
  if(!evidenceIds.length)throw new Error('SPORT_CONTEXT_MODEL_EVIDENCE_REQUIRED')

  return Object.freeze({
    modelSnapshotId,
    eventId,
    modelVersion,
    observedAt,
    teamModels,
    playerModels:Object.freeze(Array.isArray(v.playerModels)?v.playerModels as unknown as SportsPlayerStatModel[]:[]),
    latentFactors:Object.freeze(Array.isArray(v.latentFactors)?v.latentFactors as unknown as SportsLatentFactor[]:[]),
    marketLegs:Object.freeze(Array.isArray(v.marketLegs)?v.marketLegs as unknown as SportsSimMarketLeg[]:[]),
    jointSets:Object.freeze(Array.isArray(v.jointSets)?v.jointSets as unknown as Readonly<{jointId:string;legIds:readonly string[]}>[]:[]),
    heavyTailRegimeBps,
    requestedStats:Object.freeze(Array.isArray(v.requestedStats)?v.requestedStats as unknown as SportsSimulationRequestedStat[]:[]),
    assumptions:stringArray(v.assumptions),
    scenarioNotes:stringArray(v.scenarioNotes),
    warnings:stringArray(v.warnings),
    evidenceIds,
    authority:'SIMULATION_MODEL_INPUT_ONLY',
    canExecute:false,
  })
}

export function createHttpSportsSimulationModelInputProvider(options:{
  baseUrl?:string
  token?:string
  fetchImpl?:FetchLike
  now?:()=>Date
}={}):SportsSimulationModelInputProvider|null{
  const baseUrl=options.baseUrl??process.env.SPORTS_SIMULATION_MODEL_URL
  if(!baseUrl?.trim())return null
  const token=options.token??process.env.SPORTS_SIMULATION_MODEL_TOKEN
  const fetchImpl=options.fetchImpl??fetch
  const now=options.now??(()=>new Date())
  return {
    async resolve(input){
      const response=await fetchImpl(baseUrl,{
        method:'POST',
        headers:{
          'content-type':'application/json',
          ...(token?{authorization:'Bearer '+token}:{}),
        },
        body:JSON.stringify({
          event:input.event,
          query:input.activeTask,
          liveRequested:input.liveRequested,
        }),
        cache:'no-store',
      })
      if(response.status===404)return null
      if(!response.ok)throw new Error('SPORT_CONTEXT_MODEL_HTTP_'+response.status)
      return validateModelInputs(await response.json(),input.event.eventId,now())
    },
  }
}

export function createProductionSportsSimulationContextProvider(options:{
  eventResolver?:SportsEventResolver
  modelProvider?:SportsSimulationModelInputProvider|null
  now?:()=>Date
  pregameMaxModelAgeMs?:number
  liveMaxModelAgeMs?:number
}={}):SportsSimulationContextProvider{
  const now=options.now??(()=>new Date())
  const eventResolver=options.eventResolver??createTheSportsDbEventResolver({now})
  const modelProvider=options.modelProvider??createHttpSportsSimulationModelInputProvider({now})
  const pregameMaxModelAgeMs=options.pregameMaxModelAgeMs??30*60_000
  const liveMaxModelAgeMs=options.liveMaxModelAgeMs??60_000

  return {
    async resolve(input){
      const event=await eventResolver.resolve({query:input.activeTask,liveRequested:input.intent.liveRequested})
      if(!event||!modelProvider)return null
      const model=await modelProvider.resolve({event,activeTask:input.activeTask,liveRequested:input.intent.liveRequested})
      if(!model)return null
      const ageMs=now().getTime()-Date.parse(model.observedAt)
      const maxAge=input.intent.liveRequested?liveMaxModelAgeMs:pregameMaxModelAgeMs
      if(ageMs<0)throw new Error('SPORT_CONTEXT_MODEL_TIME_IN_FUTURE')
      if(ageMs>maxAge)throw new Error(input.intent.liveRequested?'SPORT_CONTEXT_LIVE_MODEL_STALE':'SPORT_CONTEXT_PREGAME_MODEL_STALE')
      const evidenceIds=Object.freeze([...new Set([...event.evidenceIds,...model.evidenceIds])].sort())
      return Object.freeze({
        contextId:'sports-context:'+hash({event:event.snapshotId,model:model.modelSnapshotId,version:model.modelVersion}),
        eventId:event.eventId,
        eventLabel:event.eventLabel,
        sport:event.sport,
        observedAt:new Date(Math.max(Date.parse(event.observedAt),Date.parse(model.observedAt))).toISOString(),
        currentHomeScore:event.homeScore,
        currentAwayScore:event.awayScore,
        teamModels:model.teamModels,
        playerModels:model.playerModels,
        latentFactors:model.latentFactors,
        marketLegs:model.marketLegs,
        jointSets:model.jointSets,
        heavyTailRegimeBps:model.heavyTailRegimeBps,
        requestedStats:model.requestedStats,
        assumptions:Object.freeze([
          ...model.assumptions,
          'Event resolved by '+event.providerId+' ('+event.sourceMode+').',
          'Simulation model version: '+model.modelVersion+'.',
        ]),
        scenarioNotes:model.scenarioNotes,
        warnings:Object.freeze([
          ...model.warnings,
          event.sourceMode==='V1_EVENT_SEARCH'
            ? 'TheSportsDB v1 resolved event identity/state; live-score freshness was not claimed.'
            : 'TheSportsDB v2 live-score snapshot supplied current event state.',
        ]),
        evidenceIds,
        source:'ADMITTED_SPORTS_CONTEXT',
      } satisfies SportsSimulationResolvedContext)
    },
  }
}
