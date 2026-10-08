export const MONEY_FINISH_INVENTORY_SCHEMA = 'MONEY-FINISH-01' as const;

type Status = 'MAIN' | 'OPEN_PR' | 'EXTERNAL_BLOCKED';
type DependencyState = 'MERGED_MAIN' | 'OPEN_PR';
export type MoneyFinishInventory = Readonly<{
  schemaVersion: typeof MONEY_FINISH_INVENTORY_SCHEMA;
  auditedAt: string;
  baseCommit: string;
  repository: string;
  dependencies: readonly Readonly<{pr:number;head:string;state:DependencyState;base:string;provides:readonly string[];dependsOn?:readonly number[]}>[];
  capabilities: readonly Readonly<{id:string;status:Status;paths?:readonly string[];dependencyPr?:number;blocker?:string}>[];
}>;

export function assertMoneyFinishInventory(value: MoneyFinishInventory): void {
  if (value.schemaVersion !== MONEY_FINISH_INVENTORY_SCHEMA ||
      !/^\\d{4}-\\d{2}-\\d{2}$/.test(value.auditedAt) ||
      !/^[0-9a-f]{40}$/.test(value.baseCommit) ||
      value.repository !== 'bookieandco/crispy-waddle') throw new Error('MONEY_FINISH_INVENTORY_HEADER_INVALID');
  const prs = new Map<number, MoneyFinishInventory['dependencies'][number]>();
  for (const dep of value.dependencies) {
    if (!Number.isSafeInteger(dep.pr) || dep.pr <= 0 || prs.has(dep.pr) || !/^[0-9a-f]{40}$/.test(dep.head) ||
        !dep.base || !dep.provides.length || !['MERGED_MAIN','OPEN_PR'].includes(dep.state)) {
      throw new Error('MONEY_FINISH_DEPENDENCY_INVALID');
    }
    prs.set(dep.pr, dep);
  }
  for (const dep of value.dependencies) {
    for (const parent of dep.dependsOn ?? []) {
      if (parent === dep.pr || !prs.has(parent)) throw new Error('MONEY_FINISH_PARENT_PR_UNRESOLVED');
    }
  }
  const ids = new Set<string>();
  for (const capability of value.capabilities) {
    if (!capability.id.trim() || ids.has(capability.id)) throw new Error('MONEY_FINISH_DUPLICATE_CAPABILITY');
    ids.add(capability.id);
    if (capability.status === 'MAIN') {
      if (!capability.paths?.length || capability.dependencyPr || capability.blocker) throw new Error('MONEY_FINISH_MAIN_FILE_PROOF_REQUIRED');
    } else if (capability.status === 'OPEN_PR') {
      const dep = prs.get(capability.dependencyPr ?? -1);
      if (dep?.state !== 'OPEN_PR' || !dep.provides.includes(capability.id) || capability.paths?.length) {
        throw new Error('MONEY_FINISH_OPEN_PR_LINK_INVALID');
      }
    } else if (capability.status === 'EXTERNAL_BLOCKED') {
      if (!capability.blocker?.trim() || capability.dependencyPr || capability.paths?.length) throw new Error('MONEY_FINISH_BLOCK_REASON_REQUIRED');
    } else throw new Error('MONEY_FINISH_CAPABILITY_STATE_INVALID');
  }
  if (!ids.has('PAPER_LEDGER') || !ids.has('SHADOW_GRADE_REPAIR') || !ids.has('ORIGINAL_SHADOW_VOLUME_RESTORED')) {
    throw new Error('MONEY_FINISH_REQUIRED_CAPABILITIES_MISSING');
  }
}
