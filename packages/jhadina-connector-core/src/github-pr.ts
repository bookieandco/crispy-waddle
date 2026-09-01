import type {
  ConnectorAdapter,
  ConnectorOperation,
  ConnectorRequest,
} from './index.js'
import type { DraftPullRequestRequest } from './coding-pr.js'

export interface GitHubPullRequest {
  readonly number: number
  readonly title: string
  readonly body: string
  readonly draft: boolean
  readonly headBranch: string
  readonly baseBranch: string
  readonly htmlUrl: string
}

export interface GitHubPullRequestTransport {
  createPullRequest(input: {
    repository: string
    title: string
    body: string
    headBranch: string
    baseBranch: string
    draft: true
  }): Promise<GitHubPullRequest>
}

const operations: readonly ConnectorOperation[] = [
  {
    name: 'pr.create',
    capability: 'github.pr.create',
    kind: 'create',
    reversibility: 'partially_reversible',
    description: 'Create a verified GitHub draft pull request',
  },
]

export function createGitHubPullRequestAdapter(
  transport: GitHubPullRequestTransport,
): ConnectorAdapter {
  return {
    manifest: {
      id: 'github-pr',
      provider: 'github',
      version: 1,
      operations,
    },
    state: 'connected',
    async execute<TInput, TOutput>(
      operation: ConnectorOperation,
      input: TInput,
      _request: ConnectorRequest<TInput>,
    ): Promise<TOutput> {
      if (operation.name !== 'pr.create') {
        throw new Error(`Unsupported GitHub PR operation: ${operation.name}`)
      }
      if (!isDraftPullRequestRequest(input)) {
        throw new Error('GitHub pr.create requires a verified draft pull request request')
      }

      return (await transport.createPullRequest({
        repository: repositoryFromProposalId(_request.connectorId, input.proposalId),
        title: input.title,
        body: input.body,
        headBranch: input.branch,
        baseBranch: input.baseBranch,
        draft: true,
      })) as TOutput
    },
    async verify<TOutput>(
      operation: ConnectorOperation,
      output: TOutput,
      request: ConnectorRequest,
    ): Promise<boolean> {
      if (operation.name !== 'pr.create') return false
      if (!isGitHubPullRequest(output)) return false
      if (output.draft !== true) return false
      return output.headBranch !== output.baseBranch && output.htmlUrl.length > 0 && request.capability === 'github.pr.create'
    },
  }
}

function isDraftPullRequestRequest(value: unknown): value is DraftPullRequestRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DraftPullRequestRequest>
  return (
    candidate.capability === 'github.pr.create' &&
    typeof candidate.proposalId === 'string' &&
    candidate.proposalId.length > 0 &&
    typeof candidate.branch === 'string' &&
    candidate.branch.length > 0 &&
    typeof candidate.baseBranch === 'string' &&
    candidate.baseBranch.length > 0 &&
    candidate.branch !== candidate.baseBranch &&
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.body === 'string' &&
    candidate.draft === true &&
    isVerification(candidate.verification)
  )
}

function isVerification(value: unknown): value is DraftPullRequestRequest['verification'] {
  if (!value || typeof value !== 'object') return false
  const verification = value as Partial<DraftPullRequestRequest['verification']>
  return (
    typeof verification.diffHash === 'string' &&
    verification.diffHash.length > 0 &&
    verification.testsPassed === true &&
    verification.typecheckPassed === true &&
    verification.lintPassed === true
  )
}

function isGitHubPullRequest(value: unknown): value is GitHubPullRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GitHubPullRequest>
  return (
    typeof candidate.number === 'number' &&
    Number.isInteger(candidate.number) &&
    candidate.number > 0 &&
    typeof candidate.title === 'string' &&
    typeof candidate.body === 'string' &&
    candidate.draft === true &&
    typeof candidate.headBranch === 'string' &&
    typeof candidate.baseBranch === 'string' &&
    typeof candidate.htmlUrl === 'string'
  )
}

function repositoryFromProposalId(connectorId: string, proposalId: string): string {
  if (connectorId.includes('/')) return connectorId
  const marker = proposalId.indexOf('@')
  if (marker > 0) {
    const repository = proposalId.slice(0, marker)
    if (/^[^/\s]+\/[^/\s]+$/.test(repository)) return repository
  }
  throw new Error('GitHub PR request must identify repository as owner/name in connector context')
}
