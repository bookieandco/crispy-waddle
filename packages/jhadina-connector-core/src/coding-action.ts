import { createHash } from 'node:crypto'
import type { AuthoritativeActionProposal } from './governed-action.js'

export interface CodingChangeRequest {
  readonly proposal: AuthoritativeActionProposal
  readonly workspace: 'isolated_worktree'
  readonly branchName: string
  readonly requestedFiles: readonly string[]
}

export interface CodingVerification {
  readonly testsPassed: boolean
  readonly typecheckPassed: boolean
  readonly lintPassed: boolean
  readonly diffHash: string
}

export function createCodingChangeRequest(proposal: AuthoritativeActionProposal, branchName: string, requestedFiles: readonly string[] = []): CodingChangeRequest {
  if (proposal.capability !== 'github.code.modify') throw new Error('Coding changes require github.code.modify capability')
  if (proposal.target !== 'github') throw new Error('Coding changes require github target')
  if (!branchName || branchName === 'main' || branchName === 'master') throw new Error('Coding changes require an isolated non-default branch')
  return { proposal, workspace: 'isolated_worktree', branchName, requestedFiles }
}

export function verifyCodingResult(input: { testsPassed: boolean; typecheckPassed: boolean; lintPassed: boolean; diff: string }): CodingVerification {
  if (!input.testsPassed || !input.typecheckPassed || !input.lintPassed) throw new Error('Coding verification failed')
  return {
    testsPassed: true,
    typecheckPassed: true,
    lintPassed: true,
    diffHash: createHash('sha256').update(input.diff).digest('hex'),
  }
}
