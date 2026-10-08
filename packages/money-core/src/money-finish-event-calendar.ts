import {createHash} from 'node:crypto';
export const MONEY_EVENT_CALENDAR_SCHEMA='MONEY-FINISH-06-CALENDAR' as const;
export type MoneyMacroEvent=Readonly<{
  eventId:string;
  jurisdiction:string;
  eventKind:'ECONOMIC_RELEASE'|'CENTRAL_BANK'|'EARNINGS'|'MARKET_HOLIDAY'|'OTHER';
  affects:readonly string[];
  releaseAt:string;
  sourcePublishedAt:string;
  sourceAvailableAt:string;
  receivedAt:string;
  revisionPublishedAt?:string;
  sourceType:'OFFICIAL'|'LICENSED_PROVIDER';
  sourceEvidenceRefs:readonly string[];
  provenanceHash:string;
  status:'SCHEDULED'|'RELEASED'|'REVISED'|'CANCELLED';
  authority:'EVENT_EVIDENCE_ONLY';
}>;
export type MoneyEventGate=Readonly<{
  disposition:'ALLOW_RESEARCH'|'NO_TRADE'|'DATA_BLOCKED';
  reasonCodes:readonly string[];
  affectedEventIds:readonly string[];
  authority:'RESEARCH_POLICY_ONLY';
  canExecute:false;
  canAuthorizeLive:false;
  evidenceHash:string;
}>;
const digest=(o:unknown)=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
function t(v:string,code:string){const n=Date.parse(v);if(!v||!Number.isFinite(n))throw new Error(code);return n;}
export function assessMoneyEventWindow(input:Readonly<{
  events:readonly MoneyMacroEvent[];
  coverage:'VERIFIED'|'UNKNOWN';
  coverageEvidenceId:string;
  instrumentTags:readonly string[];
  informationCutoff:string;
  preEventMs:number;
  postEventMs:number;
}>):MoneyEventGate {
  const cutoff=t(input.informationCutoff,'MONEY_CALENDAR_CUTOFF_INVALID');
  if(!Number.isSafeInteger(input.preEventMs)||input.preEventMs<0||
     !Number.isSafeInteger(input.postEventMs)||input.postEventMs<0)throw new Error('MONEY_CALENDAR_POLICY_INVALID');
  if(input.coverage!=='VERIFIED'||!input.coverageEvidenceId.trim()) {
    return Object.freeze({disposition:'DATA_BLOCKED',reasonCodes:Object.freeze(['EVENT_COVERAGE_UNVERIFIED']),
      affectedEventIds:Object.freeze([]),authority:'RESEARCH_POLICY_ONLY',canExecute:false,
      canAuthorizeLive:false,evidenceHash:digest({coverage:input.coverage,cutoff})});
  }
  const ids=new Set<string>();
  const affected:string[]=[];
  const tags=new Set(input.instrumentTags);
  for(const ev of input.events){
    if(!ev.eventId.trim()||ids.has(ev.eventId)||!ev.provenanceHash.trim()||
       !ev.sourceEvidenceRefs.length||ev.authority!=='EVENT_EVIDENCE_ONLY'||
       (ev.sourceType!=='OFFICIAL'&&ev.sourceType!=='LICENSED_PROVIDER')) {
      throw new Error('MONEY_CALENDAR_EVENT_IDENTITY_INVALID');
    }
    ids.add(ev.eventId);
    const release=t(ev.releaseAt,'MONEY_CALENDAR_RELEASE_INVALID');
    const published=t(ev.sourcePublishedAt,'MONEY_CALENDAR_PUBLISHED_INVALID');
    const available=t(ev.sourceAvailableAt,'MONEY_CALENDAR_AVAILABLE_INVALID');
    const received=t(ev.receivedAt,'MONEY_CALENDAR_RECEIVED_INVALID');
    if(published>available||available>received||received>cutoff)
      throw new Error('MONEY_CALENDAR_FUTURE_OR_UNAVAILABLE_EVENT');
    if(ev.revisionPublishedAt) {
      const revised=t(ev.revisionPublishedAt,'MONEY_CALENDAR_REVISION_INVALID');
      if(ev.status!=='REVISED'||revised>available||revised<published)
        throw new Error('MONEY_CALENDAR_REVISION_CHRONOLOGY_INVALID');
    } else if(ev.status==='REVISED')throw new Error('MONEY_CALENDAR_REVISION_PROVENANCE_MISSING');
    // The actual released value may not be public before its scheduled release.
    if((ev.status==='RELEASED'||ev.status==='REVISED')&&available<release)
      throw new Error('MONEY_CALENDAR_EARLY_RELEASE_EVIDENCE_INVALID');
    if(ev.status==='CANCELLED'|| !ev.affects.some(tag=>tags.has(tag)))continue;
    if(cutoff>=release-input.preEventMs && cutoff<=release+input.postEventMs)affected.push(ev.eventId);
  }
  return Object.freeze({disposition:affected.length?'NO_TRADE':'ALLOW_RESEARCH',
    reasonCodes:Object.freeze(affected.length?['ECONOMIC_EVENT_BLACKOUT']:[]),
    affectedEventIds:Object.freeze(affected.sort()),authority:'RESEARCH_POLICY_ONLY',canExecute:false,
    canAuthorizeLive:false,evidenceHash:digest({coverage:input.coverageEvidenceId,cutoff,events:input.events.map(e=>e.provenanceHash),affected})});
}
