export type PrivacyAttentionSeverity = 'info' | 'attention' | 'urgent' | 'critical';
export type PrivacyAttentionKind = 'discovery' | 'request' | 'verification' | 'deadline' | 'rejection' | 'reappearance' | 'breach' | 'legal' | 'financial';

export type PrivacyAttention = {
  id: string;
  userId: string;
  kind: PrivacyAttentionKind;
  severity: PrivacyAttentionSeverity;
  title: string;
  summary: string;
  source?: string;
  relatedRequestId?: string;
  requiresDecision: boolean;
  createdAt: string;
  acknowledgedAt?: string;
};

export function createPrivacyAttention(input: Omit<PrivacyAttention, 'id' | 'createdAt'>): PrivacyAttention {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export function acknowledgePrivacyAttention(item: PrivacyAttention): PrivacyAttention {
  return { ...item, acknowledgedAt: new Date().toISOString() };
}

export function needsAttention(item: PrivacyAttention): boolean {
  return !item.acknowledgedAt || item.requiresDecision || item.severity === 'urgent' || item.severity === 'critical';
}
