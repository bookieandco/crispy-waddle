export interface GuerrillaMusicOpportunity {
  id:string;
  concept:string;
  talkValue:number;
  artistFit:number;
  localFit:number;
  productionEase:number;
  permissionConfirmed:boolean;
  rightsClear:boolean;
  deceptive:boolean;
  spamRisk:number;
  evidenceRefs:readonly string[];
}

export interface GuerrillaMusicAssessment {
  opportunityId:string;
  score:number;
  eligible:boolean;
  blockers:readonly string[];
  authority:'PLANNING_ONLY';
}

export interface MusicCollaboratorCandidate {
  id:string;
  audienceOverlap:number;
  audienceComplement:number;
  trustTransfer:number;
  creativeFit:number;
  geographicFit:number;
  relationshipPotential:number;
  rawReach:number;
  evidenceRefs:readonly string[];
}

export interface MusicCollaboratorAssessment {
  candidateId:string;
  score:number;
  reasons:readonly string[];
  authority:'PLANNING_ONLY';
}

export type ReleaseRole='ACQUISITION'|'CONVERSION'|'FAN_DEPTH'|'UNRESOLVED';

export interface ReleaseRoleAssessment {
  role:ReleaseRole;
  confidence:number;
  reasons:readonly string[];
  authority:'ANALYSIS_ONLY';
}

export interface LivePerformanceReview {
  id:string;
  confidence:number;
  vocalControl:number;
  audienceEyeContact:number;
  crowdInteraction:number;
  movement:number;
  setPacing:number;
  recovery:number;
  observedAt:string;
  evidenceRefs:readonly string[];
}

export interface LivePerformanceProgress {
  currentId:string;
  overall:number;
  delta?:number;
  strongest:string;
  weakest:string;
  nextFocus:string;
  evidenceRefs:readonly string[];
  authority:'COACHING_ONLY';
}

export interface MusicSearchPresenceInput {
  canonicalArtistPage:boolean;
  canonicalSongPage:boolean;
  lyrics:boolean;
  credits:boolean;
  structuredMetadata:boolean;
  transcripts:boolean;
  storyContext:boolean;
  consistentEntityNaming:boolean;
  currentLinks:boolean;
  evidenceRefs:readonly string[];
}

export interface MusicSearchPresenceAssessment {
  score:number;
  missing:readonly string[];
  ready:boolean;
  authority:'PLANNING_ONLY';
}

export function assessGuerrillaMusicOpportunity(input:GuerrillaMusicOpportunity):GuerrillaMusicAssessment{
  for(const [name,value] of Object.entries({
    talkValue:input.talkValue,artistFit:input.artistFit,localFit:input.localFit,
    productionEase:input.productionEase,spamRisk:input.spamRisk,
  }))assertRate(value,name);
  if(!input.id.trim()||!input.concept.trim())throw new Error('MUSIC_JUGGERNAUT_GUERRILLA_ID_REQUIRED');
  const blockers:string[]=[];
  if(!input.permissionConfirmed)blockers.push('Location/partner permission is not confirmed.');
  if(!input.rightsClear)blockers.push('Rights are not clear.');
  if(input.deceptive)blockers.push('Concept depends on deception or fabricated social proof.');
  if(input.spamRisk>0.5)blockers.push('Spam risk is too high.');
  const score=round(Math.max(0,Math.min(1,
    input.talkValue*0.35+input.artistFit*0.25+input.localFit*0.2+input.productionEase*0.2-input.spamRisk*0.4
  )));
  return Object.freeze({opportunityId:input.id,score,eligible:blockers.length===0&&score>=0.5,blockers:Object.freeze(blockers),authority:'PLANNING_ONLY'});
}

export function assessMusicCollaborator(candidate:MusicCollaboratorCandidate):MusicCollaboratorAssessment{
  for(const [name,value] of Object.entries({
    audienceOverlap:candidate.audienceOverlap,audienceComplement:candidate.audienceComplement,
    trustTransfer:candidate.trustTransfer,creativeFit:candidate.creativeFit,geographicFit:candidate.geographicFit,
    relationshipPotential:candidate.relationshipPotential,rawReach:candidate.rawReach,
  }))assertRate(value,name);
  if(!candidate.evidenceRefs.length)throw new Error('MUSIC_JUGGERNAUT_COLLAB_EVIDENCE_REQUIRED');
  const score=round(
    candidate.trustTransfer*0.22+
    candidate.creativeFit*0.22+
    candidate.audienceComplement*0.18+
    candidate.relationshipPotential*0.18+
    candidate.geographicFit*0.1+
    candidate.audienceOverlap*0.07+
    candidate.rawReach*0.03
  );
  return Object.freeze({
    candidateId:candidate.id,
    score,
    reasons:Object.freeze([
      'Creative fit and trust transfer outweigh raw reach.',
      'Audience complement and long-term relationship value are explicit inputs.',
    ]),
    authority:'PLANNING_ONLY',
  });
}

export function classifyReleaseRole(input:{
  coldReachRate:number;
  profileTransferRate:number;
  secondSongRate:number;
  repeatListenerRate:number;
  directFanRate:number;
  existingFanEngagement:number;
}):ReleaseRoleAssessment{
  for(const [name,value] of Object.entries(input))assertRate(value,name);
  const acquisition=input.coldReachRate*0.55+input.profileTransferRate*0.45;
  const conversion=input.secondSongRate*0.45+input.repeatListenerRate*0.35+input.directFanRate*0.2;
  const fanDepth=input.existingFanEngagement*0.55+input.repeatListenerRate*0.25+input.directFanRate*0.2;
  const ranked=[
    ['ACQUISITION',acquisition],
    ['CONVERSION',conversion],
    ['FAN_DEPTH',fanDepth],
  ] as const;
  const sorted=[...ranked].sort((a,b)=>b[1]-a[1]);
  const winner=sorted[0]!;
  const runner=sorted[1]!;
  const confidence=round(Math.max(0,Math.min(1,winner[1]-runner[1]+winner[1]*0.5)));
  if(winner[1]<0.2)return Object.freeze({role:'UNRESOLVED',confidence,reasons:Object.freeze(['Current behavior is too weak to assign a durable release role.']),authority:'ANALYSIS_ONLY'});
  return Object.freeze({
    role:winner[0],
    confidence,
    reasons:Object.freeze(['Role is descriptive of observed audience behavior, not a judgment of artistic value.']),
    authority:'ANALYSIS_ONLY',
  });
}

export function assessLivePerformanceProgress(current:LivePerformanceReview,previous?:LivePerformanceReview):LivePerformanceProgress{
  validateReview(current);
  if(previous)validateReview(previous);
  const metrics={
    confidence:current.confidence,
    vocalControl:current.vocalControl,
    audienceEyeContact:current.audienceEyeContact,
    crowdInteraction:current.crowdInteraction,
    movement:current.movement,
    setPacing:current.setPacing,
    recovery:current.recovery,
  };
  const entries=Object.entries(metrics);
  const strongest=[...entries].sort((a,b)=>b[1]-a[1])[0]!;
  const weakest=[...entries].sort((a,b)=>a[1]-b[1])[0]!;
  const overall=round(entries.reduce((sum,[,value])=>sum+value,0)/entries.length);
  let delta:number|undefined;
  if(previous){
    const prior=[previous.confidence,previous.vocalControl,previous.audienceEyeContact,previous.crowdInteraction,previous.movement,previous.setPacing,previous.recovery];
    delta=round(overall-(prior.reduce((sum,value)=>sum+value,0)/prior.length));
  }
  return Object.freeze({
    currentId:current.id,overall,delta,strongest:strongest[0],weakest:weakest[0],
    nextFocus:'Run the next performance with one deliberate experiment around '+weakest[0]+'.',
    evidenceRefs:Object.freeze([...new Set([...(previous?.evidenceRefs??[]),...current.evidenceRefs])]),
    authority:'COACHING_ONLY',
  });
}

export function assessMusicSearchPresence(input:MusicSearchPresenceInput):MusicSearchPresenceAssessment{
  if(!input.evidenceRefs.length)throw new Error('MUSIC_JUGGERNAUT_SEARCH_EVIDENCE_REQUIRED');
  const checks:Array<[string,boolean]>=[
    ['canonical artist page',input.canonicalArtistPage],
    ['canonical song page',input.canonicalSongPage],
    ['lyrics',input.lyrics],
    ['credits',input.credits],
    ['structured metadata',input.structuredMetadata],
    ['transcripts',input.transcripts],
    ['story/context',input.storyContext],
    ['consistent entity naming',input.consistentEntityNaming],
    ['current destination links',input.currentLinks],
  ];
  const missing=checks.filter(([,present])=>!present).map(([label])=>label);
  const score=round((checks.length-missing.length)/checks.length);
  return Object.freeze({score,missing:Object.freeze(missing),ready:score>=0.8,authority:'PLANNING_ONLY'});
}

function validateReview(review:LivePerformanceReview):void{
  if(!review.id.trim()||!review.evidenceRefs.length)throw new Error('MUSIC_JUGGERNAUT_LIVE_REVIEW_EVIDENCE_REQUIRED');
  if(!Number.isFinite(Date.parse(review.observedAt)))throw new Error('MUSIC_JUGGERNAUT_LIVE_REVIEW_DATE_INVALID');
  for(const [name,value] of Object.entries({
    confidence:review.confidence,vocalControl:review.vocalControl,audienceEyeContact:review.audienceEyeContact,
    crowdInteraction:review.crowdInteraction,movement:review.movement,setPacing:review.setPacing,recovery:review.recovery,
  }))assertRate(value,name);
}
function assertRate(value:number,field:string):void{if(!Number.isFinite(value)||value<0||value>1)throw new Error('MUSIC_JUGGERNAUT_RATE_INVALID:'+field);}
function round(value:number):number{return Math.round(value*10000)/10000;}
