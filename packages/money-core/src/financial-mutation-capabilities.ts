export const FINANCIAL_MUTATION_PREFIXES = [
  'money.payment.',
  'money.transfer.',
  'money.account.change',
  'money.order.',
  'money.trade.',
  'money.borrow.',
  'money.allocate.',
] as const;

export function isFinancialMutationCapability(capability:string):boolean {
  return FINANCIAL_MUTATION_PREFIXES.some(prefix=>capability.startsWith(prefix));
}
