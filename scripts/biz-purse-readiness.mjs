import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const REQUIRED_SCHEMA = Object.freeze([
  {migration:'20261002190000',table:'jhadina_side_hustle_work_orders',function:'jhadina_side_hustle_work_order_save'},
  {migration:'20261002190000',table:'jhadina_side_hustle_commercial_receipts',function:'jhadina_side_hustle_commercial_receipt_record'},
  {migration:'20261003143000',table:'jhadina_side_hustle_commerce_records',function:'jhadina_side_hustle_commerce_record_save'},
  {migration:'20261003181500',table:'jhadina_side_hustle_commissioning_evidence',function:'jhadina_side_hustle_commissioning_evidence_record'},
  {migration:'20261003221000',table:'jhadina_digital_product_studio_records',function:'jhadina_digital_product_studio_record_save'},
]);

/** Read-only assessment. This never runs migrations, signs actions or creates financial authority. */
export function auditBusinessPurseSchema(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('BIZ_PURSE_PROBE_OBJECT_REQUIRED');
  if (!Array.isArray(input.migrations) || !input.relations || !input.functions || !input.rls) throw new Error('BIZ_PURSE_PROBE_INCOMPLETE');
  const migrationSet = new Set(input.migrations.filter(x=>typeof x==='string'));
  const issues=[];
  for (const item of REQUIRED_SCHEMA) {
    const migrationPresent=migrationSet.has(item.migration);
    const tablePresent=input.relations[item.table] === true;
    const functionPresent=input.functions[item.function] === true;
    const rlsPresent=input.rls[item.table] === true;
    if (!migrationPresent) issues.push({code:'MIGRATION_MISSING',migration:item.migration,table:item.table});
    if (!tablePresent) issues.push({code:'TABLE_MISSING',table:item.table});
    if (!functionPresent) issues.push({code:'RPC_MISSING',function:item.function});
    if (tablePresent && !rlsPresent) issues.push({code:'RLS_DISABLED',table:item.table});
    if (migrationPresent && (!tablePresent || !functionPresent || !rlsPresent)) issues.push({code:'SCHEMA_DRIFT',migration:item.migration,table:item.table});
  }
  const snapshotAt=typeof input.observedAt==='string' && Number.isFinite(Date.parse(input.observedAt)) ? input.observedAt : null;
  if (!snapshotAt) issues.push({code:'TIMESTAMP_MISSING'});
  return Object.freeze({
    status:issues.length ? 'BLOCKED' : 'READY_FOR_SECURITY_AND_RESTORE_REVIEW',
    checkedAt:snapshotAt,
    issues:Object.freeze(issues),
    schemaChecks:REQUIRED_SCHEMA.length,
    productionCertified:false,
    moneyMovementAuthorized:false,
    externalActionAuthorized:false,
    nextGate:issues.length?'REVIEW_CANONICAL_MIGRATION_CHAIN':'VERIFY_OWNER_RLS_GRANTS_BACKUP_RESTORE_AND_AUTHENTICATED_APIS',
  });
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const path=process.argv[2];
  if (!path) {
    console.error('Usage: node scripts/biz-purse-readiness.mjs <readonly-probe.json>');
    process.exitCode=2;
  } else {
    try {
      const report=auditBusinessPurseSchema(JSON.parse(readFileSync(path,'utf8')));
      console.log(JSON.stringify(report,null,2));
      if(report.status==='BLOCKED') process.exitCode=1;
    } catch (error) {
      console.error(error instanceof Error?error.message:String(error));
      process.exitCode=2;
    }
  }
}
