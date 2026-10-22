// Source-pinned canonical migrations; hashes are Git blob object IDs from main at review.
// This inventory is NOT approval to run DDL or an independent backup receipt.
export const PURSE_MIGRATION_MANIFEST=Object.freeze([
 {version:'20261002190000',name:'side_hustle_commercial_runtime',
  path:'supabase/migrations/20261002190000_side_hustle_commercial_runtime.sql',
  blob:'c3ea4436ab8d463752c50043cb2372525719f2bd',
  tables:['jhadina_side_hustle_work_orders','jhadina_side_hustle_commercial_receipts'],
  functions:['jhadina_side_hustle_work_order_save','jhadina_side_hustle_commercial_receipt_record','jhadina_side_hustle_commercial_transition']},
 {version:'20261003143000',name:'side_hustle_commerce_runtime',
  path:'supabase/migrations/20261003143000_side_hustle_commerce_runtime.sql',
  blob:'53108b71e46243228e365fd7b3372d58d58f2cd2',
  tables:['jhadina_side_hustle_commerce_records'],
  functions:['jhadina_side_hustle_commerce_record_save']},
 {version:'20261003181500',name:'side_hustle_commissioning_evidence',
  path:'supabase/migrations/20261003181500_side_hustle_commissioning_evidence.sql',
  blob:'dd43994a593a3c67fffa8a8ce50be902313fc1d5',
  tables:['jhadina_side_hustle_commissioning_evidence'],
  functions:['jhadina_side_hustle_commissioning_evidence_record']},
 {version:'20261003221000',name:'side_hustle_digital_product_studio_registry',
  path:'supabase/migrations/20261003221000_side_hustle_digital_product_studio_registry.sql',
  blob:'51749b64e95b7d50eaa865f336e645c57dded251',
  tables:['jhadina_digital_product_studio_records'],
  functions:['jhadina_digital_product_studio_record_save']}
])
export const REQUIRED_PARENTS=Object.freeze(['jhadina_opportunities','jhadina_venture_records'])
export const READ_ONLY_REVIEW_AUTHORITY='READ_ONLY_NO_DDL_NO_FUNDS'
