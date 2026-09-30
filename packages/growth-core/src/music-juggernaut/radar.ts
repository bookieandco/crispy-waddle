export interface CulturalSignal {
  id: string;
  topic: string;
  velocity: number;
  saturation: number;
  artistFit: number;
  songFit: number;
  audienceFit: number;
  productionSpeed: number;
  brandFit: number;
  rightsRisk: number;
  evidenceRefs: readonly string[];
}

export interface CulturalOpening {
  signalId: string;
  score: number;
  decision: 'PASS'|'TEST'|'ATTACK';
  reasons: readonly string[];
  evidenceRefs: readonly string[];
  authority: 'ANALYSIS_ONLY';
}

export interface GuerrillaOpportunity {
  id: string;
  concept: string;
  expectedTalkValue: number;
  localFit: number;
  productionEase: number;
  permissionConfirmed: boolean;
  rightsClear: boolean;
  deceptive: boolean;
  spamRisk: number;
  evidenceRefs: readonly string[];
}

export interface GuerrillaAssessment {
  opportunityId: string;
  eligible: boolean;
  score: number;
  blockers: readonly string[];
  authority: 'PLANNING_ONLY';
}

export function scoreCulturalOpening(signal: CulturalSignal): CulturalOpening {
  for (const [name, value] of Object.entries({
    velocity:signal.velocity,
    saturation:signal.saturation,
    artistFit:signal.artistFit,
    songFit:signal.songFit,
    audienceFit:signal.audienceFit,
    productionSpeed:signal.productionSpeed,
    brandFit:signal.brandFit,
    rightsRisk:signal.rightsRisk,
  })) assertRate(value, name);
  if (!signal.id.trim() || !signal.topic.trim()) throw new Error('MUSIC_JUGGERNAUT_CULTURAL_SIGNAL_ID_REQUIRED');
  if (!signal.evidenceRefs.length) throw new Error('MUSIC_JUGGERNAUT_CULTURAL_EVIDENCE_REQUIRED');
  const positive =
    signal.velocity * 0.2 +
    signal.artistFit * 0.16 +
    signal.songFit * 0.2 +
    signal.audienceFit * 0.16 +
    signal.productionSpeed * 0.08 +
    signal.brandFit * 0.2;
  const penalty = signal.saturation * 0.18 + signal.rightsRisk * 0.45;
  const score = round(Math.max(0, Math.min(1, positive - penalty)));
  const decision = score >= 0.68 ? 'ATTACK' : score >= 0.42 ? 'TEST' : 'PASS';
  return Object.freeze({
    signalId:signal.id,
    score,
    decision,
    reasons:Object.freeze([
      'Trend velocity is weighted with artist, song, audience, and brand fit.',
      'Saturation and rights risk reduce the score.',
      decision === 'PASS' ? 'The connection is too weak or risky to chase.' : 'Opportunity is relevant enough for bounded experimentation.',
    ]),
    evidenceRefs:Object.freeze([...new Set(signal.evidenceRefs)]),
    authority:'ANALYSIS_ONLY',
  });
}

export function assessGuerrillaOpportunity(opportunity: GuerrillaOpportunity): GuerrillaAssessment {
  for (const [name, value] of Object.entries({
    expectedTalkValue:opportunity.expectedTalkValue,
    localFit:opportunity.localFit,
    productionEase:opportunity.productionEase,
    spamRisk:opportunity.spamRisk,
  })) assertRate(value, name);
  const blockers:string[]=[];
  if (!opportunity.permissionConfirmed) blockers.push('Required location/partner permission is not confirmed.');
  if (!opportunity.rightsClear) blockers.push('Rights are not clear.');
  if (opportunity.deceptive) blockers.push('Concept depends on deception or fabricated social proof.');
  if (opportunity.spamRisk > 0.5) blockers.push('Spam risk is too high.');
  const score = round((opportunity.expectedTalkValue*0.45)+(opportunity.localFit*0.3)+(opportunity.productionEase*0.25)-(opportunity.spamRisk*0.4));
  return Object.freeze({
    opportunityId:opportunity.id,
    eligible:blockers.length===0 && score>=0.4,
    score:Math.max(0,Math.min(1,score)),
    blockers:Object.freeze(blockers),
    authority:'PLANNING_ONLY',
  });
}

function assertRate(value:number, field:string):void{
  if(!Number.isFinite(value)||value<0||value>1)throw new Error('MUSIC_JUGGERNAUT_RATE_INVALID:'+field);
}
function round(value:number):number{return Math.round(value*10000)/10000;}
