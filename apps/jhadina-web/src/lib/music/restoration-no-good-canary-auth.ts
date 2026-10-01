import { authorizedGitHubRepositoryWorkflowRequest } from "../internal-scheduler-auth";
import { NO_GOOD_BENCHMARK } from "./restoration-no-good-canary";

export function authorizedNoGoodCanaryRequest(
  request: Request,
  options: { fetchImpl?: typeof fetch; nowSeconds?: number } = {},
): Promise<boolean> {
  return authorizedGitHubRepositoryWorkflowRequest(request, {
    audience: NO_GOOD_BENCHMARK.workflowAudience,
    workflowRef: NO_GOOD_BENCHMARK.workflowRef,
    repository: NO_GOOD_BENCHMARK.repository,
    repositoryId: NO_GOOD_BENCHMARK.repositoryId,
    repositoryOwner: NO_GOOD_BENCHMARK.repositoryOwner,
    repositoryOwnerId: NO_GOOD_BENCHMARK.repositoryOwnerId,
    ref: NO_GOOD_BENCHMARK.ref,
    allowedEvents: ["push", "workflow_dispatch"],
    ...options,
  });
}
