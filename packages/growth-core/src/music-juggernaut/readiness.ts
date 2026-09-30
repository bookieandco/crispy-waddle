export interface BreakoutReadinessInput {
  followUpMusicReady:boolean;
  contentInventory:number;
  directFanCaptureReady:boolean;
  rightsMapped:boolean;
  liveAssetReady:boolean;
  teamCapacity:number;
  profileClarity:number;
  evidenceRefs:readonly string[];
}
export interface BreakoutReadiness {
  score:number;
  ready:boolean;
  blockers:readonly string[];
  evidenceRefs:readonly string[];
  authority:'ANALYSIS_ONLY';
}

export interface ManagementReadinessInput {
  inboundOpportunityLoad:number;
  weeklyAdminHours:number;
  unresolvedBusinessThreads:number;
  artistConsistency:number;
  audienceSignal:number;
  managerRapportExists:boolean;
  evidenceRefs:readonly string[];
}
export interface ManagementReadiness {
  score:number;
  state:'TOO_EARLY'|'OPTIONAL_LEVERAGE'|'REAL_BOTTLENECK';
  reasons:readonly string[];
  authority:'ANALYSIS_ONLY';
}

export function assessBreakoutReadiness(input:BreakoutReadinessInput):BreakoutReadiness{
  assertRate(input.teamCapacity,'teamCapacity');
  assertRate(input.profileClarity,'profileClarity');
  if(!Number.isInteger(input.contentInventory)||input.contentInventory<0)throw new Error('MUSIC_JUGGERNAUT_CONTENT_INVENTORY_INVALID');
  const blockers:string[]=[];
  if(!input.followUpMusicReady)blockers.push('No release-ready follow-up music.');
  if(input.contentInventory<5)blockers.push('Breakout content inventory is thin.');
  if(!input.directFanCaptureReady)blockers.push('No direct-fan capture path is ready.');
  if(!input.rightsMapped)blockers.push('Rights are not mapped.');
  if(!input.liveAssetReady)blockers.push('Live/booking proof package is not ready.');
  if(input.teamCapacity<0.5)blockers.push('Team capacity is too low for a high-tempo breakout.');
  if(input.profileClarity<0.5)blockers.push('Artist destination/profile does not yet explain the project clearly.');
  const score=round(Math.max(0,1-(blockers.length/7)));
  return Object.freeze({score,ready:blockers.length<=1,blockers:Object.freeze(blockers),evidenceRefs:Object.freeze([...new Set(input.evidenceRefs)]),authority:'ANALYSIS_ONLY'});
}

export function assessManagementReadiness(input:ManagementReadinessInput):ManagementReadiness{
  assertRate(input.artistConsistency,'artistConsistency');
  assertRate(input.audienceSignal,'audienceSignal');
  if(!Number.isFinite(input.inboundOpportunityLoad)||input.inboundOpportunityLoad<0)throw new Error('MUSIC_JUGGERNAUT_OPPORTUNITY_LOAD_INVALID');
  if(!Number.isFinite(input.weeklyAdminHours)||input.weeklyAdminHours<0)throw new Error('MUSIC_JUGGERNAUT_ADMIN_HOURS_INVALID');
  if(!Number.isInteger(input.unresolvedBusinessThreads)||input.unresolvedBusinessThreads<0)throw new Error('MUSIC_JUGGERNAUT_BUSINESS_THREADS_INVALID');
  const load=Math.min(1,input.inboundOpportunityLoad/10)*0.3+Math.min(1,input.weeklyAdminHours/15)*0.25+Math.min(1,input.unresolvedBusinessThreads/12)*0.2;
  const motion=input.artistConsistency*0.15+input.audienceSignal*0.1;
  const score=round(Math.min(1,load+motion));
  const state:ManagementReadiness['state']=score>=0.68?'REAL_BOTTLENECK':score>=0.4||input.managerRapportExists?'OPTIONAL_LEVERAGE':'TOO_EARLY';
  return Object.freeze({
    score,state,
    reasons:Object.freeze([
      state==='REAL_BOTTLENECK'?'Management can solve an actual coordination/leverage bottleneck.':state==='OPTIONAL_LEVERAGE'?'Management may add leverage, but the artist engine must remain primary.':'Keep building artist motion before treating management as the solution.',
      'Management readiness is based on workload and leverage, not stream count alone.',
    ]),
    authority:'ANALYSIS_ONLY',
  });
}
function assertRate(value:number,field:string):void{if(!Number.isFinite(value)||value<0||value>1)throw new Error('MUSIC_JUGGERNAUT_RATE_INVALID:'+field);}
function round(value:number):number{return Math.round(value*10000)/10000;}
