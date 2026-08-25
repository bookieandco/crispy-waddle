export type FeedAutonomyLevel = 'observe' | 'organize' | 'recommend' | 'prepare' | 'act';

export type ActionPreviewStatus = 'draft' | 'ready_for_approval' | 'approved' | 'rejected' | 'executed';

export interface ActionPreviewChange {
  field: string;
  before?: string;
  after?: string;
}

export interface FeedActionPreview {
  id: string;
  feedItemId: string;
  title: string;
  description: string;
  autonomy: 'prepare';
  status: ActionPreviewStatus;
  why: string;
  changes: ActionPreviewChange[];
  actionLabel: string;
  requiresApproval: true;
  createdAt: string;
}

export function createActionPreview(input: Omit<FeedActionPreview, 'id' | 'createdAt' | 'autonomy' | 'requiresApproval'>): FeedActionPreview {
  return {
    ...input,
    id: `action_preview_${input.feedItemId}_${Date.now()}`,
    autonomy: 'prepare',
    requiresApproval: true,
    createdAt: new Date().toISOString(),
  };
}

export function canExecuteActionPreview(preview: FeedActionPreview): boolean {
  return preview.status === 'approved';
}
