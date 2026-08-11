import { ClaudeCodeEvolutionAdapter } from "@jhadina/evolution-core/claude-code-adapter";
import { ClaudeGitHubActionsRunner } from "@jhadina/evolution-core/claude-github-actions-runner";
import { GovernedRepairService } from "@jhadina/evolution-core/governed-repair-service";
import { GovernedEvolutionRepairRuntime } from "@jhadina/evolution-core/evolution-repair-runtime";
import { SupabaseEvolutionCandidateRepository } from "@jhadina/evolution-core/supabase-evolution-candidate-repository";
import { SupabaseEvolutionRunLedger } from "@jhadina/evolution-core/supabase-evolution-run-ledger";
import { GitHubEvolutionIntegration } from "./github-evolution-integration";
import { registerEvolutionRepairRuntime } from "./evolution-runtime";

let initialized = false;

export function ensureEvolutionRepairRuntime(): void {
  if (initialized) return;

  const supabaseUrl = process.env.JHADINA_SUPABASE_URL;
  const supabaseKey = process.env.JHADINA_SUPABASE_SERVICE_ROLE_KEY;
  const githubToken = process.env.JHADINA_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  const repository = process.env.JHADINA_GITHUB_REPOSITORY ?? "bookieandco/crispy-waddle";

  if (!supabaseUrl || !supabaseKey) throw new Error("Jhadina Supabase evolution persistence is not configured");
  if (!githubToken) throw new Error("Jhadina GitHub evolution token is not configured");

  const github = new GitHubEvolutionIntegration({ token: githubToken, repository });
  const candidates = new SupabaseEvolutionCandidateRepository({ url: supabaseUrl, key: supabaseKey });
  const ledger = new SupabaseEvolutionRunLedger({ url: supabaseUrl, key: supabaseKey });
  const workflowRunner = new ClaudeGitHubActionsRunner(github.dispatch, github.results, ledger);
  const claude = new ClaudeCodeEvolutionAdapter(workflowRunner);
  const repairService = new GovernedRepairService(github.intelligence, claude);
  const runtime = new GovernedEvolutionRepairRuntime(candidates, repairService);

  registerEvolutionRepairRuntime(runtime);
  initialized = true;
}
