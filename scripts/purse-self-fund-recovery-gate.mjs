// JH-PURSE-SELF-FUND.RECOVER.03 — evidence interpretation only.
// This module NEVER applies SQL, authorizes a payment or certifies independent backups.
export const PURSE_REQUIRED_COMMERCIAL_TABLES = Object.freeze([
  'jhadina_side_hustle_work_orders',
  'jhadina_side_hustle_commercial_receipts',
  'jhadina_side_hustle_commerce_records',
  'jhadina_side_hustle_commissioning_evidence',
  'jhadina_digital_product_studio_records',
]);

export function reviewPurseSelfFundReadiness(input) {
  if (!input || !Array.isArray(input.tableChecks) || typeof input.observedAt !== 'string' ||
      !Number.isFinite(Date.parse(input.observedAt))) throw new Error('PURSE_RECOVERY_INVALID_AUDIT');
  const rows = new Map();
  for (const row of input.tableChecks) {
    if (!row || typeof row.table_name !== 'string' || typeof row.exists_in_public !== 'boolean' ||
        typeof row.rls_enabled !== 'boolean' || rows.has(row.table_name)) {
      throw new Error('PURSE_RECOVERY_DUPLICATE_OR_MALFORMED_ROW');
    }
    rows.set(row.table_name, row);
  }
  const missing = PURSE_REQUIRED_COMMERCIAL_TABLES.filter(name => rows.get(name)?.exists_in_public !== true);
  const withoutRls = PURSE_REQUIRED_COMMERCIAL_TABLES.filter(name =>
    rows.get(name)?.exists_in_public === true && rows.get(name).rls_enabled !== true);
  const blockers = [];
  if (input.connectionReadOnly !== 'off') blockers.push('POSTGRES_WRITE_READINESS_UNVERIFIED');
  if (missing.length) blockers.push('COMMERCIAL_SCHEMA_MISSING');
  if (withoutRls.length) blockers.push('COMMERCIAL_RLS_MISSING');
  if (!input.independentlyVerifiedBackupAndRestore) blockers.push('INDEPENDENT_BACKUP_RESTORE_REQUIRED');
  if (!input.isolatedMigrationReplayPassed) blockers.push('ISOLATED_MIGRATION_REPLAY_REQUIRED');
  if (!input.crossTenantRlsTestPassed) blockers.push('CROSS_TENANT_RLS_TEST_REQUIRED');
  if (!input.ownerProductionApproval) blockers.push('OWNER_PRODUCTION_APPROVAL_REQUIRED');
  // These booleans are untrusted operator claims until reviewed externally.
  // Even a clear checklist cannot mint a financial or database execution permit.
  return Object.freeze({
    status: blockers.length ? 'BLOCKED' : 'OWNER_INDEPENDENT_REVIEW_REQUIRED',
    missingCommercialTables: Object.freeze(missing),
    missingRlsTables: Object.freeze(withoutRls),
    blockers: Object.freeze(blockers),
    authority: 'READ_ONLY_AUDIT',
    canApplyMigration: false,
    canMoveMoney: false,
    canTrade: false,
    productionCertified: false,
  });
}
