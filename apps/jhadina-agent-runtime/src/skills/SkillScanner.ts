import type { SkillCapability, SkillDefinition } from "./SkillRegistry";

export interface SkillScanFinding {
  code: string;
  severity: "warning" | "error";
  message: string;
  capabilityId?: string;
}

export interface SkillScanResult {
  approved: boolean;
  findings: SkillScanFinding[];
}

/**
 * Deterministic admission checks. This scanner does not execute skill code.
 * Deeper static analysis can be plugged in later without changing the registry.
 */
export class SkillScanner {
  scan(skill: SkillDefinition): SkillScanResult {
    const findings: SkillScanFinding[] = [];

    if (!/^[a-z0-9][a-z0-9._-]*$/.test(skill.id)) {
      findings.push({ code: "INVALID_ID", severity: "error", message: "Skill id is not a safe identifier" });
    }

    if (!/^\d+\.\d+\.\d+$/.test(skill.version)) {
      findings.push({ code: "INVALID_VERSION", severity: "error", message: "Skill version must use semantic versioning" });
    }

    if (skill.capabilities.length === 0) {
      findings.push({ code: "NO_CAPABILITIES", severity: "warning", message: "Skill declares no capabilities" });
    }

    for (const capability of skill.capabilities) {
      this.scanCapability(capability, findings);
    }

    if (skill.status === "approved" && findings.some((finding) => finding.severity === "error")) {
      findings.push({ code: "APPROVAL_BLOCKED", severity: "error", message: "Skill cannot enter approved state with scanner errors" });
    }

    return {
      approved: !findings.some((finding) => finding.severity === "error"),
      findings,
    };
  }

  private scanCapability(capability: SkillCapability, findings: SkillScanFinding[]): void {
    if (!capability.id || !capability.description) {
      findings.push({
        code: "INVALID_CAPABILITY",
        severity: "error",
        message: "Capability requires id and description",
        capabilityId: capability.id,
      });
    }

    if (capability.risk === "high" && !capability.requiresApproval) {
      findings.push({
        code: "HIGH_RISK_REQUIRES_APPROVAL",
        severity: "error",
        message: "High-risk capabilities must require approval",
        capabilityId: capability.id,
      });
    }
  }
}
