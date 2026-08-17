import { ApprovalExecutionGate } from '../packages/jhadina-evolution-core/src/approval-execution-gate.ts';

const url = process.env.JHADINA_SUPABASE_URL;
const key = process.env.JHADINA_SUPABASE_SECRET_KEY || process.env.JHADINA_SUPABASE_SERVICE_ROLE_KEY;
const candidateId = process.env.EVOLUTION_ID;
const executionId = process.env.EVOLUTION_EXECUTION_ID;

if (!url || !key || !candidateId || !executionId) {
  throw new Error('Approved evolution resolution requires Supabase credentials, EVOLUTION_ID, and EVOLUTION_EXECUTION_ID.');
}

const endpoint = `${url.replace(/\/$/, '')}/rest/v1/jhadina_evolution_candidates?id=eq.${encodeURIComponent(candidateId)}&select=*`;
const response = await fetch(endpoint, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
});

if (!response.ok) {
  throw new Error(`Failed to load evolution candidate: HTTP ${response.status}`);
}

const rows = await response.json();
if (!Array.isArray(rows) || rows.length !== 1) {
  throw new Error(`Expected exactly one evolution candidate for ${candidateId}; found ${rows?.length ?? 0}.`);
}

const row = rows[0];
const candidate = {
  candidateId: row.candidate_id ?? row.id,
  title: row.title,
  suggestedChange: row.suggested_change ?? row.suggestedChange,
  risk: row.risk,
  affectedPaths: Array.isArray(row.affected_paths)
    ? row.affected_paths
    : Array.isArray(row.affectedPaths) ? row.affectedPaths : [],
  verificationPlan: Array.isArray(row.verification_plan)
    ? row.verification_plan
    : Array.isArray(row.verificationPlan) ? row.verificationPlan : [],
  status: row.status,
  proposalHash: row.proposal_hash ?? row.proposalHash,
  decidedBy: row.decided_by ?? row.decidedBy ?? null,
  decidedAt: row.decided_at ?? row.decidedAt ?? null,
  executionId: row.execution_id ?? row.executionId ?? null,
};

const approved = new ApprovalExecutionGate().approve(candidate, executionId);

const result = {
  candidateId: approved.candidateId,
  approvalId: approved.approvalId,
  title: candidate.title,
  suggestedChange: candidate.suggestedChange,
  risk: candidate.risk,
  allowedPaths: approved.plan.allowedPaths,
  verificationPlan: approved.plan.testCommands,
  proposalHash: approved.proposalHash,
  decidedBy: candidate.decidedBy,
  decidedAt: candidate.decidedAt,
  executionId: approved.executionId,
};

console.log(JSON.stringify(result));
