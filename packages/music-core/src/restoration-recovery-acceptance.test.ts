import {describe,it,expect} from "vitest";
import {evaluateRestorationRecoveryLaunch,type RecoveryLaunchEvidence,type RecoverySong} from "./restoration-recovery-acceptance.js";
const sha=(x:string)=>x.repeat(64);
const song=(suffix:string):RecoverySong=>({
 caseId:"case-"+suffix,sourceArtifactId:"source-"+suffix,
 sourceSha256:sha(suffix),permission:"approved",immutableBytesVerified:true,
 fourStemReceiptId:"four-stems:"+suffix,
 perceptionReceiptIds:["source","vocals","drums","bass","other"].map(role=>role+suffix+":receipt"),
 candidateId:"candidate:"+suffix,blindedABReceiptId:"blind:"+suffix,
 ownerReviewReceiptId:"review:"+suffix,ownerApproved:true,outputSha256:sha("c"),
 actualQcReceiptId:"qc-receipt:"+suffix,alignedDawExportSha256:sha("d"),
 durableFinalReceiptId:"final:"+suffix,audiblyReviewed:true,
});
const full=():RecoveryLaunchEvidence=>({
 infrastructure:{databaseConnected:true,schemaAndRlsReviewed:true,
 anonymousAndCrossOwnerDenied:true,storagePrivate:true,
 isolatedBackupRestoreVerified:true,workerHealthAdmitted:true,
 modelWeightsSha256:sha("a"),modelAdmissionReceiptId:"model:passed",
 realCanaryReceiptId:"canary:passed"},
 firstSong:song("a"),secondSong:song("b"),
 permissionedMultitrackSha256:sha("e"),multitrackPermissionApproved:true,
 multitrackReadbackSha256:sha("e"),
 archive:{remoteOnlyRestore:true,sourceSha256:sha("a"),restoredSha256:sha("a"),
 independentVerifierReceiptId:"archive:verified",restoredTimestamp:"2026-10-19T20:00:00Z"},
 devices:(["iphone-portrait","laptop"] as const).map(platform=>({
  platform,physicalDevice:true,ownerAuthenticated:true,privateCaseAccessVerified:true,
  savedAndReopened:true,playbackAuditioned:true,exportVerified:true,receiptId:"owner:"+platform,
 })),
 advancedTrials:(["overlap-vocals","deep-drums","guitar-id","midi","native-plugins","wet-render"] as const).map(feature=>({
  feature,sourceLicensed:true,modelOrPluginDigest:sha("f"),provenanceReceiptId:"prov:"+feature,
  benchmarkReceiptId:"benchmark:"+feature,realCounterexamplePassed:true,fullLengthRendered:true,
  approvedByOwner:true,
 })),
});
describe("RECOVER .05-.08 source-vs-real-world acceptance",()=>{
 it("blocks every stage on unverified production evidence",()=>{
  const empty=full();empty.infrastructure.databaseConnected=false;
  expect(evaluateRestorationRecoveryLaunch(empty).stages["08-advanced-production"].status).toBe("blocked");
  expect(evaluateRestorationRecoveryLaunch(empty).stages["05-infrastructure"].status).toBe("blocked");
 });
 it("does not accept a rights-review fixture as real restored music",()=>{
  const x=full();x.firstSong!.permission="review_required";
  expect(evaluateRestorationRecoveryLaunch(x).stages["06-first-song"].status).toBe("blocked");
 });
 it("requires independent second source and genuine remote-only archive hash",()=>{
  const x=full();x.secondSong!.sourceSha256=x.firstSong!.sourceSha256;
  expect(evaluateRestorationRecoveryLaunch(x).stages["07-two-song-archive-device"].status).toBe("blocked");
  x.secondSong= song("b");x.archive!.restoredSha256=sha("1");
  expect(evaluateRestorationRecoveryLaunch(x).stages["07-two-song-archive-device"].status).toBe("blocked");
 });
 it("requires real portrait-phone acceptance, not a simulator screenshot",()=>{
  const x=full();x.devices[0]!.physicalDevice=false;
  expect(evaluateRestorationRecoveryLaunch(x).stages["07-two-song-archive-device"].checks.find(
   c=>c.id==="device-iphone-portrait")?.passed).toBe(false);
 });
 it("prevents commissioning advanced plugins from a donor ZIP",()=>{
  const x=full();x.advancedTrials.find(t=>t.feature==="native-plugins")!.realCounterexamplePassed=false;
  expect(evaluateRestorationRecoveryLaunch(x).stages["08-advanced-production"].status).toBe("blocked");
 });
 it("only accepts the whole sequence with independently asserted receipts",()=>{
  const x=full();const y=evaluateRestorationRecoveryLaunch(x);
  expect(y.status).toBe("accepted");expect(y.reasons).toEqual([]);
 });
});
