import { getMoneyCapability, type MoneyCapability } from './capabilities.js';
import type { ActionPolicy, ActionPolicyDecision, ActionRequest } from '@jhadina/action-core';

export type MoneyAction = { capability: MoneyCapability; [key: string]: unknown };

export class MoneyCapabilityPolicy implements ActionPolicy<MoneyAction> {
  async evaluate(request: ActionRequest<MoneyAction>): Promise<ActionPolicyDecision> {
    const capability = request.action?.capability;
    if (!capability || !request.userId) return 'deny';
    const definition = getMoneyCapability(capability);
    if (!definition) return 'deny';
    if (definition.approval) return 'deny';
    return 'allow';
  }
}

export function assertMoneyActionType(request: ActionRequest<MoneyAction>, expected: MoneyCapability) {
  if (request.action.capability !== expected) throw new Error(`MONEY_CAPABILITY_MISMATCH:${expected}`);
}
