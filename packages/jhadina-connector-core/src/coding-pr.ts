import type { AuthoritativeActionProposal } from './governed-action.js'

export interface VerifiedCodingChange {
  readonly proposal: AuthoritativeActionProposal
  readonly repository: string
  readonly branch: string
  readonly baseBranch: string
  readonly diffHash: string
  readonly testsPassed: boolean
  readonly typecheckPassed: boolean
  readonly lintPassed: boolean
}

export interface DraftPullRequestRequest {
  readonly capability: 'github.pr.create'
  readonly proposalId: string
  readonly repository: string
  readonly branch: string
  readonly baseBranch: string
  readonly title: string
  readonly body: string
  readonly draft: true
  readonly verification: {
    readonly diffHash: string
    readonly testsPassed: true
    readonly typecheckPassed: true
    readonly lintPassed: true
  }
}

export function createDraftPullRequestRequest(change: VerifiedCodingChange, title: string, body: string): DraftPullRequestRequest {
  if (!change.testsPassed || !change.typecheckPassed || !change.lintPassed) {
    throw new Error('Cannot create PR before coding verification passes')
  }
  if (change.branch === change.baseBranch) throw new Error('Coding PR cannot target the execution branch')
  if (!/^[^/\s]+\/[^/\s]+$/.test(change.repository)) throw new Error('Coding PR repository must be owner/name')
  return {
    capability: 'github.pr.create', proposalId: change.proposal.id, repository: change.repository,
    branch: change.branch, baseBranch: change.baseBranch, title, body, draft: true,
    verification: { diffHash: change.diffHash, testsPassed: true, typecheckPassed: true, lintPassed: true },
  }
}
