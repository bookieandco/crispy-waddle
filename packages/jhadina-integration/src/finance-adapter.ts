import type { ActionAdapter, ExecutionContext } from './action-executor';
import type { DomainId } from './contracts';

export interface LedgerCapabilityProvider {
  execute(capability: string, input: unknown, context: ExecutionContext): Promise<unknown>;
}

/** Financial capability boundary for Finance/Money Core. frappe/books is treated as a reference integration, not copied into core. */
export function createFinanceAdapter(provider: LedgerCapabilityProvider): ActionAdapter {
  return {
    domain: 'commerce' as DomainId,
    capability: 'finance.ledger',
    execute: (input, context) => provider.execute('finance.ledger', input, context),
  };
}

export const FRAPPE_BOOKS_REFERENCE = {
  source: 'frappe/books',
  role: 'reference-finance-implementation',
  integrationRule: 'Adapt accounting concepts behind Jhadina Money Core; do not bypass Jhadina Policy, Audit, or Action Executor.',
  concepts: ['accounting-settings', 'accounting-ledger-entry', 'invoices', 'payments', 'expenses'],
} as const;
