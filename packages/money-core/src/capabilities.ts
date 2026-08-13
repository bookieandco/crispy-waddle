export type MoneyCapability =
  | 'money.account.read'
  | 'money.transaction.read'
  | 'money.statement.read'
  | 'money.debt.read'
  | 'money.privacy.scan'
  | 'money.privacy.prepare-request'
  | 'money.privacy.submit-request'
  | 'money.payment.create'
  | 'money.transfer.create'
  | 'money.account.change';

export type CapabilityRisk = 'read' | 'privacy' | 'financial';

const DEFINITIONS: Record<MoneyCapability, { risk: CapabilityRisk; approval: boolean }> = {
  'money.account.read': { risk: 'read', approval: false },
  'money.transaction.read': { risk: 'read', approval: false },
  'money.statement.read': { risk: 'read', approval: false },
  'money.debt.read': { risk: 'read', approval: false },
  'money.privacy.scan': { risk: 'privacy', approval: false },
  'money.privacy.prepare-request': { risk: 'privacy', approval: false },
  'money.privacy.submit-request': { risk: 'privacy', approval: true },
  'money.payment.create': { risk: 'financial', approval: true },
  'money.transfer.create': { risk: 'financial', approval: true },
  'money.account.change': { risk: 'financial', approval: true },
};

export function getMoneyCapability(capability: MoneyCapability) {
  return DEFINITIONS[capability];
}

export function requiresMoneyApproval(capability: MoneyCapability) {
  return DEFINITIONS[capability].approval;
}

export function isMoneyCapability(value: string): value is MoneyCapability {
  return value in DEFINITIONS;
}
