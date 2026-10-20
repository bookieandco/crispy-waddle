/**
 * MUSIC-RESTORE.RECOVER.05-.08
 *
 * Separation between source-implemented features and independently evidenced
 * acceptance of infrastructure, real music, archive/device continuity and
 * optional advanced models. Pure; makes NO network, DB or spending requests.
 *
 * Caller evidence is not self-authenticating: production operator review must
 * validate the named receipts, actual uploaded bytes and observed devices.
 */
export type RestorationRecoveryStage = "05-infrastructure" | "06-first-song" |
  "07-two-song-archive-device" | "08-advanced-production";
export type RestorationRecoveryCheck = {
  id:string; passed:boolean; message:string;
};
export type RestorationRecoveryDecision = {
  status:"blocked"|"accepted";
  stages:Record<RestorationRecoveryStage,{
    status:"blocked"|"accepted"; checks:RestorationRecoveryCheck[];
  }>;
  reasons:string[];
};
export interface RecoveryInfrastructure {
  databaseConnected:boolean;
  schemaAndRlsReviewed:boolean;
  anonymousAndCrossOwnerDenied:boolean;
  storagePrivate:boolean;
  isolatedBackupRestoreVerified:boolean;
  workerHealthAdmitted:boolean;
  modelWeightsSha256?:string;
  modelAdmissionReceiptId?:string;
  realCanaryReceiptId?:string;
}
export interface RecoverySong {
  caseId:string;
  sourceArtifactId:string;
  sourceSha256:string;
  permission:"approved"|"review_required"|"denied";
  immutableBytesVerified:boolean;
  fourStemReceiptId?:string;
  perceptionReceiptIds?:string[];
  candidateId?:string;
  blindedABReceiptId?:string;
  ownerReviewReceiptId?:string;
  ownerApproved:boolean;
  outputSha256?:string;
  actualQcReceiptId?:string;
  alignedDawExportSha256?:string;
  durableFinalReceiptId?:string;
  audiblyReviewed:boolean;
}
export interface RecoveryArchive {
  remoteOnlyRestore:boolean;
  sourceSha256:string;
  restoredSha256:string;
  independentVerifierReceiptId?:string;
  restoredTimestamp?:string;
}
export interface RecoveryDevice {
  platform:"iphone-portrait"|"laptop";
  physicalDevice:boolean;
  ownerAuthenticated:boolean;
  privateCaseAccessVerified:boolean;
  savedAndReopened:boolean;
  playbackAuditioned:boolean;
  exportVerified:boolean;
  receiptId?:string;
}
export interface RecoveryAdvancedTrial {
  feature:"overlap-vocals"|"deep-drums"|"guitar-id"|"midi"|"native-plugins"|"wet-render";
  sourceLicensed:boolean;
  modelOrPluginDigest?:string;
  provenanceReceiptId?:string;
  benchmarkReceiptId?:string;
  realCounterexamplePassed:boolean;
  fullLengthRendered:boolean;
  approvedByOwner:boolean;
}
export interface RecoveryLaunchEvidence {
  infrastructure:RecoveryInfrastructure;
  firstSong?:RecoverySong;
  secondSong?:RecoverySong;
  permissionedMultitrackSha256?:string;
  multitrackPermissionApproved:boolean;
  multitrackReadbackSha256?:string;
  archive?:RecoveryArchive;
  devices:RecoveryDevice[];
  advancedTrials:RecoveryAdvancedTrial[];
}
const SHA=/^[a-f\d]{64}$/i;
const named=(v?:string)=>typeof v==="string" && v.trim().length>=6;
const validSha=(v?:string)=>typeof v==="string" && SHA.test(v);
function gate(id:string,passed:boolean,message:string):RestorationRecoveryCheck{
  return{id,passed,message};
}
function songChecks(song:RecoverySong|undefined,prefix:string):RestorationRecoveryCheck[]{
  return [
    gate(prefix+"-approved-source",Boolean(song&&song.permission==="approved"&&named(song.caseId)&&named(song.sourceArtifactId)&&validSha(song.sourceSha256)&&song.immutableBytesVerified),
      "An exact, rights-cleared immutable recording and source-hash readback are required."),
    gate(prefix+"-separated",Boolean(song&&named(song.fourStemReceiptId)&&
      song.perceptionReceiptIds&&new Set(song.perceptionReceiptIds).size>=5),
      "Real four-stem separation plus source/four-stem perception receipts are required."),
    gate(prefix+"-reviewed",Boolean(song&&named(song.candidateId)&&named(song.blindedABReceiptId)&&
      named(song.ownerReviewReceiptId)&&song.ownerApproved&&song.audiblyReviewed),
      "A/B audition and owner-approved consequential restoration are required."),
    gate(prefix+"-exported",Boolean(song&&validSha(song.outputSha256)&&named(song.actualQcReceiptId)&&
      validSha(song.alignedDawExportSha256)&&named(song.durableFinalReceiptId)),
      "Actual QC, aligned audible DAW export SHA-256, and durable FINAL receipt required."),
  ];
}
export function evaluateRestorationRecoveryLaunch(e:RecoveryLaunchEvidence):RestorationRecoveryDecision{
  const infra=e.infrastructure;
  const c05=[
    gate("database-live",infra.databaseConnected,"Current PostgreSQL connection must succeed."),
    gate("schema-rls-reviewed",infra.schemaAndRlsReviewed,
      "Review actual migration state, grants, RLS, storage ownership and private policies."),
    gate("negative-owner-tests",infra.anonymousAndCrossOwnerDenied,
      "Anonymous and second-owner isolation tests must both deny unrelated case access."),
    gate("storage-private",infra.storagePrivate,"Restoration source and derivatives cannot be publicly readable."),
    gate("isolated-restore",infra.isolatedBackupRestoreVerified,
      "An independently verified isolated database backup/restore is required before migration."),
    gate("worker-admitted",infra.workerHealthAdmitted&&validSha(infra.modelWeightsSha256)&&
      named(infra.modelAdmissionReceiptId)&&named(infra.realCanaryReceiptId),
      "Actual model digest, operator-admitted worker, and real-canary receipts are required."),
  ];
  const pass=(xs:RestorationRecoveryCheck[])=>xs.every(x=>x.passed);
  const c06=[
    gate("infrastructure-accepted",pass(c05),"Stage .05 must be accepted first."),
    ...songChecks(e.firstSong,"first-song"),
  ];
  const distinct=Boolean(e.firstSong&&e.secondSong&&
    e.firstSong.caseId!==e.secondSong.caseId &&
    e.firstSong.sourceSha256.toLowerCase()!==e.secondSong.sourceSha256.toLowerCase());
  const devices=(["iphone-portrait","laptop"] as const).map(platform=>{
    const d=e.devices.find(x=>x.platform===platform);
    return gate("device-"+platform,Boolean(d&&d.physicalDevice&&d.ownerAuthenticated&&
      d.privateCaseAccessVerified&&d.savedAndReopened&&d.playbackAuditioned&&
      d.exportVerified&&named(d.receiptId)),
      "Physical "+platform+" owner acceptance requires authenticated reopen, playback and export evidence.");
  });
  const c07=[
    gate("first-song-accepted",pass(c06),"Stage .06 must be accepted first."),
    ...songChecks(e.secondSong,"second-song"),
    gate("independent-sources",distinct,"Two different cases and original source hashes are required."),
    gate("rights-cleared-multitrack",e.multitrackPermissionApproved&&
      validSha(e.permissionedMultitrackSha256)&&
      e.permissionedMultitrackSha256?.toLowerCase()===e.multitrackReadbackSha256?.toLowerCase(),
      "Permissioned original multitrack must pass byte-level readback."),
    gate("remote-only-archive-restore",Boolean(e.archive&&e.archive.remoteOnlyRestore&&
      validSha(e.archive.sourceSha256)&&e.archive.sourceSha256.toLowerCase()===
      e.archive.restoredSha256.toLowerCase()&&named(e.archive.independentVerifierReceiptId)&&
      Number.isFinite(Date.parse(e.archive.restoredTimestamp??"invalid"))),
      "Restore from remote archive without relying on original local files, then independently re-hash."),
    ...devices,
  ];
  const expected=["overlap-vocals","deep-drums","guitar-id","midi","native-plugins","wet-render"] as const;
  const c08=[
    gate("baseline-two-song-accepted",pass(c07),"Stage .07 first; research alone cannot commission advanced models."),
    ...expected.map(feature=>{
      const trial=e.advancedTrials.find(x=>x.feature===feature);
      return gate("advanced-"+feature,Boolean(trial&&trial.sourceLicensed&&
        validSha(trial.modelOrPluginDigest)&&named(trial.provenanceReceiptId)&&
        named(trial.benchmarkReceiptId)&&trial.realCounterexamplePassed&&
        trial.fullLengthRendered&&trial.approvedByOwner),
        "Requires licensed source, digest, provenance, real counterexample, full song and explicit owner approval.");
    }),
  ];
  const stages={
    "05-infrastructure":c05,
    "06-first-song":c06,
    "07-two-song-archive-device":c07,
    "08-advanced-production":c08,
  } as const;
  const result={} as RestorationRecoveryDecision["stages"];
  for(const [stage,checks] of Object.entries(stages) as [RestorationRecoveryStage,RestorationRecoveryCheck[]][]){
    result[stage]={status:pass(checks)?"accepted":"blocked",checks};
  }
  return {status:result["08-advanced-production"].status,stages:result,
    reasons:Object.values(result).flatMap(s=>s.checks.filter(c=>!c.passed).map(c=>c.id))};
}
