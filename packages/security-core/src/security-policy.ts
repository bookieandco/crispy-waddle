export type SecurityDecision = 'allow' | 'deny' | 'approval_required';

export type SecurityPolicy = {
  allowedCapabilities: readonly string[];
  approvalCapabilities: readonly string[];
  deniedCapabilities?: readonly string[];
};

export const JHADINA_BASE_SECURITY_POLICY: SecurityPolicy = {
  allowedCapabilities: [
    'project.create',
    'project.edit',
    'project.export',
    'asset.import',
    'timeline.edit',
    'timeline.snapshot',
    'take.generate',
    'take.regenerate',
    'take.record',
    'take.select',
    'audio.edit',
    'image.edit',
    'storyboard.edit',
    'research.run',
    'memory.propose',
    'memory.read',
    'public.publish',
    'paid-ad.publish',
    'affiliate.publish',
    'consequential.outreach',
    'financial.execute',
    'account.connect',
    'credential.rotate',
    'memory.commit',
    'growth.draft.approve',
    'overage.review',
  ],
  approvalCapabilities: [
    'public.publish',
    'paid-ad.publish',
    'affiliate.publish',
    'consequential.outreach',
    'financial.execute',
    'account.connect',
    'credential.rotate',
    'memory.commit',
    'growth.draft.approve',
  ],
};
