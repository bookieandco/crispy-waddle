/** RESTORE-UNIFY.6 -- creative timbre transfer model admission, not execution.
 *
 * Audio from DDSP or diffusion models is NEWLY SYNTHESIZED instrument audio,
 * never the authentic sound rescued from the source tape. This gate requires
 * measured source/controller data and licensed models before even presenting
 * the idea as eligible for a separate authorized worker-render request.
 */
export type CreativeTimbreEngine = "magenta-ddsp" | "sony-diffusion-timbre";
export type PerformanceSourceMode = "monophonic-isolated" | "polyphonic-isolated" | "mixed";
export type CreativeTimbreAction = "abstain" | "render-eligible";

export interface CreativeTimbreProposal {
  ownerUserId: string;
  caseId: string;
  sourceArtifactId: string;
  sourceAudioSha256: string;
  sourceRole: "guitar" | "bass" | "piano" | "other";
  performanceMode: PerformanceSourceMode;
  sourceTimingEvidenceIds: string[];
  pitchTrackEvidenceId: string | null;
  targetFamily: "acoustic-guitar" | "electric-guitar" | "piano" | "bass" | "other";
  engine: CreativeTimbreEngine;
  sourceRightsVerified: boolean;
}

export interface LicensedTimbreModelRelease {
  /** Obtained from an independently trusted server-side allowlist, never a UI path. */
  trustedRegistryAdmission: boolean;
  engine: CreativeTimbreEngine;
  modelVersion: string;
  checkpointSha256: string;
  targetFamily: CreativeTimbreProposal["targetFamily"];
  modelLicenseReceiptId: string;
  trainingAudioRightsReceiptId: string;
  heldOutTimbreBenchmarkId: string;
  supportedModes: PerformanceSourceMode[];
}

export interface CreativeTimbreReview {
  approved: boolean;
  reviewerUserId: string;
  caseId: string;
  sourceArtifactId: string;
  reviewReceiptId: string;
}

export interface CreativeTimbreAdmission {
  action: CreativeTimbreAction;
  engine: CreativeTimbreEngine;
  outputClass: "creative-reconstruction";
  originalRecovered: false;
  sourceImmutable: true;
  executionPerformed: false;
  reasons: string[];
}

const HEX = /^[a-f0-9]{64}$/i;
export function admitCreativeTimbreTransfer(input: {
  proposal: CreativeTimbreProposal;
  release?: LicensedTimbreModelRelease;
  review?: CreativeTimbreReview;
}): CreativeTimbreAdmission {
  const { proposal: p, release: m, review: r } = input;
  const result: CreativeTimbreAdmission = {
    action: "abstain", engine: p.engine,
    outputClass: "creative-reconstruction",
    originalRecovered: false, sourceImmutable: true,
    executionPerformed: false, reasons: [],
  };
  if (!p.ownerUserId.trim() || !p.caseId.trim() || !p.sourceArtifactId.trim() ||
      !HEX.test(p.sourceAudioSha256) || !p.sourceRightsVerified ||
      !p.sourceTimingEvidenceIds.length ||
      p.sourceTimingEvidenceIds.some(e => !e.trim())) {
    result.reasons.push("Missing owner/source/rights/timing evidence.");
    return result;
  }
  if (p.performanceMode === "mixed" || !p.pitchTrackEvidenceId?.trim()) {
    result.reasons.push("Timbre transfer requires verified isolated source and pitch/performance controls.");
    return result;
  }
  // The distributed DDSP timbre-transfer demo does not establish polyphonic
  // guitar/chord reconstruction fidelity. It must abstain instead of inventing it.
  if (p.engine === "magenta-ddsp" && p.performanceMode !== "monophonic-isolated") {
    result.reasons.push("DDSP admission limited to independently tested monophonic phrases.");
    return result;
  }
  if (p.engine === "sony-diffusion-timbre") {
    result.reasons.push("Sony diffusion model remains research-only until independent weight/license and acoustic validation.");
    return result;
  }
  if (!m || !m.trustedRegistryAdmission || m.engine !== p.engine ||
      m.targetFamily !== p.targetFamily || !HEX.test(m.checkpointSha256) ||
      !m.modelVersion.trim() || !m.modelLicenseReceiptId.trim() ||
      !m.trainingAudioRightsReceiptId.trim() ||
      !m.heldOutTimbreBenchmarkId.trim() ||
      !m.supportedModes.includes(p.performanceMode)) {
    result.reasons.push("No admitted, licensed, benchmarked model checkpoint matches this performance/timbre.");
    return result;
  }
  if (!r || !r.approved || r.reviewerUserId !== p.ownerUserId ||
      r.caseId !== p.caseId || r.sourceArtifactId !== p.sourceArtifactId ||
      !r.reviewReceiptId.trim()) {
    result.reasons.push("Source owner must approve creative timbre replacement.");
    return result;
  }
  result.action = "render-eligible";
  result.reasons.push("Eligible only for separately governed worker render, A/B and QC; this gate performed no inference or output mutation.");
  return result;
}
