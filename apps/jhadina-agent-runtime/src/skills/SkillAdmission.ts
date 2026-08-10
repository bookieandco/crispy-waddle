import type { SkillDefinition } from "./SkillRegistry";
import type { SkillScanResult } from "./SkillScanner";

export interface SkillProvenance {
  source: string;
  sourceType: "builtin" | "user" | "repository" | "generated" | "unknown";
  contentDigest?: string;
  scannedAt: string;
  scannerVersion: string;
}

export interface SkillAdmissionRecord {
  skillId: string;
  decision: "approved" | "rejected";
  reason: string;
  provenance: SkillProvenance;
  findings: SkillScanResult["findings"];
}

/** Immutable-in-use admission record; persistence is delegated to Jhadina's audit store. */
export class SkillAdmission {
  constructor(private readonly scannerVersion = "1.0.0") {}

  evaluate(
    skill: SkillDefinition,
    scan: SkillScanResult,
    provenance: Omit<SkillProvenance, "scannedAt" | "scannerVersion">,
  ): SkillAdmissionRecord {
    const approved = scan.approved && skill.status !== "disabled";

    return {
      skillId: skill.id,
      decision: approved ? "approved" : "rejected",
      reason: approved
        ? "Skill passed deterministic admission checks"
        : "Skill failed deterministic admission checks or is disabled",
      provenance: {
        ...provenance,
        scannedAt: new Date().toISOString(),
        scannerVersion: this.scannerVersion,
      },
      findings: [...scan.findings],
    };
  }
}
