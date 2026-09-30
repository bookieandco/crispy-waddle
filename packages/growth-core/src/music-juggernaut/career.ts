import type {
  FanRecord,
  FanStage,
  PerformanceObservation,
  SongRecord,
  SongSection,
} from './domain.js';

export interface CreativeDiversityInput {
  variants: readonly {
    id: string;
    family: string;
    hook: string;
    environment: string;
    sectionId?: string;
  }[];
}

export interface CreativeDiversityAssessment {
  uniqueFamilies: number;
  uniqueHooks: number;
  uniqueEnvironments: number;
  diversityScore: number;
  sufficientForExploration: boolean;
  reasons: readonly string[];
}

export interface SectionHeat {
  sectionId: string;
  score: number;
  observations: number;
  evidenceRefs: readonly string[];
}

export interface TrendOpportunity {
  trendId: string;
  velocity: number;
  saturation: number;
  artistFit: number;
  songFit: number;
  audienceFit: number;
  productionSpeed: number;
  brandFit: number;
  score: number;
  recommendation: 'PASS'|'TEST'|'ATTACK';
}

export interface BreakoutReadinessInput {
  followupSongReady: boolean;
  contentInventory: number;
  directFanCaptureReady: boolean;
  rightsMapped: boolean;
  teamCapacity: boolean;
  liveProfileReady: boolean;
  catalogDepth: number;
  evidenceRefs: readonly string[];
}

export interface BreakoutReadinessAssessment {
  score: number;
  ready: boolean;
  blockers: readonly string[];
  evidenceRefs: readonly string[];
}

export interface ManagementReadinessInput {
  inboundOpportunityCount: number;
  weeklyCoordinationHours: number;
  unresolvedRightsOrDealItems: number;
  activePartnerThreads: number;
  artistConsistency: number;
  evidenceRefs: readonly string[];
}

export interface ManagementReadinessAssessment {
  state: 'TOO_EARLY'|'MAY_ADD_LEVERAGE'|'REAL_BOTTLENECK';
  score: number;
  reasons: readonly string[];
  evidenceRefs: readonly string[];
}

export interface FanOffer {
  id: string;
  kind: 'ATTRACTION'|'CORE'|'UPSELL'|'DOWNSELL'|'CONTINUITY';
  description: string;
  targetStage: FanStage;
  recurring: boolean;
  recurringValueDefined: boolean;
}

export interface OfferStackAssessment {
  valid: boolean;
  blockers: readonly string[];
  orderedOffers: readonly FanOffer[];
}

export interface CashFlowItem {
  id: string;
  direction: 'in'|'out';
  amountMinor: number;
  occursAt: string;
  description: string;
}

export interface CashFlowForecast {
  lowestBalanceMinor: number;
  endingBalanceMinor: number;
  shortfall: boolean;
  shortfallAt?: string;
}

export interface FunnelMeasurement {
  stage: 'attention'|'recognition'|'music_transfer'|'repeat_listening'|'direct_fan'|'purchase'|'advocacy';
  actualRate: number;
  targetRate: number;
  evidenceRefs: readonly string[];
}

export interface MusicBottleneckDiagnosis {
  bottleneck: FunnelMeasurement['stage'];
  gap: number;
  nextQuestion: string;
  evidenceRefs: readonly string[];
}

export interface MusicSenseAudit {
  passes: boolean;
  concerns: readonly string[];
  evidenceRefs: readonly string[];
}

const FAN_ORDER: readonly FanStage[] = [
  'VIEWER','FOLLOWER','RETURNER','LISTENER','DIRECT_FAN','COMMUNITY','BUYER','ADVOCATE',
];

export function assessCreativeDiversity(input: CreativeDiversityInput): CreativeDiversityAssessment {
  if (!input.variants.length) throw new Error('MUSIC_JUGGERNAUT_VARIANTS_REQUIRED');
  const families = new Set(input.variants.map((item) => item.family.trim()).filter(Boolean));
  const hooks = new Set(input.variants.map((item) => item.hook.trim()).filter(Boolean));
  const environments = new Set(input.variants.map((item) => item.environment.trim()).filter(Boolean));
  const denominator = Math.max(input.variants.length, 1);
  const diversityScore = round(
    Math.min(1, (families.size / denominator) * 0.5 + (hooks.size / denominator) * 0.3 + (environments.size / denominator) * 0.2),
  );
  const sufficientForExploration = families.size >= 3 && hooks.size >= 2;
  const reasons = sufficientForExploration
    ? ['Portfolio contains multiple genuinely different creative families.']
    : ['Exploration needs more concept diversity; file count alone is not enough.'];
  return Object.freeze({
    uniqueFamilies: families.size,
    uniqueHooks: hooks.size,
    uniqueEnvironments: environments.size,
    diversityScore,
    sufficientForExploration,
    reasons: Object.freeze(reasons),
  });
}

export function buildSongSectionHeatmap(input: {
  song: SongRecord;
  experiments: readonly {id:string; sectionId?:string}[];
  observations: readonly PerformanceObservation[];
}): readonly SectionHeat[] {
  const experimentSection = new Map(input.experiments.map((experiment) => [experiment.id, experiment.sectionId]));
  const bySection = new Map<string, {score:number; count:number; refs:string[]}>();
  for (const observation of input.observations) {
    const sectionId = experimentSection.get(observation.experimentId);
    if (!sectionId) continue;
    const section = input.song.sections.find((item) => item.id === sectionId);
    if (!section) continue;
    const quality = (1 - observation.botRisk) * observation.attributionConfidence;
    const score = quality * (
      observation.songActions * 5 +
      observation.directFanCaptures * 8 +
      observation.saves * 2 +
      observation.shares * 1.5 +
      observation.profileVisits
    ) / Math.max(observation.exposures, 1);
    const current = bySection.get(sectionId) ?? {score:0,count:0,refs:[]};
    current.score += score;
    current.count += 1;
    current.refs.push(...observation.evidenceRefs);
    bySection.set(sectionId,current);
  }
  return Object.freeze(input.song.sections.map((section) => {
    const value = bySection.get(section.id) ?? {score:0,count:0,refs:[]};
    return Object.freeze({
      sectionId:section.id,
      score:round(value.count ? value.score / value.count : 0),
      observations:value.count,
      evidenceRefs:Object.freeze(unique(value.refs)),
    });
  }).sort((a,b)=>b.score-a.score));
}

export function scoreTrendOpportunity(input: Omit<TrendOpportunity,'score'|'recommendation'>): TrendOpportunity {
  const values = [input.velocity,input.saturation,input.artistFit,input.songFit,input.audienceFit,input.productionSpeed,input.brandFit];
  values.forEach((value)=>assertRate(value));
  const score = round(
    input.velocity * 0.2 +
    (1-input.saturation) * 0.12 +
    input.artistFit * 0.16 +
    input.songFit * 0.18 +
    input.audienceFit * 0.14 +
    input.productionSpeed * 0.08 +
    input.brandFit * 0.12
  );
  const recommendation:TrendOpportunity['recommendation'] = score >= 0.76 ? 'ATTACK' : score >= 0.55 ? 'TEST' : 'PASS';
  return Object.freeze({...input,score,recommendation});
}

export function assessBreakoutReadiness(input: BreakoutReadinessInput): BreakoutReadinessAssessment {
  requireEvidence(input.evidenceRefs);
  if (!Number.isInteger(input.contentInventory) || input.contentInventory < 0) throw new Error('MUSIC_JUGGERNAUT_CONTENT_INVENTORY_INVALID');
  if (!Number.isInteger(input.catalogDepth) || input.catalogDepth < 0) throw new Error('MUSIC_JUGGERNAUT_CATALOG_DEPTH_INVALID');
  const blockers:string[]=[];
  if(!input.followupSongReady) blockers.push('No follow-up song is ready.');
  if(input.contentInventory<5) blockers.push('Content inventory is too thin for a breakout window.');
  if(!input.directFanCaptureReady) blockers.push('Direct fan capture is not ready.');
  if(!input.rightsMapped) blockers.push('Rights are not mapped.');
  if(!input.teamCapacity) blockers.push('Team capacity is insufficient for breakout operations.');
  if(!input.liveProfileReady) blockers.push('Live/booking proof package is not ready.');
  if(input.catalogDepth<2) blockers.push('Catalog depth is too shallow for discovery spillover.');
  const score=round(1-(blockers.length/7));
  return Object.freeze({score,ready:blockers.length===0,blockers:Object.freeze(blockers),evidenceRefs:Object.freeze(unique(input.evidenceRefs))});
}

export function assessManagementReadiness(input: ManagementReadinessInput): ManagementReadinessAssessment {
  assertRate(input.artistConsistency);
  requireEvidence(input.evidenceRefs);
  const load = Math.min(1,
    input.inboundOpportunityCount/10*0.3 +
    input.weeklyCoordinationHours/20*0.25 +
    input.unresolvedRightsOrDealItems/5*0.2 +
    input.activePartnerThreads/12*0.15 +
    input.artistConsistency*0.1
  );
  const state:ManagementReadinessAssessment['state'] =
    input.artistConsistency < 0.5 ? 'TOO_EARLY' :
    load >= 0.65 ? 'REAL_BOTTLENECK' :
    load >= 0.35 ? 'MAY_ADD_LEVERAGE' : 'TOO_EARLY';
  const reasons = [
    'Management is evaluated as a coordination/leverage need, not a rescue mechanism.',
    'Artist consistency remains a prerequisite.',
  ];
  return Object.freeze({state,score:round(load),reasons:Object.freeze(reasons),evidenceRefs:Object.freeze(unique(input.evidenceRefs))});
}

export function advanceFanStage(current: FanStage, next: FanStage): FanStage {
  const from=FAN_ORDER.indexOf(current);
  const to=FAN_ORDER.indexOf(next);
  if(from<0||to<0||to<from||to>from+1) throw new Error('MUSIC_JUGGERNAUT_FAN_STAGE_INVALID');
  return next;
}

export function fanRelationshipScore(fan: FanRecord): number {
  return round(Math.min(1,
    fan.repeatInteractions*0.04 +
    fan.purchases*0.12 +
    fan.showsAttended*0.15 +
    fan.advocacySignals*0.16 +
    FAN_ORDER.indexOf(fan.stage)*0.06
  ));
}

export function assessOfferStack(offers: readonly FanOffer[]): OfferStackAssessment {
  if(!offers.length) throw new Error('MUSIC_JUGGERNAUT_OFFERS_REQUIRED');
  const blockers:string[]=[];
  const ids=new Set<string>();
  for(const offer of offers){
    if(!offer.id.trim()||!offer.description.trim()) blockers.push('Offer identity/description is incomplete.');
    if(ids.has(offer.id)) blockers.push('Offer IDs must be unique.');
    ids.add(offer.id);
    if(offer.recurring&&!offer.recurringValueDefined) blockers.push('Recurring charge requires recurring fan value: '+offer.id);
  }
  if(!offers.some((offer)=>offer.kind==='ATTRACTION')) blockers.push('Attraction offer is missing.');
  if(!offers.some((offer)=>offer.kind==='CORE')) blockers.push('Core offer is missing.');
  const order:Record<FanOffer['kind'],number>={ATTRACTION:0,DOWNSELL:1,CORE:2,UPSELL:3,CONTINUITY:4};
  return Object.freeze({
    valid:blockers.length===0,
    blockers:Object.freeze(blockers),
    orderedOffers:Object.freeze([...offers].sort((a,b)=>order[a.kind]-order[b.kind])),
  });
}

export function forecastCashFlow(openingBalanceMinor:number, items: readonly CashFlowItem[]): CashFlowForecast {
  if(!Number.isFinite(openingBalanceMinor)) throw new Error('MUSIC_JUGGERNAUT_OPENING_BALANCE_INVALID');
  let balance=openingBalanceMinor;
  let lowest=balance;
  let shortfallAt:string|undefined;
  const ordered=[...items].sort((a,b)=>a.occursAt.localeCompare(b.occursAt));
  for(const item of ordered){
    if(!Number.isFinite(item.amountMinor)||item.amountMinor<0) throw new Error('MUSIC_JUGGERNAUT_CASH_ITEM_INVALID');
    if(!Number.isFinite(Date.parse(item.occursAt))) throw new Error('MUSIC_JUGGERNAUT_CASH_DATE_INVALID');
    balance += item.direction==='in' ? item.amountMinor : -item.amountMinor;
    if(balance<lowest) lowest=balance;
    if(balance<0&&!shortfallAt) shortfallAt=item.occursAt;
  }
  return Object.freeze({lowestBalanceMinor:lowest,endingBalanceMinor:balance,shortfall:Boolean(shortfallAt),shortfallAt});
}

export function diagnoseMusicBottleneck(measurements: readonly FunnelMeasurement[]): MusicBottleneckDiagnosis {
  if(!measurements.length) throw new Error('MUSIC_JUGGERNAUT_FUNNEL_REQUIRED');
  let selected=measurements[0]!;
  let gap=Number.NEGATIVE_INFINITY;
  for(const measurement of measurements){
    assertRate(measurement.actualRate); assertRate(measurement.targetRate); requireEvidence(measurement.evidenceRefs);
    const current=measurement.targetRate-measurement.actualRate;
    if(current>gap){selected=measurement;gap=current;}
  }
  const questions:Record<FunnelMeasurement['stage'],string>={
    attention:'Is the opening/content packaging failing to earn attention?',
    recognition:'Are enough people seeing the artist repeatedly to build familiarity?',
    music_transfer:'Does the content make people care enough to reach the music?',
    repeat_listening:'Does the record/audience fit earn another listen or another song?',
    direct_fan:'Have we earned a reason for fans to opt into a direct relationship?',
    purchase:'Is the offer valuable, appropriately timed, and easy to buy?',
    advocacy:'Are fans receiving experiences worth sharing with other people?',
  };
  return Object.freeze({bottleneck:selected.stage,gap:round(Math.max(0,gap)),nextQuestion:questions[selected.stage],evidenceRefs:Object.freeze(unique(selected.evidenceRefs))});
}

export function makeMusicMakeSenseAudit(input:{
  claim:string;
  evidenceRefs:readonly string[];
  sampleSize:number;
  attributionConfidence:number;
  hasReplication:boolean;
  hasContradictoryEvidence:boolean;
  spendDecision?:boolean;
}):MusicSenseAudit{
  if(!input.claim.trim()) throw new Error('MUSIC_JUGGERNAUT_AUDIT_CLAIM_REQUIRED');
  assertRate(input.attributionConfidence);
  const concerns:string[]=[];
  if(!input.evidenceRefs.length) concerns.push('Claim has no evidence refs.');
  if(input.sampleSize<30) concerns.push('Sample is too small for a strong generalization.');
  if(input.attributionConfidence<0.5) concerns.push('Attribution confidence is weak.');
  if(!input.hasReplication) concerns.push('Signal has not replicated yet.');
  if(input.hasContradictoryEvidence) concerns.push('Contradictory evidence requires reconciliation.');
  if(input.spendDecision&&concerns.length) concerns.push('Do not scale spend while material evidence concerns remain.');
  return Object.freeze({passes:concerns.length===0,concerns:Object.freeze(concerns),evidenceRefs:Object.freeze(unique(input.evidenceRefs))});
}

export function validateSongSection(section:SongSection):SongSection{
  if(!section.id.trim()||!section.songId.trim()||!section.label.trim()) throw new Error('MUSIC_JUGGERNAUT_SECTION_IDENTITY_REQUIRED');
  if(!Number.isFinite(section.startMs)||!Number.isFinite(section.endMs)||section.startMs<0||section.endMs<=section.startMs){
    throw new Error('MUSIC_JUGGERNAUT_SECTION_RANGE_INVALID');
  }
  if(!section.functions.length) throw new Error('MUSIC_JUGGERNAUT_SECTION_FUNCTION_REQUIRED');
  return Object.freeze({...section,functions:Object.freeze([...section.functions])});
}

function assertRate(value:number):void{
  if(!Number.isFinite(value)||value<0||value>1) throw new Error('MUSIC_JUGGERNAUT_RATE_INVALID');
}
function requireEvidence(values:readonly string[]):void{
  if(!values.length||values.some((value)=>!value.trim())) throw new Error('MUSIC_JUGGERNAUT_EVIDENCE_REQUIRED');
}
function unique(values:readonly string[]):string[]{return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];}
function round(value:number):number{return Math.round(value*10000)/10000;}
