import {createHash} from 'node:crypto';
import {isAbsolute,normalize,relative,sep} from 'node:path';
// SALVAGE.01-.05 audit only. No database or provider calls.
export type ArtifactKind='ORIGINAL_DB_CANDIDATE'|'ORIGINAL_EXPORT_CANDIDATE'|
 'MARKET_ARCHIVE'|'CHAIN_ARCHIVE'|'CI_INVENTORY'|'HANDOFF'|'SYNTHETIC';
export type SalvageArtifact=Readonly<{id:string;kind:ArtifactKind;origin:string;
 sha256:string;bytes:number;sourceRef:string;discoveredAt:string}>;
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const digest=(x:string)=>/^[a-f0-9]{64}$/.test(x);
const date=(x:string)=>Number.isFinite(Date.parse(x));
const dispositions:Record<ArtifactKind,string>={
 ORIGINAL_DB_CANDIDATE:'ORIGINAL_UNVERIFIED',
 ORIGINAL_EXPORT_CANDIDATE:'ORIGINAL_UNVERIFIED',
 MARKET_ARCHIVE:'RECONSTRUCTED_RESEARCH_ONLY',
 CHAIN_ARCHIVE:'RECONSTRUCTED_RESEARCH_ONLY',
 CI_INVENTORY:'NON_LEDGER_EVIDENCE',
 HANDOFF:'NON_LEDGER_EVIDENCE',
 SYNTHETIC:'SYNTHETIC_EXCLUDED',
};
export function classifySharkSalvage(files:readonly SalvageArtifact[]){
 if(files.length>20000)throw Error('SALVAGE_SIZE_LIMIT');
 const seen=new Map<string,string>();
 const entries:Array<SalvageArtifact&{disposition:string;originalRestored:false;
   mayUpdateForwardLearning:false;canExecute:false;canAuthorizeLive:false}>=[];
 for(const f of files){
  if(!f.id?.trim()||!f.origin?.trim()||!f.sourceRef?.trim()||
     !digest(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<=0||
     !date(f.discoveredAt)||!Object.prototype.hasOwnProperty.call(dispositions,f.kind))
    throw Error('SALVAGE_INPUT_INVALID');
  const {discoveredAt,...identity}=f;
  const hash=sha(identity),prior=seen.get(f.id);
  if(prior&&prior!==hash)throw Error('SALVAGE_ID_CONFLICT');
  if(prior){
    const earlier=entries.find(x=>x.id===f.id)!;
    if(Date.parse(discoveredAt)<Date.parse(earlier.discoveredAt))
      entries[entries.indexOf(earlier)]={...earlier,discoveredAt};
    continue;
  }
  seen.set(f.id,hash);
  const synthetic=f.kind==='SYNTHETIC'||/synthetic|canary|fixture/i.test(f.id+' '+f.sourceRef);
  entries.push(Object.freeze({...f,disposition:synthetic?'SYNTHETIC_EXCLUDED':dispositions[f.kind],
   originalRestored:false as const,mayUpdateForwardLearning:false as const,
   canExecute:false as const,canAuthorizeLive:false as const}));
 }
 entries.sort((a,b)=>a.id.localeCompare(b.id));
 return Object.freeze({schema:'SHARK-HISTORY-SALVAGE.v1' as const,
  manifestHash:sha(entries.map(({discoveredAt,...identity})=>identity)),
  entries:Object.freeze(entries),
  originalRestored:false as const,authority:'AUDIT_ONLY' as const,
  canExecute:false as const,canAuthorizeLive:false as const});
}
export type HistoricalMarket=Readonly<{token:string;pair:string;source:string;
 sha256:string;priceUsd:number;eventAt:string;availableAt:string;
 capturedAt:string;hypotheticalDecisionAt:string}>;
export function admitReconstructedMarket(m:HistoricalMarket){
 if(!m.token||!m.pair||!m.source||!digest(m.sha256)||
    !Number.isFinite(m.priceUsd)||m.priceUsd<=0||
    ![m.eventAt,m.availableAt,m.capturedAt,m.hypotheticalDecisionAt].every(date))
   throw Error('SALVAGE_MARKET_INVALID');
 const event=Date.parse(m.eventAt),available=Date.parse(m.availableAt);
 const captured=Date.parse(m.capturedAt),decision=Date.parse(m.hypotheticalDecisionAt);
 const reason=event>available||available>captured?'SOURCE_CLOCK_CONFLICT':
   available>decision||event>decision?'FUTURE_INFORMATION':'RETROSPECTIVE_ONLY';
 return Object.freeze({reason,
  disposition:reason==='RETROSPECTIVE_ONLY'?'RESEARCH_ONLY' as const:'REJECTED' as const,
  originalDecisionCreated:false as const,forwardLearningAllowed:false as const,
  canExecute:false as const});
}
const overlaps=(a:string,b:string)=>{
 const r=relative(a,b),rev=relative(b,a);
 return a===b||r===''||rev===''||
  (r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r))||
  (rev!=='..'&&!rev.startsWith('..'+sep)&&!isAbsolute(rev));
};
export function planFreshShadowHistory(input:Readonly<{
 originalStatus:'UNAVAILABLE'|'SYNTHETIC_ONLY'|'EXTERNAL_CERTIFICATION_PENDING';
 originalRoot:string;newRoot:string;approved:boolean;ownerHostVerified:boolean;
 mountVerified:boolean;encryptedOffsiteRestoreVerified:boolean;paperOnly:boolean;
}>){
 const blockers:string[]=[];
 if(input.originalStatus!=='UNAVAILABLE')blockers.push('ORIGINAL_REVIEW_REQUIRED');
 if(!isAbsolute(input.originalRoot)||!isAbsolute(input.newRoot)||
    input.originalRoot==='/'||input.newRoot==='/'||
    overlaps(normalize(input.originalRoot),normalize(input.newRoot)))
    blockers.push('ISOLATED_ROOT_REQUIRED');
 if(!input.approved)blockers.push('OWNER_APPROVAL_REQUIRED');
 if(!input.ownerHostVerified)blockers.push('OWNER_HOST_UNVERIFIED');
 if(!input.mountVerified)blockers.push('DURABLE_MOUNT_UNVERIFIED');
 if(!input.encryptedOffsiteRestoreVerified)blockers.push('OFFSITE_RESTORE_UNVERIFIED');
 if(!input.paperOnly)blockers.push('PAPER_AUTHORITY_REQUIRED');
 return Object.freeze({state:blockers.length?'BLOCKED' as const:'OPERATOR_REVIEW_ONLY' as const,
  blockers:Object.freeze(blockers),label:'NEW_HISTORY_NOT_RECOVERED' as const,
  createsRuntime:false as const,originalOverwritten:false as const,
  originalRecovered:false as const,canExecute:false as const,canAuthorizeLive:false as const});
}
