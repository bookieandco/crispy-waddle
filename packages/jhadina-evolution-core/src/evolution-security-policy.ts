import { JHADINA_BASE_SECURITY_POLICY, type SecurityPolicy } from "@jhadina/security-core"

/**
 * Step 9 (Jhadina OS Integration Phase 1 — close the Evolution/Builder
 * loop). Mirrors money-core's own MONEY_CORE_SECURITY_POLICY pattern
 * (governed-account-read.ts) — a *local* extension of the shared base
 * policy, not a mutation of it — since Evolution, like Money, has its
 * own dedicated backing package rather than living at an app
 * composition layer the way Commerce does.
 *
 * Both capability strings already exist, classified, in
 * security-core's capability-classification.ts (Step 7, merged):
 *
 *   evolution.propose — code_evolution only, reversible. Risk-boundary-policy.ts's
 *     evaluateRiskBoundaries() already computes 'approval_required' for
 *     it whenever values.selfModification.allowEvolutionProposals is
 *     true (the shipped default), 'deny' otherwise. It is NOT a bare
 *     'allow' even when proposals are enabled — proposing a change
 *     already requires an explicit human approval receipt under the
 *     already-merged Step 7 risk-boundary math. This file does not
 *     change that; it only makes the capability reachable through the
 *     base SecurityCoreActionPolicy layer, which currently denies it
 *     outright (see the Step 9 audit finding: neither capability was
 *     ever added to JHADINA_BASE_SECURITY_POLICY.allowedCapabilities,
 *     so mostRestrictiveDecision(deny, approval_required) stayed 'deny'
 *     for both, unconditionally, until now).
 *
 *   evolution.merge — code_evolution + destructive, irreversible.
 *     evaluateRiskBoundaries() already computes a hard 'approval_required'
 *     floor for this combination, independent of allowEvolutionProposals
 *     entirely — see risk-boundary-policy.ts's own comment on this.
 *
 * policy.self_modify is deliberately NOT added here and never will be:
 * risk-boundary-policy.ts denies it outright, unconditionally, before
 * any category check runs — no approval receipt of any kind can unlock
 * it. Adding it to allowedCapabilities would not weaken that hard deny
 * (evaluateRiskBoundaries still returns 'deny' first), but it is out of
 * scope for Step 9 by design, matching the capability-classification.ts
 * comment distinguishing it from evolution.propose/merge.
 *
 * Both capabilities are added to BOTH allowedCapabilities and
 * approvalCapabilities here — redundant with the risk-boundary layer's
 * own approval_required computation, but consistent with every other
 * domain policy in this repo (Commerce, Growth) explicitly listing its
 * own approval-gated capabilities rather than relying on a single
 * layer alone. JhadinaValuesActionPolicy combines this base decision
 * with the risk-boundary decision via "most restrictive wins" (see
 * values-action-policy.ts) — neither layer can loosen the other.
 */

export const EVOLUTION_PROPOSE_CAPABILITY = "evolution.propose"
export const EVOLUTION_MERGE_CAPABILITY = "evolution.merge"

const EVOLUTION_ALLOWED_CAPABILITIES = [
  ...JHADINA_BASE_SECURITY_POLICY.allowedCapabilities,
  EVOLUTION_PROPOSE_CAPABILITY,
  EVOLUTION_MERGE_CAPABILITY,
]

const EVOLUTION_APPROVAL_CAPABILITIES = [
  ...JHADINA_BASE_SECURITY_POLICY.approvalCapabilities,
  EVOLUTION_PROPOSE_CAPABILITY,
  EVOLUTION_MERGE_CAPABILITY,
]

export const EVOLUTION_SECURITY_POLICY: SecurityPolicy = {
  ...JHADINA_BASE_SECURITY_POLICY,
  allowedCapabilities: EVOLUTION_ALLOWED_CAPABILITIES,
  approvalCapabilities: EVOLUTION_APPROVAL_CAPABILITIES,
}
