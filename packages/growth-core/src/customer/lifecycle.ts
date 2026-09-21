import type { CustomerLifecycleStage, RfmSnapshot } from './customer-graph.js';

export type LifecycleAction =
  | 'educate'
  | 'nurture'
  | 'retarget'
  | 'welcome'
  | 'cross_sell'
  | 'replenish'
  | 'vip'
  | 'win_back'
  | 'suppress';

export interface LifecycleDecision {
  stage: CustomerLifecycleStage;
  proposedAction: LifecycleAction;
  rationale: string;
  requiresExternalCommunicationApproval: boolean;
}

export function decideLifecycleAction(
  rfm: RfmSnapshot,
  intentScore: number,
  options: { repeatCustomerThreshold?: number; vipMonetaryThreshold?: number; churnDays?: number } = {},
): LifecycleDecision {
  const repeatThreshold = options.repeatCustomerThreshold ?? 2;
  const vipThreshold = options.vipMonetaryThreshold ?? 500;
  const churnDays = options.churnDays ?? 120;

  if (rfm.frequency === 0) {
    if (intentScore >= 0.75) return { stage: 'lead', proposedAction: 'retarget', rationale: 'High current purchase intent without a recorded purchase.', requiresExternalCommunicationApproval: true };
    if (intentScore >= 0.35) return { stage: 'engaged', proposedAction: 'nurture', rationale: 'Meaningful engagement exists but conversion evidence is incomplete.', requiresExternalCommunicationApproval: true };
    return { stage: 'prospect', proposedAction: 'educate', rationale: 'Low current purchase intent; continue non-invasive education and measurement.', requiresExternalCommunicationApproval: true };
  }

  if (rfm.monetaryValue >= vipThreshold && rfm.frequency >= repeatThreshold) {
    return { stage: 'vip', proposedAction: 'vip', rationale: 'High value and repeat purchase history.', requiresExternalCommunicationApproval: true };
  }
  if (rfm.recencyDays >= churnDays * 2) {
    return { stage: 'churned', proposedAction: 'win_back', rationale: 'Customer has exceeded the churn window by a wide margin.', requiresExternalCommunicationApproval: true };
  }
  if (rfm.recencyDays >= churnDays) {
    return { stage: 'at_risk', proposedAction: 'win_back', rationale: 'Customer recency crossed the churn-risk threshold.', requiresExternalCommunicationApproval: true };
  }
  if (rfm.frequency >= repeatThreshold) {
    return { stage: 'repeat_customer', proposedAction: 'cross_sell', rationale: 'Repeat buyer with recent purchase history.', requiresExternalCommunicationApproval: true };
  }
  return { stage: 'customer', proposedAction: 'welcome', rationale: 'New customer with a recorded purchase.', requiresExternalCommunicationApproval: true };
}
