import type { ActionRequest } from '@jhadina/action-core';
import type { MoneyTransaction } from '@jhadina/money-core';
import { MoneyTransactionReadHandler, type TransactionReadAction } from '@jhadina/money-core';
import { runCapitalDryRun, type CapitalDryRunReport } from './dry-run';
import type { ReplayClassificationResolver } from './replay';

/**
 * Read-only service boundary: Capital Intelligence obtains financial history
 * exclusively through Money Core's capability/ownership-checked transaction
 * handler. It never receives provider credentials or calls a BankAdapter.
 */
export async function runAuthorizedCapitalDryRun(
  handler: MoneyTransactionReadHandler,
  userId: string,
  accountId: string,
  requestId: string,
  resolveClassification: ReplayClassificationResolver,
): Promise<CapitalDryRunReport> {
  const action: TransactionReadAction = { capability: 'money.transaction.read', accountId };
  const request = { id: requestId, userId } as ActionRequest<TransactionReadAction>;
  const transactions: MoneyTransaction[] = await handler.execute(action, request);
  return runCapitalDryRun(transactions, resolveClassification);
}
