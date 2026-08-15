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

const candidate = rows[0];
const paths = Array.isArray(candidate.affected_paths)
  ? candidate.affected_paths
  : Array.isArray(candidate.affectedPaths) ? candidate.affectedPaths : [];
const verificationPlan = Array.isArray(candidate.verification_plan)
  ? candidate.verification_plan
  : Array.isArray(candidate.verificationPlan) ? candidate.verificationPlan : [];

const protectedPrefixes = [
  '.github/workflows/', 'identity/', 'policy/', 'values/', 'security/',
  'secrets/', 'payments/', 'transfers/', 'military/',
];
const touchesProtected = paths.some((path) => {
  const normalized = String(path).replace(/^\.\//, '');
  return protectedPrefixes.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
});

if (candidate.status !== 'approved') throw new Error(`Evolution candidate ${candidateId} is not approved.`);
if (!candidate.decided_by || !candidate.decided_at) throw new Error(`Evolution candidate ${candidateId} has no complete approval receipt.`);
if (!candidate.proposal_hash) throw new Error(`Evolution candidate ${candidateId} has no proposal hash.`);
if (candidate.execution_id && candidate.execution_id !== executionId) {
  throw new Error(`Evolution candidate ${candidateId} is bound to a different execution.`);
}
if (candidate.risk === 'critical') throw new Error('Critical evolution changes require a separate controlled process.');
if (touchesProtected) throw new Error('Approved evolution touches a protected Jhadina authority boundary.');

const result = {
  candidateId: candidate.candidate_id ?? candidate.id,
  approvalId: `${candidate.candidate_id ?? candidate.id}:${candidate.proposal_hash}`,
  title: candidate.title,
  suggestedChange: candidate.suggested_change,
  risk: candidate.risk,
  allowedPaths: paths,
  verificationPlan,
  proposalHash: candidate.proposal_hash,
  decidedBy: candidate.decided_by,
  decidedAt: candidate.decided_at,
  executionId,
};

console.log(JSON.stringify(result));
