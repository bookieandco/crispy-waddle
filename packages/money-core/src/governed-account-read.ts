import type { ActionHandler, ActionRequest, ActionPolicy, VerifiedActionExecutor } from '@jhadina/action-core';
import { JhadinaSecurityCore, JHADINA_BASE_SECURITY_POLICY, createSecurityRequest } from '@jhadina/security-core';
import { MoneyAccountReadHandler, type AccountReadAction, type AccountReadHandlerDeps } from './account-read-handler.js';

const MONEY_ALLOWED_CAPABILITIES = [
  ...JHADINA_BASE_SECURITY_POLICY.allowedCapabilities,
  'money.account.read',
];

export const MONEY_CORE_SECURITY_POLICY = {
  ...JHADINA_BASE_SECURITY_POLICY,
  allowedCapabilities: MONEY_ALLOWED_CAPABILITIES,
} as const;

export type GovernedAccountReadDeps = AccountReadHandlerDeps & {
  executor: VerifiedActionExecutor<AccountReadAction, unknown>;
  securityCore?: JhadinaSecurityCore;
};

/**
 * Creates the canonical governed request for the first Money Core read capability.
 * The handler is still executed by the shared Action Executor; this helper only
 * supplies the capability-bound Security Core request metadata.
 */
export function createMoneyAccountReadSecurityRequest(
  input: { requestId: string; actorId: string; provider: string; ttlMs?: number },
) {
  return createSecurityRequest({
    requestId: input.requestId,
    actorId: input.actorId,
    domain: 'money',
    capability: 'money.account.read',
    ttlMs: input.ttlMs,
  });
}

export function createMoneyAccountReadHandler(
  deps: AccountReadHandlerDeps,
): ActionHandler<AccountReadAction, unknown> {
  return new MoneyAccountReadHandler(deps);
}

export function createMoneySecurityCore(): JhadinaSecurityCore {
  return new JhadinaSecurityCore(MONEY_CORE_SECURITY_POLICY);
}

export type MoneyAccountReadRequest = ActionRequest<AccountReadAction>;
