export type AuditDomain =
  | "system"
  | "security"
  | "memory"
  | "actions"
  | "money"
  | "integrations"
  | "dependencies"
  | "evolution";

export type AuditSeverity = "healthy" | "info" | "warning" | "high" | "critical";

export interface DailyAuditFinding {
  id: string;
  domain: AuditDomain;
  severity: AuditSeverity;
  code: string;
  title: string;
  detail: string;
  recommendation?: string;
  requiresApproval: boolean;
  observedAt: string;
}

export interface DailyAuditReport {
  auditId: string;
  startedAt: string;
  completedAt: string;
  status: "healthy" | "attention" | "blocked";
  findings: DailyAuditFinding[];
}

export interface DailyAuditSource {
  id: string;
  audit(domain: AuditDomain): Promise<DailyAuditFinding[]>;
}

const DOMAIN_ORDER: AuditDomain[] = [
  "system",
  "security",
  "memory",
  "actions",
  "money",
  "integrations",
  "dependencies",
  "evolution",
];

const SEVERITY_RANK: Record<AuditSeverity, number> = {
  healthy: 0,
  info: 1,
  warning: 2,
  high: 3,
  critical: 4,
};

export class DailyEvolutionAudit {
  constructor(private readonly sources: DailyAuditSource[]) {}

  async run(now = new Date()): Promise<DailyAuditReport> {
    const startedAt = now.toISOString();
    const findings: DailyAuditFinding[] = [];

    for (const domain of DOMAIN_ORDER) {
      for (const source of this.sources) {
        findings.push(...(await source.audit(domain)));
      }
    }

    const completedAt = new Date().toISOString();
    const hasCritical = findings.some((f) => f.severity === "critical");
    const hasAttention = findings.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK.warning);

    return {
      auditId: crypto.randomUUID(),
      startedAt,
      completedAt,
      status: hasCritical ? "blocked" : hasAttention ? "attention" : "healthy",
      findings,
    };
  }
}
