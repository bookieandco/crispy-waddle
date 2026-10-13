/**
 * PURSE-MCP.16 — non-executing, evidence-based readiness assessment.
 * An internally filled checklist is not independent production certification.
 * Every proof must be owner/assessor sourced; read-only operational approval
 * remains a separate manual action and is NEVER returned by this function.
 */
export type PhantomReadOnlyCommissioningProof = Readonly<{
  kind: 'OWNER_AUTH_SESSION' | 'PINNED_AGENT_WALLET' | 'WORKER_OS_ISOLATION' |
    'PRIVATE_TLS_BOUNDARY' | 'SESSION_REVOCATION_TEST' | 'ACTUAL_MCP_READBACK' |
    'INDEPENDENT_SOLANA_RPC' | 'EXTERNAL_BACKUP_RECEIPT' |
    'ISOLATED_RESTORE_DRILL' | 'POST_REBOOT_READBACK' |
    'EXACT_HEAD_CI' | 'INDEPENDENT_SECURITY_REVIEW'
  evidenceId: string
  observedAt: string
  source: string
  observedHead: string
}>
export const PHANTOM_READ_ONLY_PROOF_TYPES = Object.freeze([
  'OWNER_AUTH_SESSION',
  'PINNED_AGENT_WALLET',
  'WORKER_OS_ISOLATION',
  'PRIVATE_TLS_BOUNDARY',
  'SESSION_REVOCATION_TEST',
  'ACTUAL_MCP_READBACK',
  'INDEPENDENT_SOLANA_RPC',
  'EXTERNAL_BACKUP_RECEIPT',
  'ISOLATED_RESTORE_DRILL',
  'POST_REBOOT_READBACK',
  'EXACT_HEAD_CI',
  'INDEPENDENT_SECURITY_REVIEW',
] as const)

const SHA = /^[a-f0-9]{40}$/
const EVIDENCE = /^[a-zA-Z0-9:._\/-]{12,256}$/
export function evaluatePhantomReadOnlyCommissioning(input:Readonly<{
  expectedGitHead: string
  assessedAt: string
  proofs: readonly PhantomReadOnlyCommissioningProof[]
}>) {
  if (!SHA.test(input.expectedGitHead) ||
      !Number.isFinite(Date.parse(input.assessedAt)) ||
      !Array.isArray(input.proofs)) throw new Error('PHANTOM_READONLY_AUDIT_INPUT_INVALID')
  const valid = new Map<string, PhantomReadOnlyCommissioningProof>()
  const invalid: string[] = []
  for (const p of input.proofs) {
    const time=Date.parse(p.observedAt),now=Date.parse(input.assessedAt)
    if (!PHANTOM_READ_ONLY_PROOF_TYPES.includes(p.kind) ||
        !EVIDENCE.test(p.evidenceId) || !p.source.trim() ||
        p.observedHead!==input.expectedGitHead ||
        !Number.isFinite(time) || time>now || now-time>7*24*60*60*1000 ||
        valid.has(p.kind)) {
      invalid.push(String(p.kind))
    } else {
      valid.set(p.kind,p)
    }
  }
  const missing = PHANTOM_READ_ONLY_PROOF_TYPES.filter(kind=>!valid.has(kind))
  const blockerCodes = Object.freeze([
    ...missing.map(x=>'PHANTOM_READONLY_'+x+'_MISSING'),
    ...invalid.map(x=>'PHANTOM_READONLY_'+x+'_INVALID'),
  ])
  return Object.freeze({
    status: blockerCodes.length ? 'BLOCKED' as const : 'READY_FOR_INDEPENDENT_OWNER_REVIEW' as const,
    blockerCodes,
    admittedEvidenceIds: Object.freeze([...valid.values()].map(v=>v.evidenceId)),
    authority: 'AUDIT_ASSESSMENT_ONLY' as const,
    canSign: false as const,
    canExecute: false as const,
    canAuthorizeLive: false as const,
    liveCommissioned: false as const,
    productionCertified: false as const,
    financialAuthority: 'NONE' as const,
  })
}
