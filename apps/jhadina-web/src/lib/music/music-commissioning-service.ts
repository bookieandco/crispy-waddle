import {
  ATWOOD_BOOKIE_ARTIST_KEY,
  ATWOOD_BOOKIE_ARTIST_NAME,
  ATWOOD_BOOKIE_CANONICAL_HUB,
  ATWOOD_BOOKIE_OWNER_IDENTITY,
  assessRightsMoneyCommission,
  buildFanCityCommissionSummary,
  buildSocialBaseline,
  buildSongIntelligenceQueue,
  canonicalAtwoodBookieIdentity,
  catalogSongSeeds,
  certifyAttackCanary,
  certifyMusicCommissionClosedLoop,
  planSearchExperiments,
  publicAtwoodBookieArtistLinks,
  publicAtwoodBookieCatalogSeed,
  resolveArtistHubLinks,
  type CityDemand,
  type PerformanceObservation,
  type ResolvedArtistLink,
  type RightsRecord,
  type SongSection,
} from '@jhadina/growth-core';
import {resolveAtwoodBookieHub,type ArtistHubResolution} from './artist-hub-resolver';
import {createMusicCommissioningRepository,type MusicCommissioningRepository} from './music-commissioning-repository';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';
import {ensureMusicJuggernautProject,loadMusicJuggernautProjection} from './music-juggernaut-service';
import {isMusicRestorationRuntimeConfigured,musicRestorationRuntimeAuthMode} from './restoration-runtime-server';
import {syncMusicObservationsFromSocial} from './music-social-observation-sync';

type Row=Record<string,unknown>;
type ReceiptStatus='complete'|'data_required'|'blocked'|'failed';

export interface MusicCommissioningRunReceipt {
  artistKey:typeof ATWOOD_BOOKIE_ARTIST_KEY;
  artistName:typeof ATWOOD_BOOKIE_ARTIST_NAME;
  canonicalHub:typeof ATWOOD_BOOKIE_CANONICAL_HUB;
  projectId:string;
  releaseCount:number;
  songCount:number;
  platformLinkCount:number;
  royaltySnapshotCount:number;
  sectionAnalysisRequired:number;
  socialBaselineState:'READY'|'INSUFFICIENT_DATA';
  fanCityState:'READY'|'DATA_REQUIRED';
  rightsAttackEligible:boolean;
  shadowAttackCanaryPassed:boolean;
  closedLoopCertified:boolean;
  liveProviderDataReady:boolean;
  warnings:readonly string[];
  externalActionsStarted:false;
}

export interface MusicCommissioningStatus {
  project:Row;
  platformAccounts:Row[];
  catalogReleases:Row[];
  royaltySnapshots:Row[];
  receipts:Row[];
  certification:ReturnType<typeof certifyMusicCommissionClosedLoop>;
}

export async function runAtwoodBookieCommissioning(
  input:{userId:string},
  overrides:{
    musicRepository?:MusicJuggernautRepository;
    commissionRepository?:MusicCommissioningRepository;
    hubResolver?:()=>Promise<ArtistHubResolution>;
  }={},
):Promise<MusicCommissioningRunReceipt> {
  const musicRepository=overrides.musicRepository??createMusicJuggernautRepository();
  const commissionRepository=overrides.commissionRepository??createMusicCommissioningRepository();
  const hubResolver=overrides.hubResolver??(()=>resolveAtwoodBookieHub());
  const warnings:string[]=[];
  const identity=canonicalAtwoodBookieIdentity();

  const project=await ensureMusicJuggernautProject({
    userId:input.userId,
    artistKey:ATWOOD_BOOKIE_ARTIST_KEY,
    artistName:ATWOOD_BOOKIE_ARTIST_NAME,
    repository:musicRepository,
  });
  const projectId=String(project.id);

  const profile=await commissionRepository.upsertArtistProfile({
    projectId,
    artistKey:identity.artistKey,
    canonicalName:identity.canonicalName,
    ownerIdentity:identity.ownerIdentity,
    canonicalHub:identity.canonicalHub,
    aliases:[...identity.aliases],
    evidenceRefs:[...identity.evidenceRefs],
    status:'canonical',
  });
  await writeReceipt(commissionRepository,projectId,'MUSIC-COMMISSION.1','complete',identity.evidenceRefs,{
    canonicalName:ATWOOD_BOOKIE_ARTIST_NAME,
    ownerIdentity:ATWOOD_BOOKIE_OWNER_IDENTITY,
    canonicalHub:ATWOOD_BOOKIE_CANONICAL_HUB,
    profileId:String(profile.id),
  });

  const catalog=publicAtwoodBookieCatalogSeed();
  const hub=await hubResolver();
  warnings.push(...hub.warnings);
  const catalogLinks=resolveArtistHubLinks(catalog.map((item)=>item.sourceUrl),ATWOOD_BOOKIE_CANONICAL_HUB);
  const resolvedLinks=dedupeLinks([...publicAtwoodBookieArtistLinks(),...hub.resolvedLinks,...catalogLinks]);
  for(const link of resolvedLinks){
    await commissionRepository.upsertPlatformAccount({
      projectId,
      platform:link.platform,
      linkKind:link.kind,
      profileUrl:link.url,
      verificationState:'discovered',
      confidence:link.confidence,
      provenanceSource:hub.resolvedLinks.some((item)=>item.url===link.url)?ATWOOD_BOOKIE_CANONICAL_HUB:'verified-public-catalog',
      observedAt:hub.observedAt,
      evidenceRefs:[...link.evidenceRefs],
      metadata:{hubFetched:hub.fetched},
    });
  }
  await writeReceipt(commissionRepository,projectId,'MUSIC-COMMISSION.2','complete',
    unique([ATWOOD_BOOKIE_CANONICAL_HUB,...resolvedLinks.flatMap((item)=>item.evidenceRefs)]),{
      hubFetched:hub.fetched,
      discoveredLinkCount:resolvedLinks.length,
      outboundHubLinkCount:hub.outboundLinks.length,
      warningCount:hub.warnings.length,
    });

  for(const item of catalog){
    await commissionRepository.upsertCatalogRelease({
      projectId,
      releaseKey:item.releaseKey,
      title:item.title,
      releaseType:item.releaseType,
      releaseDate:item.releaseDate,
      trackCount:item.trackCount,
      sourcePlatform:item.sourcePlatform,
      sourceUrl:item.sourceUrl,
      verificationState:'verified',
      trackTitles:[...item.tracks],
      evidenceRefs:[...item.evidenceRefs],
      metadata:{seedKind:'verified-public-discovery',completeDiscographyClaim:false},
    });
  }

  const seeds=[...catalogSongSeeds(catalog)].sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate));
  const existingSongs=await musicRepository.listSongs(input.userId,projectId);
  const existingByKey=new Map(existingSongs.map((row)=>[String(row.song_key),row]));
  const songRows:Row[]=[];
  const songByKey=new Map<string,Row>();
  for(const seed of seeds){
    const existing=existingByKey.get(seed.songKey);
    const releaseStatus=existing?.release_status==='released'||existing?.release_status==='catalog'
      ? existing.release_status
      : 'catalog';
    const rightsState=existing?.rights_state==='clear'||existing?.rights_state==='blocked'
      ? existing.rights_state
      : 'review_required';
    const row=await musicRepository.upsertSong({
      projectId,
      songKey:seed.songKey,
      title:seed.title,
      releaseStatus,
      campaignState:typeof existing?.campaign_state==='string'?existing.campaign_state:'INGESTED',
      artistConviction:rate(existing?.artist_conviction,0.5),
      rightsState,
      sections:Array.isArray(existing?.sections)?existing.sections:[],
      evidenceRefs:unique([...stringArray(existing?.evidence_refs),...seed.evidenceRefs]),
      releaseDate:seed.releaseDate,
    });
    songRows.push(row);
    songByKey.set(seed.songKey,row);
  }
  const allSongs=await musicRepository.listSongs(input.userId,projectId);
  await writeReceipt(commissionRepository,projectId,'MUSIC-COMMISSION.3','complete',
    unique([
      ...catalog.flatMap((item)=>item.evidenceRefs),
      ...allSongs.flatMap((row)=>stringArray(row.evidence_refs)),
    ]),{
      releaseCount:catalog.length,
      verifiedPublicTrackCount:seeds.length,
      knownTitleCount:allSongs.length,
      publicSeedIsCompleteDiscography:false,
      sourcePlatforms:unique(catalog.map((item)=>item.sourcePlatform)),
    });

  const intelligenceQueue=buildSongIntelligenceQueue(allSongs.map((row)=>({
    songKey:String(row.song_key),
    title:String(row.title),
    sections:parseSections(row.sections,String(row.id)),
    evidenceRefs:stringArray(row.evidence_refs),
  })));
  const sectionAnalysisRequired=intelligenceQueue.filter((item)=>item.state==='ANALYSIS_REQUIRED').length;
  const perceptionRuntimeConfigured=await isMusicRestorationRuntimeConfigured();
  if(sectionAnalysisRequired&& !perceptionRuntimeConfigured){
    warnings.push('Music perception runtime is not configured; automatic section extraction cannot run yet.');
  }
  await writeReceipt(
    commissionRepository,
    projectId,
    'MUSIC-COMMISSION.4',
    sectionAnalysisRequired?'data_required':'complete',
    unique(intelligenceQueue.flatMap((item)=>item.evidenceRefs)),
    {
      songCount:intelligenceQueue.length,
      readySongCount:intelligenceQueue.length-sectionAnalysisRequired,
      sectionAnalysisRequired,
      perceptionRuntimeConfigured,
      perceptionRuntimeAuthMode:await musicRestorationRuntimeAuthMode(),
      fabricatedSectionTimings:false,
    },
  );

  const socialSync=await syncMusicObservationsFromSocial({
    userId:input.userId,
    artistKey:ATWOOD_BOOKIE_ARTIST_KEY,
    repository:musicRepository,
  });
  let projection=await loadMusicJuggernautProjection({
    userId:input.userId,
    artistKey:ATWOOD_BOOKIE_ARTIST_KEY,
    repository:musicRepository,
  });
  if(!projection)throw new Error('MUSIC_COMMISSION_PROJECT_PROJECTION_MISSING');
  const baseline=buildSocialBaseline(projection.observations.map(mapObservation));
  await writeReceipt(
    commissionRepository,
    projectId,
    'MUSIC-COMMISSION.5',
    baseline.state==='READY'?'complete':'data_required',
    baseline.evidenceRefs,
    {
      state:baseline.state,
      eligibleSamples:baseline.eligibleSamples,
      excludedSamples:baseline.excludedSamples,
      medianViews:baseline.medianViews,
      medianSongActions:baseline.medianSongActions,
      medianDirectFanCaptures:baseline.medianDirectFanCaptures,
      socialSynced:socialSync.synced,
      socialSkipped:socialSync.skipped,
      socialSkipReasons:socialSync.reasons,
    },
  );

  const plans=planSearchExperiments({songs:seeds,accounts:resolvedLinks,limit:6});
  let persistedPlans=0;
  for(const plan of plans){
    const song=songByKey.get(plan.songKey);
    if(!song)continue;
    await musicRepository.upsertExperiment({
      projectId,
      songId:String(song.id),
      experimentKey:plan.experimentKey,
      hypothesis:plan.hypothesis,
      contentFamily:plan.contentFamily,
      platform:plan.platform,
      spendMinor:0,
      currency:'USD',
      sampleTarget:plan.sampleTarget,
      successSignal:plan.successSignal,
      failureSignal:plan.failureSignal,
      status:'planned',
      evidenceRefs:[...plan.evidenceRefs],
    });
    persistedPlans+=1;
  }
  await writeReceipt(commissionRepository,projectId,'MUSIC-COMMISSION.6','complete',
    unique(plans.flatMap((item)=>item.evidenceRefs)),{
      plannedExperiments:persistedPlans,
      spendMinor:0,
      authority:'INTERNAL_PLANNING_ONLY',
      publicPostsStarted:0,
    });

  projection=await loadMusicJuggernautProjection({
    userId:input.userId,
    artistKey:ATWOOD_BOOKIE_ARTIST_KEY,
    repository:musicRepository,
  });
  if(!projection)throw new Error('MUSIC_COMMISSION_PROJECT_PROJECTION_MISSING_AFTER_SEARCH');
  const fanCity=buildFanCityCommissionSummary({
    cityDemand:projection.cityDemand.map(mapCityDemand),
    directAudienceCount:projection.fanAudience?.directlyReachable??0,
    evidenceRefs:projection.fanAudience?.evidenceRefs??[],
  });
  await writeReceipt(
    commissionRepository,
    projectId,
    'MUSIC-COMMISSION.7',
    fanCity.state==='READY'?'complete':'data_required',
    fanCity.evidenceRefs,
    {
      state:fanCity.state,
      cityCount:fanCity.cityCount,
      directAudienceCount:fanCity.directAudienceCount,
      strongestCity:fanCity.strongestCity??null,
      fabricatedDemand:false,
    },
  );

  const existingRights=new Map(projection.rights.map((row)=>[String(row.asset_key),row]));
  const rightsRows:Row[]=[];
  for(const song of allSongs){
    const assetKey=String(song.song_key);
    const current=existingRights.get(assetKey);
    if(current){
      rightsRows.push(current);
      continue;
    }
    rightsRows.push(await musicRepository.upsertRights({
      projectId,
      assetKey,
      masterOwnershipKnown:false,
      publishingKnown:false,
      sampleStatus:'review_required',
      thirdPartyUsageStatus:'review_required',
      evidenceRefs:unique([
        ...stringArray(song.evidence_refs),
        'commission:rights:unknown-until-documented',
      ]),
    }));
  }
  const royaltySnapshots=await commissionRepository.listRoyaltySnapshots(input.userId,projectId);
  const rightsGate=assessRightsMoneyCommission({rights:rightsRows.map(mapRights)});
  await writeReceipt(
    commissionRepository,
    projectId,
    'MUSIC-COMMISSION.8',
    rightsGate.attackEligible?'complete':'data_required',
    unique([
      ...rightsGate.evidenceRefs,
      ...royaltySnapshots.map((row)=>'royalty-snapshot:'+String(row.statement_ref??row.id)),
    ]),
    {
      attackEligible:rightsGate.attackEligible,
      rightsReady:rightsGate.rightsReady,
      budgetReady:rightsGate.budgetReady,
      blockers:[...rightsGate.blockers],
      royaltySnapshotCount:royaltySnapshots.length,
      historicalRevenueEvidenceAvailable:royaltySnapshots.length>0,
      unauthorizedSpendMinor:0,
    },
  );

  const canary=certifyAttackCanary();
  await writeReceipt(
    commissionRepository,
    projectId,
    'MUSIC-COMMISSION.9',
    canary.passed?'complete':'failed',
    unique(canary.checks.map((item)=>'commission-canary:'+item.name)),
    {
      passed:canary.passed,
      realSignalMode:canary.realSignalMode,
      fakeSignalMode:canary.fakeSignalMode,
      rightsBlockedSpendMinor:canary.rightsBlockedSpendMinor,
      paidDegradationAction:canary.paidDegradationAction,
      externalActionsStarted:false,
      syntheticShadowOnly:true,
    },
  );

  const closedLoop=certifyMusicCommissionClosedLoop();
  const liveProviderDataReady=
    baseline.state==='READY'&&
    fanCity.state==='READY'&&
    rightsGate.attackEligible&&
    resolvedLinks.some((item)=>item.kind==='artist'||item.kind==='social');
  await writeReceipt(
    commissionRepository,
    projectId,
    'MUSIC-COMMISSION.FINAL',
    closedLoop.passed?'complete':'failed',
    unique([
      ...closedLoop.checks.map((item)=>'commission-final:'+item.stage+':'+item.name),
      ...catalog.flatMap((item)=>item.evidenceRefs),
    ]),
    {
      certificationVersion:closedLoop.version,
      passed:closedLoop.passed,
      liveProviderDataReady,
      externalActionsStarted:false,
      authority:'CERTIFICATION_ONLY',
      missingLiveDataDoesNotBecomeSyntheticEvidence:true,
    },
  );

  if(!liveProviderDataReady){
    warnings.push('Closed-loop commissioning is certified, but live provider evidence is still incomplete; runtime remains evidence-gated.');
  }
  return Object.freeze({
    artistKey:ATWOOD_BOOKIE_ARTIST_KEY,
    artistName:ATWOOD_BOOKIE_ARTIST_NAME,
    canonicalHub:ATWOOD_BOOKIE_CANONICAL_HUB,
    projectId,
    releaseCount:catalog.length,
    songCount:allSongs.length,
    platformLinkCount:resolvedLinks.length,
    royaltySnapshotCount:royaltySnapshots.length,
    sectionAnalysisRequired,
    socialBaselineState:baseline.state,
    fanCityState:fanCity.state,
    rightsAttackEligible:rightsGate.attackEligible,
    shadowAttackCanaryPassed:canary.passed,
    closedLoopCertified:closedLoop.passed,
    liveProviderDataReady,
    warnings:Object.freeze(unique(warnings)),
    externalActionsStarted:false,
  });
}

export async function loadAtwoodBookieCommissioningStatus(
  input:{userId:string},
  overrides:{
    musicRepository?:MusicJuggernautRepository;
    commissionRepository?:MusicCommissioningRepository;
  }={},
):Promise<MusicCommissioningStatus|null> {
  const musicRepository=overrides.musicRepository??createMusicJuggernautRepository();
  const commissionRepository=overrides.commissionRepository??createMusicCommissioningRepository();
  const project=await musicRepository.getProject(input.userId,ATWOOD_BOOKIE_ARTIST_KEY);
  if(!project)return null;
  const projectId=String(project.id);
  const [platformAccounts,catalogReleases,royaltySnapshots,receipts]=await Promise.all([
    commissionRepository.listPlatformAccounts(input.userId,projectId),
    commissionRepository.listCatalogReleases(input.userId,projectId),
    commissionRepository.listRoyaltySnapshots(input.userId,projectId),
    commissionRepository.listReceipts(input.userId,projectId),
  ]);
  return {
    project,
    platformAccounts,
    catalogReleases,
    royaltySnapshots,
    receipts,
    certification:certifyMusicCommissionClosedLoop(),
  };
}

async function writeReceipt(
  repository:MusicCommissioningRepository,
  projectId:string,
  stage:string,
  status:ReceiptStatus,
  evidenceRefs:readonly string[],
  details:Row,
):Promise<Row> {
  return repository.upsertReceipt({
    projectId,stage,status,evidenceRefs:unique(evidenceRefs),details,
  });
}

function mapObservation(row:Row):PerformanceObservation {
  return {
    id:String(row.id),
    experimentId:String(row.experiment_id),
    exposures:numberValue(row.exposures),
    views:numberValue(row.views),
    engagedViews:optionalNumber(row.engaged_views),
    shares:numberValue(row.shares),
    saves:numberValue(row.saves),
    comments:numberValue(row.comments),
    profileVisits:numberValue(row.profile_visits),
    songActions:numberValue(row.song_actions),
    directFanCaptures:numberValue(row.direct_fan_captures),
    purchases:optionalNumber(row.purchases),
    revenueMinor:optionalNumber(row.revenue_minor),
    botRisk:rate(row.bot_risk,0),
    attributionConfidence:rate(row.attribution_confidence,0.5),
    observedAt:String(row.observed_at??row.created_at??new Date(0).toISOString()),
    evidenceRefs:evidence(row,'music-observation'),
  };
}

function mapCityDemand(row:Row):CityDemand {
  return {
    city:String(row.city_name??row.city_key??'Unknown'),
    listeners:numberValue(row.listeners),
    directFans:numberValue(row.direct_fans),
    showInterest:numberValue(row.show_interest),
    priorAttendees:numberValue(row.prior_attendees),
    repeatFans:numberValue(row.repeat_fans),
    evidenceRefs:evidence(row,'music-city-demand'),
  };
}

function mapRights(row:Row):RightsRecord {
  const sampleStatus=row.sample_status==='none'||row.sample_status==='cleared'||row.sample_status==='blocked'
    ?row.sample_status:'review_required';
  const thirdPartyUsageStatus=row.third_party_usage_status==='none'||row.third_party_usage_status==='cleared'||row.third_party_usage_status==='blocked'
    ?row.third_party_usage_status:'review_required';
  return {
    assetId:String(row.asset_key??row.id),
    masterOwnershipKnown:row.master_ownership_known===true,
    publishingKnown:row.publishing_known===true,
    sampleStatus,
    thirdPartyUsageStatus,
    evidenceRefs:evidence(row,'music-rights'),
  };
}

function parseSections(value:unknown,songId:string):SongSection[] {
  if(!Array.isArray(value))return [];
  return value.flatMap((raw,index)=>{
    if(!raw||typeof raw!=='object')return [];
    const row=raw as Row;
    const startMs=numberValue(row.startMs??row.start_ms);
    const endMs=numberValue(row.endMs??row.end_ms);
    const allowed=new Set(['lyric','melody','emotion','meme','performance','loop','structure']);
    const functions=Array.isArray(row.functions)
      ?row.functions.map(String).filter((item)=>allowed.has(item)) as SongSection['functions'][number][]
      :[];
    if(endMs<=startMs||!functions.length)return [];
    return [{
      id:String(row.id??('section:'+songId+':'+index)),
      songId,startMs,endMs,label:String(row.label??('Section '+(index+1))),functions,
    }];
  });
}

function dedupeLinks(links:readonly ResolvedArtistLink[]):ResolvedArtistLink[] {
  const map=new Map<string,ResolvedArtistLink>();
  for(const link of links){
    const current=map.get(link.url);
    if(!current||link.confidence>current.confidence)map.set(link.url,link);
  }
  return [...map.values()];
}
function evidence(row:Row,prefix:string):string[] {
  const refs=stringArray(row.evidence_refs);
  return refs.length?refs:[prefix+':'+String(row.id??'unknown')];
}
function stringArray(value:unknown):string[] {
  return Array.isArray(value)?value.map(String).filter(Boolean):[];
}
function numberValue(value:unknown):number {
  const n=Number(value);return Number.isFinite(n)&&n>=0?n:0;
}
function optionalNumber(value:unknown):number|undefined {
  if(value===null||value===undefined)return undefined;
  return numberValue(value);
}
function rate(value:unknown,fallback:number):number {
  const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
}
function unique(values:readonly string[]):string[] {
  return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];
}
