export interface MusicFunnelMetrics {
  firstSecondRetention?:number;
  completionRate?:number;
  profileVisitRate?:number;
  songStartRate?:number;
  secondSongRate?:number;
  repeatListenerRate?:number;
  directFanCaptureRate?:number;
  purchaseRate?:number;
}
export type MusicBottleneck =
  | 'CONTENT_OPENING'
  | 'CONTENT_PAYOFF'
  | 'POSITIONING_CONTEXT'
  | 'MUSIC_HANDOFF'
  | 'CATALOG_DEPTH'
  | 'RELATIONSHIP_RETENTION'
  | 'OWNED_AUDIENCE'
  | 'MONETIZATION'
  | 'DISTRIBUTION'
  | 'INSUFFICIENT_EVIDENCE';

export interface MusicDiagnosis {
  bottleneck:MusicBottleneck;
  reasons:readonly string[];
  nextQuestion:string;
  authority:'ANALYSIS_ONLY';
}

export function diagnoseMusicFunnel(metrics:MusicFunnelMetrics):MusicDiagnosis{
  const entries=Object.entries(metrics).filter(([,value])=>value!==undefined) as [string,number][];
  if(entries.length<3)return result('INSUFFICIENT_EVIDENCE',['Too few downstream stages are measured.'],'Collect enough observations to distinguish content, song, and relationship failure.');
  for(const [name,value] of entries)assertRate(value,name);
  if((metrics.firstSecondRetention??1)<0.25)return result('CONTENT_OPENING',['People leave before the content earns attention.'],'Which opening mechanics improve first-second retention without misrepresenting the song?');
  if((metrics.completionRate??1)<0.3)return result('CONTENT_PAYOFF',['The opening survives, but the content does not sustain attention.'],'Is the wrapper, pacing, or selected song section failing to pay off?');
  if((metrics.profileVisitRate??1)<0.02)return result('POSITIONING_CONTEXT',['Attention is not turning into artist curiosity.'],'Does the content provide enough artist identity or context to make viewers want more?');
  if((metrics.songStartRate??1)<0.08)return result('MUSIC_HANDOFF',['Artist curiosity is not converting into music consumption.'],'Is the destination, CTA, or song framing creating friction?');
  if((metrics.secondSongRate??1)<0.12)return result('CATALOG_DEPTH',['Listeners start the song but rarely continue into catalog.'],'Is this a song-fit issue, catalog-navigation issue, or insufficient adjacent catalog?');
  if((metrics.repeatListenerRate??1)<0.12)return result('RELATIONSHIP_RETENTION',['Consumption is not becoming repeat behavior.'],'What repeat-exposure or artist-world context is missing?');
  if((metrics.directFanCaptureRate??1)<0.03)return result('OWNED_AUDIENCE',['Warm listeners are not entering a direct relationship.'],'Is there a useful, stage-appropriate reason to opt in?');
  if((metrics.purchaseRate??1)<0.01)return result('MONETIZATION',['Relationship depth is not translating into the current offer.'],'Does the offer make being a fan better, and is it timed for this fan stage?');
  return result('DISTRIBUTION',['Measured downstream stages are healthy enough that reach may be the limiting factor.'],'Which evidence-backed distribution channel can scale without degrading fan quality?');
}

export function makeItMakeSensePromotionAudit(input:{
  claimedCause:string;
  evidenceCount:number;
  replicated:boolean;
  attributionConfidence:number;
  botRisk:number;
  downstreamSignal:boolean;
  alternativeExplanations:readonly string[];
}):readonly string[]{
  if(!input.claimedCause.trim())throw new Error('MUSIC_JUGGERNAUT_CLAIM_REQUIRED');
  assertRate(input.attributionConfidence,'attributionConfidence');
  assertRate(input.botRisk,'botRisk');
  const warnings:string[]=[];
  if(input.evidenceCount<3)warnings.push('Sample is too small for a durable causal claim.');
  if(!input.replicated)warnings.push('Result has not replicated.');
  if(input.attributionConfidence<0.6)warnings.push('Attribution confidence is weak.');
  if(input.botRisk>0.2)warnings.push('Traffic-quality risk may contaminate the signal.');
  if(!input.downstreamSignal)warnings.push('Vanity performance has not translated into downstream music/fan behavior.');
  if(input.alternativeExplanations.length)warnings.push('Competing explanations remain: '+input.alternativeExplanations.join('; '));
  return Object.freeze(warnings);
}
function result(bottleneck:MusicBottleneck,reasons:readonly string[],nextQuestion:string):MusicDiagnosis{return Object.freeze({bottleneck,reasons:Object.freeze([...reasons]),nextQuestion,authority:'ANALYSIS_ONLY'});}
function assertRate(value:number,field:string):void{if(!Number.isFinite(value)||value<0||value>1)throw new Error('MUSIC_JUGGERNAUT_RATE_INVALID:'+field);}
