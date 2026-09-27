import type {
  ConsumerSafetySetupSnapshot,
  ConsumerSafetySetupStore,
  ConsumerSafetyOSStage,
} from '@jhadina/core-spine';
import { CONSUMER_SAFETYOS_VERSION } from '@jhadina/core-spine';
import { createServiceRoleClient } from '../supabase/service-role';

type ConsumerSetupRow = {
  owner_id: string;
  enrollment_id: string;
  product_version: string;
  stage: ConsumerSafetyOSStage;
  blockers: unknown;
  updated_at: string;
};

function blockersFromRow(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function setupFromRow(row: ConsumerSetupRow): ConsumerSafetySetupSnapshot {
  if (row.product_version !== CONSUMER_SAFETYOS_VERSION) {
    throw new Error(`SAFETYOS_SETUP_VERSION_UNSUPPORTED:${row.product_version}`);
  }
  return {
    ownerUserId: row.owner_id,
    enrollmentId: row.enrollment_id,
    productVersion: CONSUMER_SAFETYOS_VERSION,
    stage: row.stage,
    blockers: blockersFromRow(row.blockers),
    updatedAt: row.updated_at,
  };
}

/**
 * Stores only non-secret Consumer SafetyOS setup/readiness state.
 * Plaintext code words, contact coordinates/addresses, phone/email values,
 * confirmation phrases, encryption keys and evidence payloads do not belong here.
 */
export function createSupabaseConsumerSafetySetupStore(): ConsumerSafetySetupStore | undefined {
  const client = createServiceRoleClient();
  if (!client) return undefined;

  return {
    async load(ownerUserId) {
      const { data, error } = await client
        .from('jhadina_safety_consumer_setups')
        .select('owner_id,enrollment_id,product_version,stage,blockers,updated_at')
        .eq('owner_id', ownerUserId)
        .maybeSingle();
      if (error) throw new Error(`SAFETYOS_SETUP_READ_FAILED:${error.message}`);
      return data ? setupFromRow(data as ConsumerSetupRow) : null;
    },

    async save(snapshot) {
      if (snapshot.productVersion !== CONSUMER_SAFETYOS_VERSION) {
        throw new Error('SAFETYOS_SETUP_VERSION_INVALID');
      }
      const { error } = await client.from('jhadina_safety_consumer_setups').upsert({
        owner_id: snapshot.ownerUserId,
        enrollment_id: snapshot.enrollmentId,
        product_version: snapshot.productVersion,
        stage: snapshot.stage,
        blockers: snapshot.blockers,
        updated_at: snapshot.updatedAt,
      }, { onConflict: 'owner_id' });
      if (error) throw new Error(`SAFETYOS_SETUP_SAVE_FAILED:${error.message}`);
    },
  };
}
