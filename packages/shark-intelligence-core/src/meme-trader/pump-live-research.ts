import {
  PumpDecodedEventLifecycleTracker, type PumpDecodedStreamEvent,
} from './pump-decoded-event-stream'
import {decodePumpLogsNotification,type SolanaLogsNotification} from './pump-anchor-log-decoder'
import {
  buildPumpMigrationRadarCandidate,type PumpMigrationRadarCandidate,
} from './migration-radar'
import {
  evaluatePumpGraduationAlert,type PairedQuoteResearch,
  type PumpGraduationAlert,formatOwnerPumpGraduationAlert,
} from './pump-graduation-alert'

/** SHARK-ALPHA.FABRIC.07 — public on-chain candidate signal with independent risk
 * evidence. Does NOT infer risk clearance from a Pump stream or boost listing.
 */
export type PumpRiskResearch=Readonly<{
  mint:string
  availableAt:string
  evidenceIds:readonly string[]
  creatorRiskScore?:number
  clusterRiskScore?:number
  sniperInventoryRisk?:number
  rugBlocked?:boolean
  holderCount?:number
  uniqueBuyerCount?:number
  volumeAccelerationScore?:number
  buyPressureScore?:number
  holderGrowthScore?:number
}>
export type PumpPairedQuoteResearch=PairedQuoteResearch&Readonly<{
  mint:string
  receivedAt:string
}>
export type PumpLiveDecision=Readonly<{
  eventId:string
  mint:string
  slot:number
  observedAt:string
  availableAt:string
  radar:PumpMigrationRadarCandidate
  alert?:PumpGraduationAlert
  mode:'LIVE'|'RETROSPECTIVE'
  safety:'RISK_BLOCKED'|'INCOMPLETE_REVIEW'|'RESEARCH_WATCH'
  providerFinality:'UNVERIFIED'
  canTrade:false
}>
export type PumpLiveResearchDependencies=Readonly<{
  now:()=>string
  riskResearch?:(mint:string,availableAt:string)=>Promise<PumpRiskResearch|null>
  quoteResearch?:(mint:string,availableAt:string)=>Promise<PumpPairedQuoteResearch|null>
  onDecision?:(decision:PumpLiveDecision)=>Promise<void>
  onOwnerMessage?:(message:string,deduplicationKey:string)=>Promise<void>
  ownerAuthenticated?:boolean
  notificationsEnabled?:boolean
  maxEventAgeMs?:number
}>
export type PumpLiveCounters=Readonly<{
  accepted:number
  duplicate:number
  ignored:number
  missingBaseline:number
  quarantined:number
  alertsComposed:number
  delivered:number
  deliveryFailed:number
  lastSlot?:number
  canTrade:false
}>
const finiteScore=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1
const finiteCount=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0
const iso=(v:string)=>Number.isFinite(Date.parse(v))
const SEEN_LIMIT=60_000
const TRACK_LIMIT=6_000
export class PumpLiveResearchEngine{
  private tracker=new PumpDecodedEventLifecycleTracker()
  private radars=new Map<string,PumpMigrationRadarCandidate>()
  private lastSlots=new Map<string,number>()
  private seen=new Set<string>()
  private emitted=new Set<string>()
  private accepted=0
  private duplicate=0
  private ignored=0
  private missingBaseline=0
  private quarantined=0
  private alertsComposed=0
  private delivered=0
  private deliveryFailed=0
  private lastSlot?:number
  constructor(private readonly options:PumpLiveResearchDependencies){
    if(options.maxEventAgeMs!==undefined&&(!Number.isFinite(options.maxEventAgeMs)||options.maxEventAgeMs<0||options.maxEventAgeMs>120_000))
      throw new Error('shark_pump_event_age_limit_invalid')
  }
  counters():PumpLiveCounters{return Object.freeze({
    accepted:this.accepted,duplicate:this.duplicate,ignored:this.ignored,
    missingBaseline:this.missingBaseline,quarantined:this.quarantined,
    alertsComposed:this.alertsComposed,delivered:this.delivered,
    deliveryFailed:this.deliveryFailed,lastSlot:this.lastSlot,canTrade:false,
  })}
  /** Neither a retrospective replay nor a stale live notification is allowed to
   * send a speed-sensitive alert. This path only works with public on-chain data. */
  async acceptNotification(
    payload:SolanaLogsNotification,
    receivedAt:string,
    mode:'LIVE'|'RETROSPECTIVE'='LIVE',
  ):Promise<readonly PumpLiveDecision[]>{
    if(!iso(receivedAt))throw new Error('shark_pump_live_received_clock_invalid')
    let events:readonly PumpDecodedStreamEvent[]
    try{events=decodePumpLogsNotification(payload,receivedAt)}
    catch{this.quarantined++;return Object.freeze([])}
    const results:PumpLiveDecision[]=[]
    for(const event of events){
      const key=event.signature+':'+event.eventId
      if(this.seen.has(key)){this.duplicate++;continue}
      const mint=event.data.mint
      if(typeof mint!=='string'||!mint.trim()){this.quarantined++;continue}
      const last=this.lastSlots.get(mint)
      if(last!==undefined&&event.slot<last){this.quarantined++;continue}
      const freshAge=Date.parse(this.options.now())-Date.parse(event.availableAt)
      const eligibleForAlert=mode==='LIVE'&&freshAge>=0&&freshAge<=(this.options.maxEventAgeMs??30_000)
      const initial=this.tracker.snapshot(mint)
      if(!initial&&event.eventName!=='CreateEvent'){
        // No synthetic first-curve reserve. A genuinely recovered CreateEvent or
        // separately verified snapshot is needed before TradeEvent progress can rank.
        this.missingBaseline++;this.ignored++;continue
      }
      let update
      try{update=await this.tracker.ingest(event)}
      catch{this.quarantined++;continue}
      const available=Date.parse(event.availableAt)
      let risk:PumpRiskResearch|null=null
      try{
        risk=await this.options.riskResearch?.(mint,event.availableAt)??null
        if(risk){
          const t=Date.parse(risk.availableAt)
          if(risk.mint!==mint||!Number.isFinite(t)||t>available||available-t>30_000||
            !risk.evidenceIds.length||risk.evidenceIds.some(x=>!x.trim())||
            ['creatorRiskScore','clusterRiskScore','sniperInventoryRisk','volumeAccelerationScore','buyPressureScore','holderGrowthScore']
              .some(name=>{const v=risk?.[name as keyof PumpRiskResearch];return v!==undefined&&!finiteScore(v)})||
            ['holderCount','uniqueBuyerCount'].some(name=>{const v=risk?.[name as keyof PumpRiskResearch];return v!==undefined&&!finiteCount(v)})||
            (risk.rugBlocked!==undefined&&typeof risk.rugBlocked!=='boolean'))throw new Error('risk_invalid')
        }
      }catch{risk=null;this.quarantined++}
      const candidate=buildPumpMigrationRadarCandidate({
        ...update.observation,
        ...(risk?{
          creatorRiskScore:risk.creatorRiskScore,clusterRiskScore:risk.clusterRiskScore,
          sniperInventoryRisk:risk.sniperInventoryRisk,rugBlocked:risk.rugBlocked,
          holderCount:risk.holderCount,uniqueBuyerCount:risk.uniqueBuyerCount,
          volumeAccelerationScore:risk.volumeAccelerationScore,buyPressureScore:risk.buyPressureScore,
          holderGrowthScore:risk.holderGrowthScore,
          evidenceIds:[...update.observation.evidenceIds,...risk.evidenceIds],
        }:{}),
      })
      let quote:PairedQuoteResearch|undefined
      if(eligibleForAlert&&candidate.disposition==='WATCH'){
        try{
          const raw=await this.options.quoteResearch?.(mint,event.availableAt)??null
          if(raw&&raw.mint===mint&&raw.source==='WATCHKEEPER_INDICATIVE_PAIR'&&
            iso(raw.receivedAt)&&Date.parse(raw.receivedAt)<=available&&
            available-Date.parse(raw.receivedAt)<=30_000&&
            raw.hasForwardAndReverseQuotes===true)quote=raw
        }catch{this.quarantined++}
      }
      const previous=this.radars.get(mint)
      const alert=eligibleForAlert?evaluatePumpGraduationAlert({
        current:candidate,previous,assessedAt:this.options.now(),quoteResearch:quote,
      }):null
      this.radars.set(mint,candidate)
      this.lastSlots.set(mint,event.slot)
      this.lastSlot=Math.max(this.lastSlot??0,event.slot)
      // LRU-ish bounded, no data persisted to GitHub or Supabase here.
      this.seen.add(key)
      if(this.seen.size>SEEN_LIMIT)this.seen.delete(this.seen.values().next().value!)
      if(this.lastSlots.size>TRACK_LIMIT){
        const oldest=this.lastSlots.keys().next().value!
        this.lastSlots.delete(oldest);this.radars.delete(oldest)
        // tracker still holds history for now; runtime must be restarted/rotated by a host.
      }
      this.accepted++
      const safety=candidate.disposition==='BLOCK'?'RISK_BLOCKED':
        candidate.missingChecks.length?'INCOMPLETE_REVIEW':'RESEARCH_WATCH'
      const decision:PumpLiveDecision=Object.freeze({
        eventId:key,mint,slot:event.slot,observedAt:event.observedAt,availableAt:event.availableAt,
        radar:candidate,alert:alert??undefined,mode,safety,
        providerFinality:'UNVERIFIED' as const,canTrade:false as const,
      })
      results.push(decision)
      if(this.options.onDecision)await this.options.onDecision(decision)
      if(alert&&!this.emitted.has(alert.alertId)){
        this.alertsComposed++;this.emitted.add(alert.alertId)
        if(this.emitted.size>SEEN_LIMIT)this.emitted.delete(this.emitted.values().next().value!)
        if(this.options.notificationsEnabled===true&&this.options.ownerAuthenticated===true&&this.options.onOwnerMessage){
          try{await this.options.onOwnerMessage(formatOwnerPumpGraduationAlert(alert),alert.alertId);this.delivered++}
          catch{this.deliveryFailed++} // uncertain: never auto retry a potentially delivered message
        }
      }
    }
    return Object.freeze(results)
  }
}
