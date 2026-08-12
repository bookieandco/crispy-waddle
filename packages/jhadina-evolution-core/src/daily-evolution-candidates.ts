import { sha256, type AuditEvidence, type AuditRunLedgerEvent } from "./daily-audit-ledger";

export type CandidateCategory = "CI" | "DEPENDENCY" | "SECURITY" | "ISSUE" | "PR" | "REPOSITORY";
export type CandidateRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface EvolutionCandidate {
  candidateId: string;
  auditRunId: string;
  category: CandidateCategory;
  title: string;
  problem: string;
  evidenceRefs: string[];
  affectedPaths: string[];
  risk: CandidateRisk;
  impact: number;
  confidence: number;
  recurrence: number;
  changeSize: number;
  priority: number;
  suggestedChange: string;
  verificationPlan: string[];
  discoveredAt: string;
  proposalHash: string;
}

const RISK_WEIGHT: Record<CandidateRisk, number> = {
  LOW: 0,
  MEDIUM: 3,
  HIGH: 7,
  CRITICAL: 20,
};

function candidateId(auditRunId: string, category: CandidateCategory, title: string) {
  return `candidate-${sha256(`${auditRunId}:${category}:${title}`).slice(0, 16)}`;
}

function makeCandidate(input: Omit<EvolutionCandidate, "candidateId" | "priority" | "proposalHash">): EvolutionCandidate {
  const priority = input.impact + input.confidence + input.recurrence - RISK_WEIGHT[input.risk] - input.changeSize;
  const base = { ...input, priority };
  return {
    ...base,
    candidateId: candidateId(input.auditRunId, input.category, input.title),
    proposalHash: sha256(JSON.stringify(base)),
  };
}

function evidenceFor(evidence: AuditEvidence[], source: string): AuditEvidence | undefined {
  return evidence.find((item) => item.source === source);
}

export function buildDailyEvolutionCandidates(
  audit: AuditRunLedgerEvent,
  now = new Date().toISOString(),
): EvolutionCandidate[] {
  const candidates: EvolutionCandidate[] = [];
  const pnpmAudit = evidenceFor(audit.evidence, "pnpm-audit");
  const pnpmOutdated = evidenceFor(audit.evidence, "pnpm-outdated");
  const prs = evidenceFor(audit.evidence, "gh-pr-list");
  const issues = evidenceFor(audit.evidence, "gh-issue-list");
  const ci = evidenceFor(audit.evidence, "git-status");

  if (pnpmAudit && pnpmAudit.exitCode !== 0) {
    candidates.push(makeCandidate({
      auditRunId: audit.runId,
      category: "SECURITY",
      title: "Resolve dependency security advisories",
      problem: "pnpm audit reported security findings during the daily audit.",
      evidenceRefs: [pnpmAudit.outputSha256],
      affectedPaths: ["package.json", "pnpm-lock.yaml"],
      risk: "HIGH",
      impact: 10,
      confidence: 10,
      recurrence: 0,
      changeSize: 3,
      suggestedChange: "Review the reported advisories, upgrade affected dependencies, and regenerate the lockfile without changing protected policy or security code.",
      verificationPlan: ["pnpm audit --json", "pnpm type-check", "pnpm test"],
      discoveredAt: now,
    }));
  }

  if (pnpmOutdated && pnpmOutdated.exitCode === 0 && pnpmOutdated.output.trim() && pnpmOutdated.output.trim() !== "{}") {
    candidates.push(makeCandidate({
      auditRunId: audit.runId,
      category: "DEPENDENCY",
      title: "Review outdated dependencies",
      problem: "The daily dependency scan found packages with newer available versions.",
      evidenceRefs: [pnpmOutdated.outputSha256],
      affectedPaths: ["package.json", "pnpm-lock.yaml"],
      risk: "MEDIUM",
      impact: 6,
      confidence: 8,
      recurrence: 0,
      changeSize: 3,
      suggestedChange: "Review compatible dependency upgrades and propose only upgrades that preserve the existing contracts.",
      verificationPlan: ["pnpm install --frozen-lockfile", "pnpm type-check", "pnpm test"],
      discoveredAt: now,
    }));
  }

  if (prs && prs.exitCode === 0 && /failure|error|failing/i.test(prs.output)) {
    candidates.push(makeCandidate({
      auditRunId: audit.runId,
      category: "CI",
      title: "Investigate failing open pull-request checks",
      problem: "Open pull requests contain failed or erroring status checks.",
      evidenceRefs: [prs.outputSha256],
      affectedPaths: [".github/workflows"],
      risk: "MEDIUM",
      impact: 8,
      confidence: 9,
      recurrence: 0,
      changeSize: 4,
      suggestedChange: "Inspect failing checks, reproduce the failure, and prepare the smallest evidence-backed repair.",
      verificationPlan: ["re-run affected checks", "pnpm type-check", "pnpm test"],
      discoveredAt: now,
    }));
  }

  if (issues && issues.exitCode === 0 && issues.output.trim()) {
    candidates.push(makeCandidate({
      auditRunId: audit.runId,
      category: "ISSUE",
      title: "Triage open technical debt",
      problem: "Open repository issues are available for deterministic daily triage.",
      evidenceRefs: [issues.outputSha256],
      affectedPaths: [],
      risk: "LOW",
      impact: 4,
      confidence: 6,
      recurrence: 0,
      changeSize: 2,
      suggestedChange: "Rank open issues by impact and evidence, then propose the smallest repair candidates for approval.",
      verificationPlan: ["reproduce selected issue", "add regression test", "pnpm test"],
      discoveredAt: now,
    }));
  }

  if (ci && ci.exitCode === 0 && /ahead|behind|diverged|modified/i.test(ci.output)) {
    candidates.push(makeCandidate({
      auditRunId: audit.runId,
      category: "REPOSITORY",
      title: "Review repository drift",
      problem: "The audited checkout reports repository state that may require reconciliation.",
      evidenceRefs: [ci.outputSha256],
      affectedPaths: [],
      risk: "LOW",
      impact: 3,
      confidence: 7,
      recurrence: 0,
      changeSize: 1,
      suggestedChange: "Inspect the repository state and determine whether drift is intentional before proposing a repair.",
      verificationPlan: ["git status --short --branch", "git diff --check"],
      discoveredAt: now,
    }));
  }

  return candidates.sort((a, b) => b.priority - a.priority || a.candidateId.localeCompare(b.candidateId));
}

export function attachCandidateIds(audit: AuditRunLedgerEvent, candidates: EvolutionCandidate[]): AuditRunLedgerEvent {
  return { ...audit, candidateIds: candidates.map((candidate) => candidate.candidateId) };
}
