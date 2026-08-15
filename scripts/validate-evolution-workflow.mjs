import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/jhadina-evolution-execute.yml", "utf8");

const required = [
  "evolution_id:",
  "JHADINA_SUPABASE_URL",
  "JHADINA_SUPABASE_SECRET_KEY",
  "candidate_id=eq.$EVOLUTION_ID",
  "if (c.status !== 'approved')",
  "if (!c.decided_by || !c.decided_at)",
  "if (!c.proposal_hash)",
  "if (!c.execution_id)",
  "if (c.risk === 'critical')",
  "affected_paths",
  "proposal_hash",
  "execution_id",
];

for (const token of required) {
  if (!workflow.includes(token)) throw new Error(`workflow invariant missing: ${token}`);
}

const forbiddenInputs = [
  "prompt:",
  "base_branch:",
  "allowed_tools:",
  "disallowed_tools:",
  "max_turns:",
];
const dispatchSection = workflow.split("workflow_dispatch:", 2)[1]?.split("permissions:", 1)[0] ?? "";
for (const token of forbiddenInputs) {
  if (dispatchSection.includes(`      ${token}`)) {
    throw new Error(`caller-controlled workflow input remains: ${token}`);
  }
}

if (!workflow.includes("--data-urlencode \"candidate_id=eq.$EVOLUTION_ID\"")) {
  throw new Error("workflow does not resolve the candidate by evolution_id");
}

console.log("approved-id-only evolution workflow invariants: PASS");
