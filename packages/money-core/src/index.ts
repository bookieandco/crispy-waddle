// Public surface for @jhadina/money-core. package.json's "main"/"types"
// have pointed at this file since the package was created; it never
// existed, so nothing outside packages/money-core has ever been able to
// import this package by its bare specifier. Added as part of Spine
// Proof #3 (Money/Plaid), the first cross-package consumer.
export type { MoneyCapability, CapabilityRisk } from './capabilities.js';
export { getMoneyCapability, requiresMoneyApproval, isMoneyCapability } from './capabilities.js';

export type { MoneyAction } from './capability-policy.js';
export { MoneyCapabilityPolicy, assertMoneyActionType } from './capability-policy.js';

export type { MoneyAccount, MoneyTransaction, MoneyAdapterContext, BankAdapter } from './bank-adapter.js';
export { assertCapability } from './bank-adapter.js';

export type { ResolvedCredential, CredentialResolver } from './credential-resolver.js';
export { EnvironmentCredentialResolver, credentialRefToEnvKey } from './credential-resolver.js';

export type {
  ProviderHealthStatus,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthChecker,
} from './provider-health.js';
export { MoneyProviderHealthGate } from './provider-health.js';

export { MoneyProviderRegistry } from './provider-registry.js';

export type { ProviderAdapterBuilder, ProviderAdapterFactoryOptions } from './provider-adapter-factory.js';
export { ProviderAdapterFactory } from './provider-adapter-factory.js';

export type { AccountReadAction, AccountReadHandlerDeps } from './account-read-handler.js';
export { MoneyAccountReadHandler } from './account-read-handler.js';

export type { GovernedAccountReadDeps, MoneyAccountReadRequest } from './governed-account-read.js';
export {
  MONEY_CORE_SECURITY_POLICY,
  createMoneyAccountReadSecurityRequest,
  createMoneyAccountReadHandler,
  createMoneySecurityCore,
} from './governed-account-read.js';

export type { ProductionMoneyAccountReadOptions } from './production-account-read.js';
export { createProductionMoneyAccountReadExecutor } from './production-account-read.js';

export type { GovernedProviderAccountReadOptions } from './governed-provider-account-read.js';
export { createGovernedProviderAccountReadExecutor } from './governed-provider-account-read.js';

export type { HttpClient, ReadOnlyHttpBankAdapterOptions } from './read-only-http-bank-adapter.js';
export { ReadOnlyHttpBankAdapter } from './read-only-http-bank-adapter.js';

export type { PlaidReadOnlyAdapterOptions } from './plaid-read-only-adapter.js';
export { PlaidReadOnlyAdapter } from './plaid-read-only-adapter.js';

export { buildPlaidReadOnlyAdapter, createPlaidReadOnlyAdapterBuilder } from './plaid-provider-builder.js';
