import { describe, expect, it } from "vitest";
import {
  evaluateRestorationFinalCertification,
  type RestorationFinalEvidence,
} from "./restoration-final-certification.js";

function completeEvidence():RestorationFinalEvidence{
  const jobs=[
    {
      id:"separate-1",kind:"separate",status:"completed",sourceArtifactId:"source-1",
      outputArtifactIds:["vocals-1","drums-1","bass-1","other-1"],runtimeReceiptId:"separation:1",
    },
    ...["source-1","vocals-1","drums-1","bass-1","other-1"].map((id,index)=>({
      id:`perceive-${index}`,kind:"perceive",status:"completed",sourceArtifactId:id,
      outputArtifactIds:[],runtimeReceiptId:`perception:${index}`,
    })),
    {
      id:"repair-1",kind:"vocal-restore",status:"completed",sourceArtifactId:"vocals-1",
      outputArtifactIds:["restored-vocal-1"],runtimeReceiptId:"vocal:1",
    },
  ];
  return {
    runtimeProductionReady:true,
    sourceArtifact:{id:"source-1",kind:"source",sha256:"a".repeat(64)},
    requiredStemArtifactIds:{
      vocals:"vocals-1",drums:"drums-1",bass:"bass-1",other:"other-1",
    },
    jobs,
    evidenceCount:42,
    evidenceRuntimeReceiptCount:5,
    currentVersion:{
      id:"version-1",
      outputArtifactId:"restored-vocal-1",
      candidateId:"review-1",
      qcPassed:true,
    },
    approvedReview:{
      id:"review-1",
      artifactId:"restored-vocal-1",
      decision:"approved",
      qcReceiptId:"vocal:1",
      qcReceiptKind:"vocal-restoration",
    },
    currentOutputQcVerified:true,
    artifactHashesVerified:true,
    dawBundleSha256:"b".repeat(64),
  };
}

describe("MUSIC-RESTORE.FINAL certification",()=>{
  it("certifies only a fully receipt-bound real restoration",()=>{
    const decision=evaluateRestorationFinalCertification(completeEvidence());
    expect(decision.status).toBe("certified");
    expect(decision.reasons).toEqual([]);
    expect(decision.checks.every(item=>item.passed)).toBe(true);
  });

  it("fails closed when production runtime is not commissioned",()=>{
    const evidence=completeEvidence();
    evidence.runtimeProductionReady=false;
    const decision=evaluateRestorationFinalCertification(evidence);
    expect(decision.status).toBe("blocked");
    expect(decision.checks.find(item=>item.id==="runtime-ready")?.passed).toBe(false);
    expect(decision.reasons.join(" ")).toContain("runtime");
  });

  it("does not accept stems without the separation receipt that produced them",()=>{
    const evidence=completeEvidence();
    evidence.jobs=evidence.jobs.filter(job=>job.kind!=="separate");
    const decision=evaluateRestorationFinalCertification(evidence);
    expect(decision.status).toBe("blocked");
    expect(decision.checks.find(item=>item.id==="separation-receipt")?.passed).toBe(false);
  });

  it("requires perception for the source and every admitted stem",()=>{
    const evidence=completeEvidence();
    evidence.jobs=evidence.jobs.filter(job=>job.sourceArtifactId!=="bass-1"||job.kind!=="perceive");
    const decision=evaluateRestorationFinalCertification(evidence);
    expect(decision.checks.find(item=>item.id==="perception-receipts")?.passed).toBe(false);
  });

  it("requires the current approved output to originate from a consequential job",()=>{
    const evidence=completeEvidence();
    evidence.jobs=evidence.jobs.filter(job=>job.kind!=="vocal-restore");
    const decision=evaluateRestorationFinalCertification(evidence);
    expect(decision.checks.find(item=>item.id==="consequential-repair")?.passed).toBe(false);
  });

  it("requires approval to match the current version candidate and output",()=>{
    const evidence=completeEvidence();
    evidence.currentVersion={...evidence.currentVersion!,candidateId:"different-review"};
    const decision=evaluateRestorationFinalCertification(evidence);
    expect(decision.checks.find(item=>item.id==="human-review")?.passed).toBe(false);
  });

  it("keeps hash verification and bundle creation as separate final gates",()=>{
    const evidence=completeEvidence();
    evidence.artifactHashesVerified=false;
    evidence.dawBundleSha256=undefined;
    const decision=evaluateRestorationFinalCertification(evidence);
    expect(decision.checks.find(item=>item.id==="artifact-hashes")?.passed).toBe(false);
    expect(decision.checks.find(item=>item.id==="daw-bundle")?.passed).toBe(false);
  });
});
