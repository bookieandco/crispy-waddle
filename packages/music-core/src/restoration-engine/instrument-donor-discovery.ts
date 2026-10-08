import {
  compareInstrumentFingerprints,
  decideInstrumentReplacement,
  type InstrumentFamily,
  type InstrumentFingerprint,
  type RestorationGainEvidence,
} from "../instrument-replacement.js";

/**
 * MUSIC-RESTORE-HARDEN.5/.6: same-performance-first instrument donor research.
 * This is a *recommendation*, not reconstruction authorization or proof that a
 * new instrument timbre is actually the sound on the original tape.
 */
export type InstrumentIdentityOrigin =
  | "human-verified-track"
  | "model-classification-with-review"
  | "recording-session-metadata";

export type DonorRelationship =
  | "same-performance"
  | "same-song-other-take"
  | "same-session"
  | "authorized-external";

export interface InstrumentIdentityEvidence {
  family: InstrumentFamily;
  origin: InstrumentIdentityOrigin;
  evidenceIds: string[];
  confidence: number;
  reviewed: boolean;
}

export interface InstrumentDonorCandidate {
  id: string;
  label: string;
  artifactId: string;
  ownerUserId: string;
  caseId: string;
  canonicalRecordingId: string;
  relationship: DonorRelationship;
  fingerprint: InstrumentFingerprint;
  identity: InstrumentIdentityEvidence;
  gainEvidence: RestorationGainEvidence;
  sourceRegion: { startMs: number; endMs: number };
  rightsVerified: boolean;
  measuredAudioSha256: string;
  notes?: string;
}

export interface InstrumentDamageEvidence {
  repairability: "repairable" | "unrepairable" | "unknown";
  evidenceIds: string[];
  confidence: number;
  repairCandidatePassed: boolean;
}

export interface InstrumentDonorSearchRequest {
  sourceArtifactId: string;
  sourceUserId: string;
  caseId: string;
  canonicalRecordingId: string;
  observedFingerprint: InstrumentFingerprint;
  observedIdentity: InstrumentIdentityEvidence;
  damage: InstrumentDamageEvidence;
  donors: InstrumentDonorCandidate[];
}

export interface RankedInstrumentDonor {
  artifactId: string;
  candidateId: string;
  relationship: DonorRelationship;
  similarity: number;
  estimatedGain: number;
  priority: number;
  requiresHumanApproval: true;
  needsAlignmentAndListening: true;
  rationale: string;
}

export interface InstrumentDonorSearchResult {
  sourceArtifactId: string;
  disposition: "repair-first" | "review-replacement" | "preserve" | "abstain";
  ranked: RankedInstrumentDonor[];
  rejections: Array<{ candidateId: string; reason: string }>;
  reasons: string[];
  replacementPerformed: false;
  originalPreserved: true;
}

const scoreRelationship: Record<DonorRelationship, number> = {
  "same-performance": 4,
  "same-song-other-take": 3,
  "same-session": 2,
  "authorized-external": 1,
};

function evidenceValid(value: InstrumentIdentityEvidence): boolean {
  return Boolean(value.reviewed && value.family !== "unknown" &&
    value.confidence >= 0.75 && value.confidence <= 1 &&
    value.evidenceIds.length > 0 && value.evidenceIds.every(id => Boolean(id.trim())));
}

function damageVerified(value: InstrumentDamageEvidence): boolean {
  return value.confidence >= 0.7 && value.confidence <= 1 &&
    value.evidenceIds.length > 0 && value.evidenceIds.every(id => Boolean(id.trim()));
}

function finiteRegion(region: InstrumentDonorCandidate["sourceRegion"]): boolean {
  return Number.isFinite(region.startMs) && Number.isFinite(region.endMs) &&
    region.startMs >= 0 && region.endMs > region.startMs &&
    region.endMs - region.startMs >= 20 && region.endMs - region.startMs <= 30_000;
}

const SHA_256 = /^[a-f0-9]{64}$/i;

/**
 * Refuses a claim of acoustic/electric-guitar identity that is only a string
 * supplied by a model or browser. A measured fingerprint by itself is not a
 * trained instrument-family classifier. Missing evidence = abstain.
 */
export function rankInstrumentDonors(input: InstrumentDonorSearchRequest): InstrumentDonorSearchResult {
  if (!input.sourceArtifactId.trim() || !input.sourceUserId.trim() ||
      !input.caseId.trim() || !input.canonicalRecordingId.trim()) {
    throw new Error("Source owner, case, recording and artifact identity required.");
  }
  if (input.donors.length > 32) throw new Error("Donor search capped at 32 reviewed artifacts.");

  const result: InstrumentDonorSearchResult = {
    sourceArtifactId: input.sourceArtifactId,
    disposition: "abstain", ranked: [], rejections: [], reasons: [],
    replacementPerformed: false, originalPreserved: true,
  };

  if (!evidenceValid(input.observedIdentity) ||
      input.observedIdentity.family !== input.observedFingerprint.family) {
    result.reasons.push("Original instrument family lacks reviewed identification evidence.");
    return result;
  }
  if (!damageVerified(input.damage)) {
    result.reasons.push("Damage/repairability has not been established from measured evidence.");
    return result;
  }
  if (input.damage.repairability === "repairable" && input.damage.repairCandidatePassed) {
    result.disposition = "repair-first";
    result.reasons.push("Conservative repair is available; replacement is not preferred.");
    return result;
  }
  if (input.damage.repairability === "unknown") {
    result.reasons.push("Repair-versus-replace diagnosis is unresolved.");
    return result;
  }

  const seen = new Set<string>();
  for (const donor of input.donors) {
    const reject = (reason: string) => result.rejections.push({ candidateId: donor.id, reason });
    if (!donor.id.trim() || !donor.artifactId.trim() || seen.has(donor.artifactId)) {
      reject("Missing or duplicate candidate identity."); continue;
    }
    seen.add(donor.artifactId);
    if (donor.artifactId === input.sourceArtifactId ||
        donor.ownerUserId !== input.sourceUserId || donor.caseId !== input.caseId) {
      reject("Donor must be a distinct artifact owned by the same user and case."); continue;
    }
    if (!donor.rightsVerified || !SHA_256.test(donor.measuredAudioSha256) ||
        !finiteRegion(donor.sourceRegion)) {
      reject("Donor rights, SHA-256 or bounded source region unverified."); continue;
    }
    if (!evidenceValid(donor.identity) ||
        donor.identity.family !== donor.fingerprint.family ||
        donor.identity.family !== input.observedIdentity.family) {
      reject("Instrument identity not independently reviewed or family mismatch."); continue;
    }
    if (donor.relationship === "same-performance" &&
        donor.canonicalRecordingId !== input.canonicalRecordingId) {
      reject("Same-performance donor recording lineage conflicts with source."); continue;
    }
    if (donor.relationship === "same-song-other-take" &&
        donor.canonicalRecordingId === input.canonicalRecordingId) {
      reject("Different-take evidence contradicts identical recording."); continue;
    }
    if (donor.relationship === "authorized-external" && donor.identity.origin === "recording-session-metadata") {
      reject("External donor cannot rely solely on local session label."); continue;
    }

    let similarity: number;
    try { similarity = compareInstrumentFingerprints(input.observedFingerprint, donor.fingerprint); }
    catch { reject("Acoustic fingerprint contains invalid or nonfinite features."); continue; }

    const decision = decideInstrumentReplacement({
      observed: input.observedFingerprint,
      candidate: {
        id: donor.id, label: donor.label, fingerprint: donor.fingerprint,
        sourceArtifactId: input.sourceArtifactId, replacementArtifactId: donor.artifactId,
      },
      gainEvidence: donor.gainEvidence,
    });
    if (!decision.replace) { reject(decision.reason); continue; }
    const priority = scoreRelationship[donor.relationship] * 100 +
      Math.round(similarity * 60) +
      Math.round(decision.expectedRestorationGain * 20);
    result.ranked.push({
      candidateId: donor.id, artifactId: donor.artifactId,
      relationship: donor.relationship, similarity,
      estimatedGain: decision.expectedRestorationGain,
      priority, requiresHumanApproval: true, needsAlignmentAndListening: true,
      rationale: "Matched measured fingerprint and bounded gain; audition, pitch/timing/phase and identity review still required.",
    });
  }

  result.ranked.sort((a,b) => b.priority - a.priority || a.candidateId.localeCompare(b.candidateId));
  result.disposition = result.ranked.length ? "review-replacement" : "preserve";
  if (!result.ranked.length) result.reasons.push("No approved donor passed all identity, rights and gain gates; keep original or create separately labeled synthesis proposal.");
  else result.reasons.push("Candidate ordering is research-only; it does not authorize an instrument replacement.");
  return result;
}
