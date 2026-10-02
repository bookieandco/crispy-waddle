import { authorizedGitHubRepositoryWorkflowRequest } from "../internal-scheduler-auth";
import { NO_GOOD_BENCHMARK } from "./restoration-no-good-canary";

export async function authorizedNoGoodCanaryRequest(
  request: Request,
  options: { fetchImpl?: typeof fetch; nowSeconds?: number } = {},
): Promise<boolean> {
  const shared = {
    audience: NO_GOOD_BENCHMARK.workflowAudience,
    repository: NO_GOOD_BENCHMARK.repository,
    repositoryId: NO_GOOD_BENCHMARK.repositoryId,
    repositoryOwner: NO_GOOD_BENCHMARK.repositoryOwner,
    repositoryOwnerId: NO_GOOD_BENCHMARK.repositoryOwnerId,
    allowedEvents: ["push", "workflow_dispatch"] as const,
    ...options,
  };

  if (await authorizedGitHubRepositoryWorkflowRequest(request, {
    ...shared,
    workflowRef: NO_GOOD_BENCHMARK.workflowRef,
    ref: NO_GOOD_BENCHMARK.ref,
  })) {
    return true;
  }

  return authorizedGitHubRepositoryWorkflowRequest(request, {
    ...shared,
    workflowRef: NO_GOOD_BENCHMARK.draftWorkflowRef,
    ref: NO_GOOD_BENCHMARK.draftRef,
  });
}
