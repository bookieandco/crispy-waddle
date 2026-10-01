import type {
  CityDemand,
  PerformanceObservation,
  PromotionBudget,
  RightsRecord,
  SongSection,
} from './domain.js';
import {
  chooseJuggernautMode,
  consolidateCreativeOutliers,
  decidePromotionSpend,
  detectCreativeOutlier,
} from './intelligence.js';
import { assessBreakoutReadiness, makeMusicMakeSenseAudit } from './career.js';
import {
  assessPaidScaleHealth,
  assessPromotionTrafficQuality,
  certifyMusicJuggernautProductionFinal,
} from './production-final.js';
import { decideJuggernautAutonomy } from './governance.js';

export const MUSIC_COMMISSION_FINAL_VERSION='MUSIC-COMMISSION.FINAL-v1' as const;
export const ATWOOD_BOOKIE_ARTIST_KEY='atwood-bookie' as const;
export const ATWOOD_BOOKIE_ARTIST_NAME='Atwood Bookie' as const;
export const ATWOOD_BOOKIE_OWNER_IDENTITY='Bookie & Co' as const;
export const ATWOOD_BOOKIE_CANONICAL_HUB='https://solo.to/bookieandco' as const;

export type MusicCommissionStage =
  | 'MUSIC-COMMISSION.1'
  | 'MUSIC-COMMISSION.2'
  | 'MUSIC-COMMISSION.3'
  | 'MUSIC-COMMISSION.4'
  | 'MUSIC-COMMISSION.5'
  | 'MUSIC-COMMISSION.6'
  | 'MUSIC-COMMISSION.7'
  | 'MUSIC-COMMISSION.8'
  | 'MUSIC-COMMISSION.9'
  | 'MUSIC-COMMISSION.FINAL';

export interface CanonicalArtistIdentity {
  artistKey:typeof ATWOOD_BOOKIE_ARTIST_KEY;
  canonicalName:typeof ATWOOD_BOOKIE_ARTIST_NAME;
  ownerIdentity:typeof ATWOOD_BOOKIE_OWNER_IDENTITY;
  canonicalHub:typeof ATWOOD_BOOKIE_CANONICAL_HUB;
  aliases:readonly string[];
  evidenceRefs:readonly string[];
}

export type MusicPlatform =
  | 'spotify'
  | 'apple_music'
  | 'amazon_music'
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'soundcloud'
  | 'bandcamp'
  | 'facebook'
  | 'x'
  | 'website';

export interface ResolvedArtistLink {
  platform:MusicPlatform;
  url:string;
  kind:'artist'|'catalog'|'social'|'commerce'|'website';
  confidence:number;
  verificationState:'DECLARED'|'DISCOVERED';
  evidenceRefs:readonly string[];
}

export interface PublicCatalogReleaseSeed {
  releaseKey:string;
  title:string;
  releaseType:'single'|'ep'|'album';
  releaseDate:string;
  trackCount:number;
  sourcePlatform:'apple_music'|'amazon_music';
  sourceUrl:string;
  tracks:readonly string[];
  evidenceRefs:readonly string[];
}

export interface PublicCatalogSongSeed {
  songKey:string;
  title:string;
  releaseKey:string;
  releaseDate:string;
  sourceUrl:string;
  evidenceRefs:readonly string[];
}

export interface SongIntelligenceInput {
  songKey:string;
  title:string;
  sections:readonly SongSection[];
  evidenceRefs:readonly string[];
}

export interface SongIntelligenceTask {
  songKey:string;
  title:string;
  state:'READY'|'ANALYSIS_REQUIRED';
  sectionCount:number;
  reasons:readonly string[];
  evidenceRefs:readonly string[];
}

export interface SocialBaselineSummary {
  state:'READY'|'INSUFFICIENT_DATA';
  eligibleSamples:number;
  excludedSamples:number;
  medianViews:number;
  medianSongActions:number;
  medianDirectFanCaptures:number;
  minimumExposures:number;
  evidenceRefs:readonly string[];
}

export interface SearchExperimentPlan {
  experimentKey:string;
  songKey:string;
  contentFamily:'performance'|'story'|'visual-hook';
  platform:string;
  hypothesis:string;
  successSignal:string;
  failureSignal:string;
  sampleTarget:number;
  spendMinor:0;
  currency:'USD';
  authority:'INTERNAL_PLANNING_ONLY';
  evidenceRefs:readonly string[];
}

export interface FanCityCommissionSummary {
  state:'READY'|'DATA_REQUIRED';
  cityCount:number;
  directAudienceCount:number;
  strongestCity?:string;
  evidenceRefs:readonly string[];
  warnings:readonly string[];
}

export interface RightsMoneyCommissionAssessment {
  attackEligible:boolean;
  rightsReady:boolean;
  budgetReady:boolean;
  blockers:readonly string[];
  evidenceRefs:readonly string[];
  authority:'ANALYSIS_ONLY';
}

export interface AttackCanaryCertification {
  passed:boolean;
  realSignalMode:'SEARCH'|'ATTACK';
  fakeSignalMode:'SEARCH'|'ATTACK';
  rightsBlockedSpendMinor:number;
  paidDegradationAction:'SCALE'|'HOLD'|'STOP';
  consequentialActionsBlocked:boolean;
  externalActionsStarted:false;
  checks:readonly {name:string;passed:boolean}[];
}

export interface MusicCommissionFinalCertification {
  version:typeof MUSIC_COMMISSION_FINAL_VERSION;
  passed:boolean;
  checks:readonly {stage:MusicCommissionStage;name:string;passed:boolean}[];
  loop:readonly string[];
  authority:'CERTIFICATION_ONLY';
  externalActionsStarted:false;
}

export function canonicalAtwoodBookieIdentity():CanonicalArtistIdentity {
  return Object.freeze({
    artistKey:ATWOOD_BOOKIE_ARTIST_KEY,
    canonicalName:ATWOOD_BOOKIE_ARTIST_NAME,
    ownerIdentity:ATWOOD_BOOKIE_OWNER_IDENTITY,
    canonicalHub:ATWOOD_BOOKIE_CANONICAL_HUB,
    aliases:Object.freeze([]),
    evidenceRefs:Object.freeze([
      'owner-declared:artist-name:atwood-bookie',
      'owner-declared:hub:https://solo.to/bookieandco',
    ]),
  });
}

export function resolveArtistHubLinks(
  links:readonly string[],
  sourceHub:string=ATWOOD_BOOKIE_CANONICAL_HUB,
):readonly ResolvedArtistLink[] {
  const resolved:ResolvedArtistLink[]=[];
  const seen=new Set<string>();
  for(const raw of links){
    const normalized=normalizeHttpUrl(raw);
    if(!normalized||normalized===sourceHub||seen.has(normalized))continue;
    const parsed=new URL(normalized);
    const classification=classifyLink(parsed);
    if(!classification)continue;
    seen.add(normalized);
    resolved.push(Object.freeze({
      ...classification,
      url:normalized,
      confidence:classification.platform==='website'?0.6:0.9,
      verificationState:'DISCOVERED' as const,
      evidenceRefs:Object.freeze([
        'artist-hub:'+sourceHub,
        'artist-hub-outbound:'+parsed.hostname.toLowerCase(),
      ]),
    }));
  }
  return Object.freeze(resolved);
}

export function publicAtwoodBookieArtistLinks():readonly ResolvedArtistLink[] {
  return Object.freeze([
    Object.freeze({
      platform:'apple_music' as const,
      url:'https://music.apple.com/us/artist/atwood-bookie/1470869415',
      kind:'artist' as const,
      confidence:1,
      verificationState:'DISCOVERED' as const,
      evidenceRefs:Object.freeze(['public-artist-page:apple_music:1470869415']),
    }),
    Object.freeze({
      platform:'amazon_music' as const,
      url:'https://music.amazon.in/artists/B07H7W7S6N/atwood-bookie',
      kind:'artist' as const,
      confidence:1,
      verificationState:'DISCOVERED' as const,
      evidenceRefs:Object.freeze(['public-artist-page:amazon_music:B07H7W7S6N']),
    }),
  ]);
}

export function publicAtwoodBookieCatalogSeed():readonly PublicCatalogReleaseSeed[] {
  const seeds:PublicCatalogReleaseSeed[]=[
    release('chairman-of-the-trap-4','Chairman of the Trap 4','album','2014-10-24',9,'apple_music','https://music.apple.com/us/album/chairman-of-the-trap-4/1595938965',[
      "Rollin'","Kush G Intulude","Friday","Fly","Real Niggas","Gypsy","Sip Sloww","Hut 4","Hate Me Too",
    ]),
    release('ghetto-eloquence','Ghetto Eloquence','album','2015-11-16',11,'amazon_music','https://music.amazon.in/albums/B09MV59SLT',[
      'Apryl Katrina','God Chose Me','9 Wayz','Bookie White','NHPC','Guerilla Business','Hollywood','Sweetheart','Odds','Highlight','DFW',
    ]),
    release('the-flats-at-five-mile-creek','The Flats at Five Mile Creek','album','2016-12-21',10,'apple_music','https://music.apple.com/gb/album/the-flats-at-five-mile-creek/1595951405',[]),
    release('sip-slow','Sip Slow','ep','2012-09-17',4,'apple_music','https://music.apple.com/ca/album/sip-slow-ep/1474104353',[]),
    release('side-effects','Side Effects','single','2019-07-27',1,'apple_music','https://music.apple.com/gb/album/side-effects-single/1595985923',['Side Effects']),
    release('otr','otr','single','2019-07-14',1,'amazon_music','https://music.amazon.in/albums/B09MDQ3Q6M',['otr']),
    release('ass-naked','Ass Naked','single','2020-10-10',1,'amazon_music','https://music.amazon.com.br/albums/B09G3JDZ2V',['Ass Naked']),
    release('tried','Tried','single','2021-04-17',1,'amazon_music','https://music.amazon.in/albums/B09C6MGW2D',['Tried']),
    release('never-fold','Never fold','single','2021-07-13',1,'amazon_music','https://music.amazon.in/albums/B099NWZVZY',['Never fold']),
    release('playa-2','Playa 2','single','2021-06-05',1,'amazon_music','https://music.amazon.in/albums/B096XPGR1R',['Playa 2']),
    release('new-feelin','New Feelin','single','2021-07-17',1,'apple_music','https://music.apple.com/es/album/new-feelin-single/1577400682',['New Feelin']),
    release('ok-aight-feat-cizzle','ok aight (feat. Cizzle)','single','2021-08-02',1,'apple_music','https://music.apple.com/bj/album/ok-aight-feat-cizzle-single/1579751807',['ok aight (feat. Cizzle)']),
    release('garfieldtracc','garfieldtracc','single','2021-08-03',1,'amazon_music','https://music.amazon.es/albums/B09C146J3L',['garfieldtracc']),
    release('she-started-it','She Started It','single','2021-09-17',1,'amazon_music','https://music.amazon.in/albums/B09GJSFYWQ',['She Started It']),
    release('trains-planes','Trains Planes','single','2021-09-23',1,'apple_music','https://music.apple.com/za/album/trains-planes-single/1587217204',['Trains Planes']),
    release('goals','goals','single','2021-10-05',1,'amazon_music','https://music.amazon.in/albums/B09HWWMRW1',['goals']),
    release('chairman-of-the-trap-5','Chairman of the Trap 5','ep','2021-10-22',5,'amazon_music','https://music.amazon.fr/albums/B09K6PPMNV',[
      'eleven','AOB','show out','my steps','the river',
    ]),
    release('aladdin','Aladdin','single','2021-11-10',1,'amazon_music','https://music.amazon.in/albums/B09LJ2C2SW',['Aladdin']),
    release('trouble','Trouble','single','2021-11-15',1,'amazon_music','https://music.amazon.in/albums/B09M1DBP63',['Trouble']),
    release('ah-ahh-ahh','Ah Ahh Ahh','single','2021-11-28',1,'apple_music','https://music.apple.com/gb/album/ah-ahh-ahh-single/1597978890',['Ah Ahh Ahh']),
    release('boo-hefner-spring-2022','Boo Hefner Spring 2022','ep','2022-04-16',5,'apple_music','https://music.apple.com/us/album/boo-hefner-spring-2022-ep/1620185230',[
      'Mercenaries & Merchandise','Moments','Johnny Gill (feat. Jodie Jo, Cizzle & Lyre Luciano)','Insomia (feat. Snubb Geez)','frfr',
    ]),
    release('an-ode-to-pussy','An Ode to Pussy','single','2025-04-28',1,'amazon_music','https://music.amazon.in/albums/B0F6PRGKPT',['An Ode to Pussy']),
  ];
  return Object.freeze(seeds);
}

export function catalogSongSeeds(
  releases:readonly PublicCatalogReleaseSeed[]=publicAtwoodBookieCatalogSeed(),
):readonly PublicCatalogSongSeed[] {
  const songs:PublicCatalogSongSeed[]=[];
  const seen=new Set<string>();
  for(const item of releases){
    for(const title of item.tracks){
      const base=slug(title);
      let songKey=base;
      let counter=2;
      while(seen.has(songKey)){
        songKey=base+'-'+counter;
        counter+=1;
      }
      seen.add(songKey);
      songs.push(Object.freeze({
        songKey,
        title,
        releaseKey:item.releaseKey,
        releaseDate:item.releaseDate,
        sourceUrl:item.sourceUrl,
        evidenceRefs:Object.freeze([...item.evidenceRefs]),
      }));
    }
  }
  return Object.freeze(songs);
}

export function buildSongIntelligenceQueue(songs:readonly SongIntelligenceInput[]):readonly SongIntelligenceTask[] {
  return Object.freeze(songs.map((song)=>{
    const validSections=song.sections.filter((section)=>
      section.endMs>section.startMs&&section.functions.length>0,
    );
    const ready=validSections.length>0;
    return Object.freeze({
      songKey:song.songKey,
      title:song.title,
      state:ready?'READY' as const:'ANALYSIS_REQUIRED' as const,
      sectionCount:validSections.length,
      reasons:Object.freeze(ready
        ? ['At least one evidence-backed section is available for section-level experiments.']
        : ['No verified section timings/functions exist; queue audio analysis instead of inventing timestamps.']),
      evidenceRefs:Object.freeze(unique(song.evidenceRefs)),
    });
  }));
}

export function buildSocialBaseline(
  observations:readonly PerformanceObservation[],
  minimumEligibleSamples=3,
):SocialBaselineSummary {
  const eligible=observations.filter((item)=>item.botRisk<=0.25&&item.attributionConfidence>=0.5&&item.evidenceRefs.length>0);
  const excludedSamples=observations.length-eligible.length;
  const evidenceRefs=unique(eligible.flatMap((item)=>item.evidenceRefs));
  if(eligible.length<minimumEligibleSamples){
    return Object.freeze({
      state:'INSUFFICIENT_DATA',
      eligibleSamples:eligible.length,
      excludedSamples,
      medianViews:0,
      medianSongActions:0,
      medianDirectFanCaptures:0,
      minimumExposures:100,
      evidenceRefs:Object.freeze(evidenceRefs),
    });
  }
  return Object.freeze({
    state:'READY',
    eligibleSamples:eligible.length,
    excludedSamples,
    medianViews:median(eligible.map((item)=>item.views)),
    medianSongActions:median(eligible.map((item)=>item.songActions)),
    medianDirectFanCaptures:median(eligible.map((item)=>item.directFanCaptures)),
    minimumExposures:Math.max(100,Math.floor(median(eligible.map((item)=>item.exposures))*0.25)),
    evidenceRefs:Object.freeze(evidenceRefs),
  });
}

export function planSearchExperiments(input:{
  songs:readonly Pick<PublicCatalogSongSeed,'songKey'|'title'|'evidenceRefs'>[];
  accounts?:readonly ResolvedArtistLink[];
  limit?:number;
}):readonly SearchExperimentPlan[] {
  const limit=Math.max(1,Math.min(12,input.limit??6));
  const platform=preferredSearchPlatform(input.accounts??[]);
  const families:SearchExperimentPlan['contentFamily'][]=['performance','story','visual-hook'];
  const plans:SearchExperimentPlan[]=[];
  for(const [index,song] of input.songs.slice(0,limit).entries()){
    const family=families[index%families.length]!;
    plans.push(Object.freeze({
      experimentKey:'commission-search:'+song.songKey+':'+family,
      songKey:song.songKey,
      contentFamily:family,
      platform,
      hypothesis:hypothesisFor(family,song.title),
      successSignal:'Replicated relative lift in song actions and direct-fan capture with acceptable traffic quality.',
      failureSignal:'No replicated downstream lift after the minimum evidence sample.',
      sampleTarget:300,
      spendMinor:0,
      currency:'USD',
      authority:'INTERNAL_PLANNING_ONLY',
      evidenceRefs:Object.freeze(unique(song.evidenceRefs)),
    }));
  }
  return Object.freeze(plans);
}

export function buildFanCityCommissionSummary(input:{
  cityDemand:readonly CityDemand[];
  directAudienceCount:number;
  evidenceRefs?:readonly string[];
}):FanCityCommissionSummary {
  const evidenceRefs=unique([
    ...(input.evidenceRefs??[]),
    ...input.cityDemand.flatMap((item)=>item.evidenceRefs),
  ]);
  const strongest=[...input.cityDemand].sort((a,b)=>cityStrength(b)-cityStrength(a))[0];
  const hasEvidence=input.cityDemand.length>0||input.directAudienceCount>0;
  return Object.freeze({
    state:hasEvidence?'READY':'DATA_REQUIRED',
    cityCount:input.cityDemand.length,
    directAudienceCount:Math.max(0,Math.floor(input.directAudienceCount)),
    strongestCity:strongest?.city,
    evidenceRefs:Object.freeze(evidenceRefs),
    warnings:Object.freeze(hasEvidence?[]:[
      'No live fan or city evidence exists yet; do not infer market demand from catalog presence.',
    ]),
  });
}

export function assessRightsMoneyCommission(input:{
  rights:readonly RightsRecord[];
  budget?:PromotionBudget;
}):RightsMoneyCommissionAssessment {
  const blockers:string[]=[];
  const rightsReady=input.rights.length>0&&input.rights.every((row)=>
    row.masterOwnershipKnown&&row.publishingKnown&&
    (row.sampleStatus==='none'||row.sampleStatus==='cleared')&&
    (row.thirdPartyUsageStatus==='none'||row.thirdPartyUsageStatus==='cleared'),
  );
  if(!rightsReady)blockers.push('RIGHTS_NOT_FULLY_MAPPED');
  if(!input.budget)blockers.push('NO_APPROVED_PROMOTION_BUDGET');
  const budgetReady=Boolean(input.budget&&input.budget.approvedMinor>0);
  if(input.budget&&input.budget.spentMinor>input.budget.approvedMinor)blockers.push('BUDGET_OVERRUN');
  return Object.freeze({
    attackEligible:rightsReady&&budgetReady&&blockers.length===0,
    rightsReady,
    budgetReady,
    blockers:Object.freeze(blockers),
    evidenceRefs:Object.freeze(unique(input.rights.flatMap((row)=>row.evidenceRefs))),
    authority:'ANALYSIS_ONLY',
  });
}

export function certifyAttackCanary():AttackCanaryCertification {
  const baseline={medianViews:800,medianSongActions:60,medianDirectFanCaptures:10,minimumExposures:500};
  const realA=detectCreativeOutlier(canaryObservation('real-a',2500,320,72,0.02,0.95,['canary:real:a']),baseline);
  const realB=detectCreativeOutlier(canaryObservation('real-b',2350,300,67,0.03,0.94,['canary:real:b']),baseline);
  const real=consolidateCreativeOutliers([
    {...realA,experimentId:'commission-real'},
    {...realB,experimentId:'commission-real'},
  ])[0]!;
  const fakeA=detectCreativeOutlier(canaryObservation('fake-a',60000,1,0,0.98,0.1,['canary:fake:a']),baseline);
  const fakeB=detectCreativeOutlier(canaryObservation('fake-b',62000,0,0,0.97,0.08,['canary:fake:b']),baseline);
  const fake=consolidateCreativeOutliers([
    {...fakeA,experimentId:'commission-fake'},
    {...fakeB,experimentId:'commission-fake'},
  ])[0]!;
  const realSignalMode=chooseJuggernautMode({outliers:[real]});
  const fakeSignalMode=chooseJuggernautMode({outliers:[fake]});
  const rights:RightsRecord={
    assetId:'commission-song',
    masterOwnershipKnown:false,
    publishingKnown:false,
    sampleStatus:'review_required',
    thirdPartyUsageStatus:'review_required',
    evidenceRefs:['canary:rights:unknown'],
  };
  const budget:PromotionBudget={
    approvedMinor:100000,
    spentMinor:0,
    experimentReserveMinor:25000,
    breakoutReserveMinor:50000,
    productionReserveMinor:25000,
    currency:'USD',
  };
  const rightsSpend=decidePromotionSpend({
    budget,mode:'ATTACK',outlier:real,rights,requestedMinor:10000,preAuthorizedLimitMinor:10000,
  });
  const paid=assessPaidScaleHealth({
    priorConversionRate:0.12,currentConversionRate:0.05,
    priorAcquisitionCostMinor:500,currentAcquisitionCostMinor:900,
    sampleSize:500,minimumSampleSize:100,evidenceRefs:['canary:paid'],
  });
  const traffic=assessPromotionTrafficQuality({
    exposures:100000,clicks:2500,songActions:0,repeatListeners:0,directFanCaptures:0,
    botRisk:0.95,attributionConfidence:0.1,evidenceRefs:['canary:traffic:fake'],
  });
  const readiness=assessBreakoutReadiness({
    followupSongReady:false,contentInventory:1,directFanCaptureReady:false,rightsMapped:false,
    teamCapacity:true,liveProfileReady:false,catalogDepth:1,evidenceRefs:['canary:readiness'],
  });
  const sense=makeMusicMakeSenseAudit({
    claim:'One spike proves the campaign can scale.',
    evidenceRefs:['canary:claim'],
    sampleSize:1,
    attributionConfidence:0.2,
    hasReplication:false,
    hasContradictoryEvidence:true,
    spendDecision:true,
  });
  const consequential=['public_publish','paid_publish','personal_fan_message','contract_sign','rights_grant','venue_commitment','budget_increase'] as const;
  const consequentialActionsBlocked=consequential.every((action)=>!decideJuggernautAutonomy(action).allowedWithoutApproval);
  const checks=[
    {name:'replicated-quality-signal-can-open-attack',passed:real.status==='validated'&&realSignalMode==='ATTACK'},
    {name:'fake-viral-signal-stays-search',passed:fakeSignalMode==='SEARCH'},
    {name:'unknown-rights-authorize-zero-spend',passed:rightsSpend.authorizedMinor===0&&rightsSpend.action==='STOP'},
    {name:'paid-degradation-stops-scale',passed:paid.action==='STOP'},
    {name:'fake-traffic-ineligible-for-learning',passed:traffic.status==='BLOCK'&&!traffic.learningEligible},
    {name:'weak-breakout-readiness-blocks-escalation',passed:!readiness.ready},
    {name:'weak-causal-claim-fails-make-it-make-sense',passed:!sense.passes},
    {name:'consequential-actions-remain-human-authorized',passed:consequentialActionsBlocked},
  ] as const;
  return Object.freeze({
    passed:checks.every((check)=>check.passed),
    realSignalMode,
    fakeSignalMode,
    rightsBlockedSpendMinor:rightsSpend.authorizedMinor,
    paidDegradationAction:paid.action,
    consequentialActionsBlocked,
    externalActionsStarted:false,
    checks:Object.freeze(checks.map((check)=>Object.freeze({...check}))),
  });
}

export function certifyMusicCommissionClosedLoop():MusicCommissionFinalCertification {
  const identity=canonicalAtwoodBookieIdentity();
  const catalog=publicAtwoodBookieCatalogSeed();
  const songs=catalogSongSeeds(catalog);
  const resolver=resolveArtistHubLinks([
    'https://open.spotify.com/artist/example',
    'https://music.apple.com/us/album/example/1',
    'javascript:alert(1)',
  ]);
  const sectionQueue=buildSongIntelligenceQueue([
    {songKey:'unknown',title:'Unknown Sections',sections:[],evidenceRefs:['song:unknown']},
    {
      songKey:'ready',title:'Ready Song',
      sections:[{id:'section:ready:1',songId:'ready',startMs:0,endMs:12000,label:'Hook',functions:['melody','loop']}],
      evidenceRefs:['song:ready'],
    },
  ]);
  const baseline=buildSocialBaseline([
    canaryObservation('baseline-1',900,70,11,0.02,0.9,['baseline:1']),
    canaryObservation('baseline-2',1000,75,12,0.03,0.9,['baseline:2']),
    canaryObservation('baseline-3',850,65,10,0.04,0.85,['baseline:3']),
    canaryObservation('baseline-bot',50000,0,0,0.99,0.05,['baseline:bot']),
  ]);
  const plans=planSearchExperiments({songs,accounts:resolver,limit:6});
  const fanCity=buildFanCityCommissionSummary({cityDemand:[],directAudienceCount:0});
  const rights=assessRightsMoneyCommission({
    rights:[{
      assetId:'seed-song',masterOwnershipKnown:false,publishingKnown:false,
      sampleStatus:'review_required',thirdPartyUsageStatus:'review_required',evidenceRefs:['rights:seed'],
    }],
  });
  const canary=certifyAttackCanary();
  const production=certifyMusicJuggernautProductionFinal();
  const checks=[
    {stage:'MUSIC-COMMISSION.1' as const,name:'canonical-atwood-bookie-identity',passed:
      identity.canonicalName==='Atwood Bookie'&&identity.ownerIdentity==='Bookie & Co'&&identity.canonicalHub==='https://solo.to/bookieandco'},
    {stage:'MUSIC-COMMISSION.2' as const,name:'provenance-aware-platform-link-resolution',passed:
      resolver.length===2&&resolver.every((item)=>item.evidenceRefs.length>=2)},
    {stage:'MUSIC-COMMISSION.3' as const,name:'verified-public-catalog-seed',passed:
      catalog.length>=15&&songs.length>=30&&catalog.every((item)=>item.sourceUrl.startsWith('https://'))},
    {stage:'MUSIC-COMMISSION.4' as const,name:'song-sections-never-fabricated',passed:
      sectionQueue[0]?.state==='ANALYSIS_REQUIRED'&&sectionQueue[1]?.state==='READY'},
    {stage:'MUSIC-COMMISSION.5' as const,name:'quality-filtered-social-baseline',passed:
      baseline.state==='READY'&&baseline.eligibleSamples===3&&baseline.excludedSamples===1},
    {stage:'MUSIC-COMMISSION.6' as const,name:'search-plans-are-zero-spend-internal-only',passed:
      plans.length===6&&plans.every((item)=>item.spendMinor===0&&item.authority==='INTERNAL_PLANNING_ONLY')},
    {stage:'MUSIC-COMMISSION.7' as const,name:'fan-city-graph-fails-closed-without-live-data',passed:
      fanCity.state==='DATA_REQUIRED'&&fanCity.cityCount===0},
    {stage:'MUSIC-COMMISSION.8' as const,name:'unknown-rights-and-budget-block-attack',passed:
      !rights.attackEligible&&rights.blockers.includes('RIGHTS_NOT_FULLY_MAPPED')&&rights.blockers.includes('NO_APPROVED_PROMOTION_BUDGET')},
    {stage:'MUSIC-COMMISSION.9' as const,name:'shadow-attack-canary-passes-with-zero-external-actions',passed:
      canary.passed&&!canary.externalActionsStarted},
    {stage:'MUSIC-COMMISSION.FINAL' as const,name:'closed-loop-production-certification',passed:
      production.passed&&canary.passed},
  ];
  return Object.freeze({
    version:MUSIC_COMMISSION_FINAL_VERSION,
    passed:checks.every((check)=>check.passed),
    checks:Object.freeze(checks.map((check)=>Object.freeze({...check}))),
    loop:Object.freeze([
      'IDENTIFY','DISCOVER','INGEST','UNDERSTAND','BASELINE','SEARCH','CAPTURE','GATE','ATTACK-CANARY','LEARN',
    ]),
    authority:'CERTIFICATION_ONLY',
    externalActionsStarted:false,
  });
}

function release(
  releaseKey:string,title:string,releaseType:PublicCatalogReleaseSeed['releaseType'],releaseDate:string,
  trackCount:number,sourcePlatform:PublicCatalogReleaseSeed['sourcePlatform'],sourceUrl:string,tracks:readonly string[],
):PublicCatalogReleaseSeed {
  return Object.freeze({
    releaseKey,title,releaseType,releaseDate,trackCount,sourcePlatform,sourceUrl,
    tracks:Object.freeze([...tracks]),
    evidenceRefs:Object.freeze(['public-catalog:'+sourcePlatform+':'+sourceUrl]),
  });
}

function classifyLink(url:URL):Pick<ResolvedArtistLink,'platform'|'kind'>|null {
  const host=url.hostname.toLowerCase().replace(/^www\./,'');
  const path=url.pathname.toLowerCase();
  if(host==='open.spotify.com')return {platform:'spotify',kind:path.startsWith('/artist/')?'artist':'catalog'};
  if(host.endsWith('music.apple.com'))return {platform:'apple_music',kind:path.includes('/artist/')?'artist':'catalog'};
  if(host.startsWith('music.amazon.')||host==='music.amazon.com')return {platform:'amazon_music',kind:path.includes('/artists/')?'artist':'catalog'};
  if(host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtu.be')return {platform:'youtube',kind:'social'};
  if(host==='instagram.com'||host.endsWith('.instagram.com'))return {platform:'instagram',kind:'social'};
  if(host==='tiktok.com'||host.endsWith('.tiktok.com'))return {platform:'tiktok',kind:'social'};
  if(host==='soundcloud.com'||host.endsWith('.soundcloud.com'))return {platform:'soundcloud',kind:'social'};
  if(host.endsWith('bandcamp.com'))return {platform:'bandcamp',kind:'commerce'};
  if(host==='facebook.com'||host.endsWith('.facebook.com'))return {platform:'facebook',kind:'social'};
  if(host==='x.com'||host==='twitter.com'||host.endsWith('.twitter.com'))return {platform:'x',kind:'social'};
  if(url.protocol==='https:')return {platform:'website',kind:'website'};
  return null;
}

function preferredSearchPlatform(accounts:readonly ResolvedArtistLink[]):string {
  for(const preferred of ['tiktok','instagram','youtube'] as const){
    if(accounts.some((item)=>item.platform===preferred))return preferred;
  }
  return 'cross-platform-staging';
}

function hypothesisFor(family:SearchExperimentPlan['contentFamily'],title:string):string {
  if(family==='performance')return 'A direct performance excerpt from '+title+' will create downstream song actions beyond the artist baseline.';
  if(family==='story')return 'A concise story/context frame around '+title+' will increase repeat engagement and profile-to-song actions.';
  return 'A strong first-second visual hook paired with '+title+' will improve qualified attention without sacrificing downstream action quality.';
}

function canaryObservation(
  id:string,views:number,songActions:number,directFanCaptures:number,
  botRisk:number,attributionConfidence:number,evidenceRefs:readonly string[],
):PerformanceObservation {
  return {
    id,experimentId:id,exposures:Math.max(views,3000),views,shares:100,saves:120,comments:40,
    profileVisits:150,songActions,directFanCaptures,botRisk,attributionConfidence,
    observedAt:'2026-09-30T12:00:00.000Z',evidenceRefs,
  };
}

function normalizeHttpUrl(value:string):string|null {
  try{
    const url=new URL(value.trim());
    if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
    url.hash='';
    return url.toString().replace(/\/$/,'');
  }catch{return null;}
}
function slug(value:string):string {
  const normalized=value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return normalized||'song';
}
function cityStrength(value:CityDemand):number {
  return value.directFans*4+value.showInterest*3+value.repeatFans*5+value.priorAttendees*4+value.listeners*0.01;
}
function median(values:readonly number[]):number {
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  const mid=Math.floor(sorted.length/2);
  return sorted.length%2===1?sorted[mid]??0:((sorted[mid-1]??0)+(sorted[mid]??0))/2;
}
function unique(values:readonly string[]):string[] {
  return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];
}
