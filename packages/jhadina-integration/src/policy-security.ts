import type { CapabilityRequest, DomainId } from './contracts';
import type { CorePolicy } from './core-adapters';

export type PolicyEffect = 'allow' | 'deny' | 'approval';

export interface PolicyRule {
  domain?: DomainId;
  capability?: string;
  effect: PolicyEffect;
  reason: string;
}

export interface SecurityContext {
  userId?: string;
  authenticated: boolean;
  projectId?: string;
  projectStatus?: 'draft' | 'ready_for_review' | 'approved' | 'rejected';
}

/** Deterministic policy boundary. LLMs never decide whether an action may execute. */
export class DeterministicPolicySecurityCore implements CorePolicy {
  constructor(
    private readonly rules: readonly PolicyRule[] = [],
    private readonly context: SecurityContext = { authenticated: true },
  ) {}

  async authorize(request: CapabilityRequest): Promise<{ allowed: boolean; requiresApproval: boolean; reason?: string }> {
    if (!this.context.authenticated) {
      return { allowed: false, requiresApproval: false, reason: 'Authentication is required.' };
    }

    const rule = this.rules.find((candidate) =>
      (candidate.domain === undefined || candidate.domain === request.domain) &&
      (candidate.capability === undefined || candidate.capability === request.capability),
    );

    if (rule?.effect === 'deny') return { allowed: false, requiresApproval: false, reason: rule.reason };

    const publicAction = /(^|\.)(publish|release|paid-ad\.publish|affiliate\.publish)$/.test(request.capability)
      || request.capability === 'public.publish';

    if (publicAction) {
      if (this.context.projectStatus !== 'approved') {
        return { allowed: true, requiresApproval: true, reason: 'Public-facing actions require an explicitly approved project.' };
      }
    }

    if (rule?.effect === 'approval' || request.requiresApproval) {
      return { allowed: true, requiresApproval: true, reason: rule?.reason ?? 'This action requires user approval.' };
    }

    return { allowed: true, requiresApproval: false, reason: rule?.reason };
  }
}

export const CREATOR_WORKSTATION_POLICY: readonly PolicyRule[] = [
  { domain: 'creator-workstation', capability: 'project.create', effect: 'allow', reason: 'Creating a private project is non-public.' },
  { domain: 'creator-workstation', capability: 'asset.import', effect: 'allow', reason: 'Importing an asset is non-public.' },
  { domain: 'creator-workstation', capability: 'project.edit', effect: 'allow', reason: 'Editing remains inside the project boundary.' },
  { domain: 'creator-workstation', capability: 'project.export', effect: 'allow', reason: 'Exporting a private working package is allowed.' },
  { domain: 'creator-workstation', capability: 'public.publish', effect: 'approval', reason: 'Publishing creative work requires user approval.' },
  { domain: 'directoros', capability: 'take.generate', effect: 'allow', reason: 'Generating a candidate take is non-public.' },
  { domain: 'directoros', capability: 'take.regenerate', effect: 'allow', reason: 'Regenerating a candidate take is non-public.' },
  { domain: 'directoros', capability: 'project.export', effect: 'allow', reason: 'Exporting a working project is non-public.' },
  { domain: 'directoros', capability: 'public.publish', effect: 'approval', reason: 'Publishing DirectorOS output requires user approval.' },
];
