import { createHash } from 'node:crypto'
import type {
  ConnectorAdapter,
  ConnectorOperation,
  ConnectorRequest,
} from './index.js'
import type { DraftPullRequestRequest } from './coding-pr.js'
import type { ConnectorExecutionRecord } from './index.js'
import type { ConnectorReconciliationResult } from './reconciliation.js'
import { reconciliationEvidencePayload } from './reconciliation.js'
import { toConnectorExecutionError } from './execution-errors.js'

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
  /** Provider-side lookup used after an interrupted create request. */
  findPullRequest?(input: {
    repository: string
    title: string
    headBranch: string
    baseBranch: string
  }): Promise<GitHubPullRequest | undefined>
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
        throw new Error(`Unsupported GitHub operation: ${operation.name}`)
      }
      if (!isDraftPullRequestRequest(input)) {
        throw new Error('GitHub pr.create requires a verified draft pull request request')
      }

      try {
        return (await transport.createPullRequest({
          repository: input.repository,
          title: input.title,
          body: input.body,
          headBranch: input.branch,
          baseBranch: input.baseBranch,
          draft: true,
        })) as TOutput
      } catch (error) {
        // Never turn a known provider rejection into a recovery retry. Only
        // transport failures whose outcome cannot be established are marked
        // recovery-required; the Gateway then persists recovery_required.
        const ambiguous = toConnectorExecutionError(error)
        if (ambiguous) throw ambiguous
        throw error
      }
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
    async reconcile<TInput>(
      operation: ConnectorOperation,
      request: ConnectorRequest<TInput>,
      execution: ConnectorExecutionRecord,
    ): Promise<ConnectorReconciliationResult> {
      if (operation.name !== 'pr.create') {
        throw new Error(`Unsupported GitHub operation: ${operation.name}`)
      }
      if (!isDraftPullRequestRequest(request.input)) {
        throw new Error('GitHub pr.create reconciliation requires the original verified draft request')
      }

      const checkedAt = new Date().toISOString()
      const baseEvidence = {
        executionId: execution.executionId,
        proposalHash: execution.proposalHash,
        idempotencyKey: execution.idempotencyKey,
        connectorId: execution.connectorId,
        operation: execution.operation,
        observedAt: checkedAt,
        checkedAt,
        adapterVersion: 1,
        source: 'github-pr',
      }

      if (!transport.findPullRequest) {
        return makeReconciliationResult({
          ...baseEvidence,
          status: 'indeterminate',
        })
      }

      let pullRequest: GitHubPullRequest | undefined
      try {
        pullRequest = await transport.findPullRequest({
          repository: request.input.repository,
          title: request.input.title,
          headBranch: request.input.branch,
          baseBranch: request.input.baseBranch,
        })
      } catch {
        return makeReconciliationResult({
          ...baseEvidence,
          status: 'indeterminate',
        })
      }

      if (!pullRequest) {
        return makeReconciliationResult({
          ...baseEvidence,
          status: 'confirmed_not_executed',
          providerState: 'not_found',
        })
      }

      const exactMatch =
        pullRequest.title === request.input.title &&
        pullRequest.headBranch === request.input.branch &&
        pullRequest.baseBranch === request.input.baseBranch &&
        pullRequest.draft === true &&
        pullRequest.htmlUrl.length > 0

      if (!exactMatch) {
        return makeReconciliationResult({
          ...baseEvidence,
          status: 'indeterminate',
          providerState: 'ambiguous_match',
        })
      }

      return makeReconciliationResult({
        ...baseEvidence,
        status: 'confirmed_executed',
        providerReference: pullRequest.htmlUrl,
        providerState: pullRequest.draft ? 'open_draft' : 'open',
      })
    },
  }
}

function makeReconciliationResult(
  evidence: Omit<import('./reconciliation.js').ConnectorReconciliationEvidence, 'evidenceHash'>,
): ConnectorReconciliationResult {
  const evidenceHash = createHash('sha256').update(reconciliationEvidencePayload(evidence)).digest('hex')
  return {
    status: evidence.status,
    evidence: { ...evidence, evidenceHash },
  }
}

function isDraftPullRequestRequest(value: unknown): value is DraftPullRequestRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DraftPullRequestRequest>
  return (
    candidate.capability === 'github.pr.create' &&
    typeof candidate.proposalId === 'string' &&
    candidate.proposalId.length > 0 &&
    typeof candidate.repository === 'string' &&
    /^[^/\s]+\/[^/\s]+$/.test(candidate.repository) &&
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
