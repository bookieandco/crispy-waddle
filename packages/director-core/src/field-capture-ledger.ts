export type FieldCaptureKind=
  | 'interview'
  | 'b-roll'
  | 'raw-sound'
  | 'music'
  | 'match-cut'
  | 'timelapse'
  | 'drone'
  | 'reaction'
  | 'pickup'
  | 'phone'
  | 'other';

export interface FieldCaptureLogEntry {
  id:string;
  projectId:string;
  shootDay:string;
  capturedAt?:string;
  kind:FieldCaptureKind;
  assetIds:readonly string[];
  subjectIds:readonly string[];
  sceneOrTopic:string;
  notableMoment:string;
  cameraAngleIds?:readonly string[];
  audioAssetIds?:readonly string[];
  consentOrReleaseRefs?:readonly string[];
  locationResearchRefs?:readonly string[];
  tags:readonly string[];
  evidenceIds:readonly string[];
}

export interface FieldCaptureLedger {
  id:string;
  projectId:string;
  entries:readonly FieldCaptureLogEntry[];
  contingencyDayReserved:boolean;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_FIELD_CAPTURE_LEDGER';
}

export interface FieldCaptureLedgerDecision {
  valid:boolean;
  reasons:readonly string[];
  authority:'DIRECTOR_FIELD_CAPTURE_LEDGER_QC';
}

export function validateFieldCaptureLedger(ledger:FieldCaptureLedger):FieldCaptureLedgerDecision{
  const reasons:string[]=[];
  if(!ledger.id.trim()||!ledger.projectId.trim()) reasons.push('DIRECTOR_FIELD_LEDGER_IDENTITY_REQUIRED');
  if(!ledger.entries.length) reasons.push('DIRECTOR_FIELD_LEDGER_ENTRIES_REQUIRED');
  if(!ledger.evidenceIds.length) reasons.push('DIRECTOR_FIELD_LEDGER_EVIDENCE_REQUIRED');

  const ids=new Set<string>();
  for(const entry of ledger.entries){
    if(!entry.id.trim()||ids.has(entry.id)) reasons.push(`DIRECTOR_FIELD_ENTRY_ID_INVALID:${entry.id||'unknown'}`);
    ids.add(entry.id);
    if(entry.projectId!==ledger.projectId) reasons.push(`DIRECTOR_FIELD_ENTRY_PROJECT_MISMATCH:${entry.id}`);
    if(!entry.shootDay.trim()||!entry.sceneOrTopic.trim()||!entry.notableMoment.trim()){
      reasons.push(`DIRECTOR_FIELD_ENTRY_CONTEXT_REQUIRED:${entry.id}`);
    }
    if(!entry.assetIds.length) reasons.push(`DIRECTOR_FIELD_ENTRY_ASSET_REQUIRED:${entry.id}`);
    if(!entry.tags.length) reasons.push(`DIRECTOR_FIELD_ENTRY_TAG_REQUIRED:${entry.id}`);
    if(!entry.evidenceIds.length) reasons.push(`DIRECTOR_FIELD_ENTRY_EVIDENCE_REQUIRED:${entry.id}`);
    if(entry.kind==='interview'&&!(entry.consentOrReleaseRefs?.length)){
      reasons.push(`DIRECTOR_FIELD_INTERVIEW_RELEASE_REQUIRED:${entry.id}`);
    }
  }

  return Object.freeze({
    valid:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    authority:'DIRECTOR_FIELD_CAPTURE_LEDGER_QC',
  });
}
