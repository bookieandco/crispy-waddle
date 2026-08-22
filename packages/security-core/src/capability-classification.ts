/**
 * Phase 1 Step 7 — capability classification.
 *
 * Every capability string this repository's `ActionRequest.type` ever
 * carries is classified here, once, into risk categories. This is pure
 * metadata about the *capability itself* (never about a specific
 * request) — it does not decide anything on its own. `risk-boundary-policy.ts`
 * is what turns a classification plus a specific request into a
 * decision.
 *
 * A capability with no entry here is deliberately unclassified, not
 * "probably safe" — see risk-boundary-policy.ts's fail-closed default
 * for unclassified capabilities.
 */

export type CapabilityRiskCategory =
  | 'read_only'
  | 'reversible'
  | 'external_communication'
  | 'financial'
  | 'publishing'
  | 'destructive'
  | 'code_evolution';

export interface CapabilityClassification {
  capability: string;
  categories: readonly CapabilityRiskCategory[];
  reversible: boolean;
  description: string;
}

const CLASSIFICATIONS: readonly CapabilityClassification[] = [
  // Memory / reasoning — the Ask Jhadina vertical (Steps 3-6).
  { capability: 'memory.read', categories: ['read_only'], reversible: true, description: 'Read approved memories.' },
  { capability: 'memory.propose', categories: ['read_only'], reversible: true, description: 'Propose a PENDING memory candidate — no durable effect without explicit human approval.' },
  { capability: 'memory.commit', categories: ['reversible'], reversible: true, description: 'Turn an approved candidate into durable memory.' },
  { capability: 'research.run', categories: ['read_only'], reversible: true, description: 'Run read-only research.' },
  { capability: 'identity.read', categories: ['read_only'], reversible: true, description: 'Read identity/session claims.' },
  { capability: 'audit.export', categories: ['read_only'], reversible: true, description: 'Export the audit trail.' },

  // Creative / project workspace — reversible, in-workspace edits.
  { capability: 'project.create', categories: ['reversible'], reversible: true, description: 'Create a project.' },
  { capability: 'project.edit', categories: ['reversible'], reversible: true, description: 'Edit a project.' },
  { capability: 'project.export', categories: ['reversible'], reversible: true, description: 'Export a project.' },
  { capability: 'asset.import', categories: ['reversible'], reversible: true, description: 'Import an asset.' },
  { capability: 'timeline.edit', categories: ['reversible'], reversible: true, description: 'Edit a timeline.' },
  { capability: 'timeline.snapshot', categories: ['reversible'], reversible: true, description: 'Snapshot a timeline.' },
  { capability: 'take.generate', categories: ['reversible'], reversible: true, description: 'Generate a take.' },
  { capability: 'take.regenerate', categories: ['reversible'], reversible: true, description: 'Regenerate a take.' },
  { capability: 'take.record', categories: ['reversible'], reversible: true, description: 'Record a take.' },
  { capability: 'take.select', categories: ['reversible'], reversible: true, description: 'Select a take.' },
  { capability: 'audio.edit', categories: ['reversible'], reversible: true, description: 'Edit audio.' },
  { capability: 'image.edit', categories: ['reversible'], reversible: true, description: 'Edit an image.' },
  { capability: 'storyboard.edit', categories: ['reversible'], reversible: true, description: 'Edit a storyboard.' },
  { capability: 'growth.draft.approve', categories: ['reversible'], reversible: true, description: 'Approve a growth draft — an internal state change, not publishing itself.' },

  // Publishing / external communication.
  { capability: 'public.publish', categories: ['publishing', 'external_communication'], reversible: false, description: 'Publish content publicly.' },
  { capability: 'paid-ad.publish', categories: ['publishing', 'external_communication', 'financial'], reversible: false, description: 'Publish a paid advertisement.' },
  { capability: 'affiliate.publish', categories: ['publishing', 'external_communication'], reversible: false, description: 'Publish affiliate content.' },
  { capability: 'consequential.outreach', categories: ['external_communication'], reversible: false, description: 'Contact a person or organization on the user’s behalf.' },
  { capability: 'account.connect', categories: ['external_communication'], reversible: true, description: 'Connect a third-party account.' },
  { capability: 'money.privacy.submit-request', categories: ['external_communication'], reversible: false, description: 'Submit a privacy/data request on the user’s behalf.' },

  // Money.
  { capability: 'money.account.read', categories: ['read_only'], reversible: true, description: 'Read financial account data — no money movement.' },
  { capability: 'money.transfer.create', categories: ['financial'], reversible: false, description: 'Move money between accounts.' },
  { capability: 'financial.execute', categories: ['financial'], reversible: false, description: 'Execute a financial transaction.' },
  { capability: 'commerce.checkout', categories: ['reversible'], reversible: true, description: 'Assemble a checkout intent — moves no money by itself.' },
  { capability: 'commerce.payment.charge', categories: ['financial'], reversible: false, description: 'Charge a payment method.' },
  { capability: 'commerce.payment.refund', categories: ['financial'], reversible: true, description: 'Refund a charge — reversible relative to the charge, but still moves money.' },

  // Credentials / secrets / vault — irreversible by nature.
  { capability: 'credential.rotate', categories: ['destructive'], reversible: false, description: 'Rotate a credential — the old credential stops working immediately.' },
  { capability: 'vault.decrypt', categories: ['destructive'], reversible: false, description: 'Decrypt vaulted secret material.' },
  { capability: 'secrets.export', categories: ['destructive'], reversible: false, description: 'Export secret material.' },
  { capability: 'upload.execute', categories: ['destructive'], reversible: false, description: 'Execute an uploaded artifact.' },

  // Self-modification / evolution — see risk-boundary-policy.ts for the
  // hard, non-configurable floor these two categories enforce.
  { capability: 'evolution.propose', categories: ['code_evolution'], reversible: true, description: 'Propose a build/change task for human review (Step 9). Proposing is not merging.' },
  { capability: 'evolution.merge', categories: ['code_evolution', 'destructive'], reversible: false, description: 'Merge an approved change into the running system.' },
  { capability: 'policy.self_modify', categories: ['code_evolution', 'destructive'], reversible: false, description: 'Modify Jhadina’s own governing policy or values configuration.' },
];

const BY_CAPABILITY = new Map(CLASSIFICATIONS.map((entry) => [entry.capability, entry]));

export function classifyCapability(capability: string): CapabilityClassification | undefined {
  return BY_CAPABILITY.get(capability);
}

export const JHADINA_CAPABILITY_CLASSIFICATIONS: readonly CapabilityClassification[] = CLASSIFICATIONS;
