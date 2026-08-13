export type SkillRisk = "low" | "medium" | "high";
export type SkillStatus = "candidate" | "approved" | "disabled";

export interface SkillCapability {
  id: string;
  description: string;
  risk: SkillRisk;
  requiresApproval: boolean;
}

export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: SkillCapability[];
  status: SkillStatus;
  source?: string;
}

export interface SkillAdmissionPolicy {
  allow(skill: SkillDefinition): boolean;
}

/**
 * Registry only describes/admit capabilities. It never executes a skill.
 * Execution remains behind Jhadina's Policy Core and Action Executor.
 */
export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  constructor(private readonly policy?: SkillAdmissionPolicy) {}

  register(skill: SkillDefinition): void {
    if (!skill.id || !skill.name || !skill.version) {
      throw new Error("Skill requires id, name, and version");
    }

    if (skill.status === "approved" && this.policy && !this.policy.allow(skill)) {
      throw new Error(`Skill admission denied: ${skill.id}`);
    }

    this.skills.set(skill.id, skill);
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  list(status?: SkillStatus): SkillDefinition[] {
    return [...this.skills.values()].filter(
      (skill) => status === undefined || skill.status === status,
    );
  }

  disable(id: string): void {
    const skill = this.skills.get(id);
    if (!skill) return;
    this.skills.set(id, { ...skill, status: "disabled" });
  }
}
