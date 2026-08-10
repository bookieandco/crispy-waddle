import type { ActionHandler, ActionRequest } from '@jhadina/action-core';
import { markSubmitted, prepareForSubmission, type PrivacyDefenseRequest } from './privacy-defense.js';

export type PrivacyAction = { capability: 'money.privacy.prepare-request' | 'money.privacy.submit-request'; request: PrivacyDefenseRequest };

export class MoneyPrivacyDefenseHandler implements ActionHandler<PrivacyAction, PrivacyDefenseRequest> {
  supports(type: string): boolean {
    return type === 'money.privacy.prepare-request' || type === 'money.privacy.submit-request';
  }

  async execute(action: PrivacyAction, _request: ActionRequest<PrivacyAction>): Promise<PrivacyDefenseRequest> {
    if (action.capability === 'money.privacy.prepare-request') return prepareForSubmission(action.request);
    return markSubmitted(action.request);
  }
}
