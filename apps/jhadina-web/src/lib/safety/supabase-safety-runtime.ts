import type {
  DurableSafetyIncident,
  DurableSafetyIncidentStore,
  EncryptedPersonalSafetyProfileEnvelope,
  PersonalSafetyProfileStore,
} from '@jhadina/core-spine';
import { createServiceRoleClient } from '../supabase/service-role';

type SafetyIncidentRow = {
  incident_id: string;
  owner_id: string;
  protocol_id: string;
  dead_man_state: DurableSafetyIncident['deadManState'];
  deadline_at: string | null;
  timeline: DurableSafetyIncident['timeline'];
  updated_at: string;
};

function incidentFromRow(row: SafetyIncidentRow): DurableSafetyIncident {
  return {
    incidentId: row.incident_id,
    ownerUserId: row.owner_id,
    protocolId: row.protocol_id,
    deadManState: row.dead_man_state,
    deadlineAt: row.deadline_at ?? undefined,
    timeline: row.timeline,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseSafetyIncidentStore(): DurableSafetyIncidentStore | undefined {
  const client = createServiceRoleClient();
  if (!client) return undefined;

  return {
    async load(incidentId) {
      const { data, error } = await client
        .from('jhadina_safety_incidents')
        .select('incident_id,owner_id,protocol_id,dead_man_state,deadline_at,timeline,updated_at')
        .eq('incident_id', incidentId)
        .maybeSingle();
      if (error) throw new Error(`SAFETY_INCIDENT_READ_FAILED:${error.message}`);
      return data ? incidentFromRow(data as SafetyIncidentRow) : null;
    },

    async save(snapshot, expectedUpdatedAt) {
      const row = {
        incident_id: snapshot.incidentId,
        owner_id: snapshot.ownerUserId,
        protocol_id: snapshot.protocolId,
        dead_man_state: snapshot.deadManState,
        deadline_at: snapshot.deadlineAt ?? null,
        timeline: snapshot.timeline,
        updated_at: snapshot.updatedAt,
      };

      if (!expectedUpdatedAt) {
        const { error } = await client.from('jhadina_safety_incidents').upsert(row, { onConflict: 'incident_id' });
        if (error) throw new Error(`SAFETY_INCIDENT_SAVE_FAILED:${error.message}`);
        return 'saved';
      }

      const { data, error } = await client
        .from('jhadina_safety_incidents')
        .update(row)
        .eq('incident_id', snapshot.incidentId)
        .eq('updated_at', expectedUpdatedAt)
        .select('incident_id');
      if (error) throw new Error(`SAFETY_INCIDENT_SAVE_FAILED:${error.message}`);
      return Array.isArray(data) && data.length === 1 ? 'saved' : 'conflict';
    },
  };
}

type SafetyProfileRow = {
  owner_id: string;
  profile_id: string;
  ciphertext_ref: string;
  key_id: string;
  updated_at: string;
};

export function createSupabasePersonalSafetyProfileStore(): PersonalSafetyProfileStore | undefined {
  const client = createServiceRoleClient();
  if (!client) return undefined;

  return {
    async loadEnvelope(ownerUserId) {
      const { data, error } = await client
        .from('jhadina_safety_personal_profiles')
        .select('owner_id,profile_id,ciphertext_ref,key_id,updated_at')
        .eq('owner_id', ownerUserId)
        .maybeSingle();
      if (error) throw new Error(`SAFETY_PROFILE_READ_FAILED:${error.message}`);
      if (!data) return null;
      const row = data as SafetyProfileRow;
      const envelope: EncryptedPersonalSafetyProfileEnvelope = {
        ownerUserId: row.owner_id,
        profileId: row.profile_id,
        ciphertextRef: row.ciphertext_ref,
        keyId: row.key_id,
        updatedAt: row.updated_at,
      };
      return envelope;
    },

    async saveEnvelope(envelope) {
      const { error } = await client.from('jhadina_safety_personal_profiles').upsert({
        owner_id: envelope.ownerUserId,
        profile_id: envelope.profileId,
        ciphertext_ref: envelope.ciphertextRef,
        key_id: envelope.keyId,
        updated_at: envelope.updatedAt,
      }, { onConflict: 'owner_id' });
      if (error) throw new Error(`SAFETY_PROFILE_SAVE_FAILED:${error.message}`);
    },
  };
}
