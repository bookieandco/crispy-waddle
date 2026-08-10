import type { DailyAuditReport, DailyAuditFinding } from "./daily-audit";
import type { EvolutionCandidate } from "./evolution-registry";

export interface MorningBriefing {
  title: string;
  status: DailyAuditReport["status"];
  summary: string;
  sections: Array<{
    domain: string;
    healthy: number;
    attention: number;
    upgrades: number;
  }>;
  topRecommendations: Array<{
    id: string;
    title: string;
    risk: EvolutionCandidate["risk"];
    reason: string;
  }>;
  criticalFindings: DailyAuditFinding[];
}

export function buildMorningBriefing(
  report: DailyAuditReport,
  candidates: EvolutionCandidate[],
): MorningBriefing {
  const domains = new Map<string, { healthy: number; attention: number; upgrades: number }>();

  for (const finding of report.findings) {
    const current = domains.get(finding.domain) ?? { healthy: 0, attention: 0, upgrades: 0 };
    if (finding.severity === "healthy" || finding.severity === "info") current.healthy++;
    else current.attention++;
    domains.set(finding.domain, current);
  }

  for (const candidate of candidates) {
    const current = domains.get(candidate.domain) ?? { healthy: 0, attention: 0, upgrades: 0 };
    current.upgrades++;
    domains.set(candidate.domain, current);
  }

  const recommendations = candidates
    .filter((candidate) => candidate.status === "RECOMMENDED" || candidate.status === "NEW")
    .sort((a, b) => riskRank(b.risk) - riskRank(a.risk))
    .slice(0, 5)
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      risk: candidate.risk,
      reason: candidate.description,
    }));

  const criticalFindings = report.findings.filter((finding) => finding.severity === "critical");
  const summary = criticalFindings.length
    ? `${criticalFindings.length} critical finding${criticalFindings.length === 1 ? "" : "s"} require immediate attention.`
    : report.status === "attention"
      ? "Jhadina is running, but some items require attention."
      : "Jhadina is healthy and has completed her daily audit.";

  return {
    title: "Jhadina Daily Briefing",
    status: report.status,
    summary,
    sections: [...domains.entries()].map(([domain, counts]) => ({ domain, ...counts })),
    topRecommendations: recommendations,
    criticalFindings,
  };
}

function riskRank(risk: EvolutionCandidate["risk"]) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[risk];
}
