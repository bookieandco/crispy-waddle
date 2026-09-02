import type { ActionIdentityVerifier, AuditRpcClient, VerifiedActionExecutor } from '@jhadina/action-core';
import type { NonceReplayGuard } from '@jhadina/security-core';
import type { ActionRequest } from '@jhadina/action-core';
import { MoneyProviderHealthGate, type ProviderConfig, type ProviderHealthChecker } from './provider-health.js';
import { MoneyProviderRegistry } from './provider-registry.js';
import type { AccountReadAction } from './account-read-handler.js';
import type { BankAdapter, MoneyAccount } from './bank-adapter.js';
import { createProductionMoneyAccountReadExecutor } from './production-account-read.js';

export type GovernedProviderAccountReadOptions = {
  identityVerifier: ActionIdentityVerifier;
  supabase: AuditRpcClient;
  providers: MoneyProviderRegistry;
  providerConfig?: Readonly<Record<string, ProviderConfig>>;
  healthChecker?: ProviderHealthChecker;
  assertUserWorkspace?: (userId: string) => Promise<void>;
  /** Required durable one-shot guard; production execution cannot omit it. */
  replayGuard: NonceReplayGuard;
};

/** Production Money Core composition with the provider health gate in front of the provider registry. */
export function createGovernedProviderAccountReadExecutor(
  options: GovernedProviderAccountReadOptions,
): VerifiedActionExecutor<AccountReadAction, MoneyAccount[]> {
  const healthGate = new MoneyProviderHealthGate(options.providerConfig, options.healthChecker);

  const bank = {
    getProvider(provider: string): BankAdapter {
      return options.providers.get(provider);
    },
    async assertUserWorkspace(userId: string) {
      await options.assertUserWorkspace?.(userId);
    },
  };

  const executor = createProductionMoneyAccountReadExecutor({
    identityVerifier: options.identityVerifier,
    supabase: options.supabase,
    bank,
    replayGuard: options.replayGuard,
  });

  const original = executor.execute.bind(executor);
  return {
    async execute(request: ActionRequest<AccountReadAction>) {
      const identity = await options.identityVerifier.verify(request);
      if (identity.userId !== request.userId) throw new Error('Action identity mismatch');
      if (!identity.sessionId) throw new Error('Action session missing');

      const adapter = options.providers.get(request.action.provider);
      await healthGate.requireReady(adapter, 'money.account.read');
      return original(request);
    },
  } as VerifiedActionExecutor<AccountReadAction, MoneyAccount[]>;
}
