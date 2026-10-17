import type { SupabaseClient } from "@supabase/supabase-js";
import {
  compileWeeklyDelegationManifest,
  type ApprovedWeeklySocialCampaignPacket,
  type SocialEngagementTargetAccount,
  type WeeklyDelegationConsumptionStore,
  type WeeklyDelegationManifest,
  type WeeklySocialCampaignPacket,
} from "@jhadina/social-core";
import type { WeeklyMarketingReport } from "@jhadina/growth-core";
import { createServiceRoleClient } from "../supabase/service-role";

export interface WeeklySocialActionStateRow {
  user_id: string;
  packet_id: string;
  action_id: string;
  campaign_id: string;
  action_kind: string;
  permit_id: string | null;
  action_fingerprint: string;
  scheduled_at: string;
  status:
    | "planned"
    | "ready"
    | "running"
    | "waiting"
    | "completed"
    | "failed"
    | "ambiguous"
    | "cancelled";
  attempt_count: number;
  external_receipt_refs: string[];
  last_error: string | null;
  updated_at: string;
}

export interface WeeklySocialRuntimeRepository
  extends WeeklyDelegationConsumptionStore {
  saveDraftPacket(input: {
    packet: WeeklySocialCampaignPacket;
    report?: WeeklyMarketingReport;
  }): Promise<void>;
  registerApprovedPacket(input: {
    packet: ApprovedWeeklySocialCampaignPacket;
    report?: WeeklyMarketingReport;
    manifest?: WeeklyDelegationManifest;
  }): Promise<WeeklyDelegationManifest>;
  saveReport(input: {
    ownerUserId: string;
    packetId: string;
    report: WeeklyMarketingReport;
  }): Promise<void>;
  listActiveOwnerIds(input: {
    observedAt: string;
    limit?: number;
  }): Promise<string[]>;
  listDueActions(input: {
    ownerUserId: string;
    observedAt: string;
    limit?: number;
  }): Promise<WeeklySocialActionStateRow[]>;
  updateActionState(input: {
    ownerUserId: string;
    packetId: string;
    actionId: string;
    status: WeeklySocialActionStateRow["status"];
    externalReceiptRefs?: readonly string[];
    lastError?: string;
  }): Promise<void>;
  upsertEngagementTarget(input: {
    ownerUserId: string;
    target: SocialEngagementTargetAccount;
  }): Promise<void>;
  listEngagementTargets(input: {
    ownerUserId: string;
    brand?: string;
    platform?: string;
    activeOnly?: boolean;
  }): Promise<SocialEngagementTargetAccount[]>;
}

export function createWeeklySocialRuntimeRepository(
  client: SupabaseClient | null = createServiceRoleClient(),
): WeeklySocialRuntimeRepository {
  if (!client) {
    throw new Error("SOCIAL_WEEKLY_SERVICE_ROLE_NOT_CONFIGURED");
  }

  return {
    async saveDraftPacket({ packet, report }) {
      await upsertPacket(client, {
        packet,
        status: "pending_approval",
        report,
      });
    },

    async registerApprovedPacket({ packet, report, manifest }) {
      const resolved = manifest ?? compileWeeklyDelegationManifest(packet);
      assertManifestMatchesPacket(packet, resolved);

      await upsertPacket(client, {
        packet,
        status: "approved",
        report,
      });

      const permitByAction = new Map(
        resolved.permits.map((permit) => [permit.actionId, permit]),
      );
      const rows = packet.actions.map((action) => {
        const permit = permitByAction.get(action.id);
        if (!permit) {
          throw new Error(
            "SOCIAL_WEEKLY_RUNTIME_PERMIT_MISSING:" + action.id,
          );
        }
        return {
          user_id: packet.ownerUserId,
          packet_id: packet.id,
          action_id: action.id,
          campaign_id: action.campaignId,
          action_kind: action.kind,
          permit_id: permit.id,
          action_fingerprint: permit.actionFingerprint,
          scheduled_at: action.scheduledAt,
          status: "planned",
          attempt_count: 0,
          external_receipt_refs: [],
          last_error: null,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await client
        .from("jhadina_social_weekly_action_state")
        .upsert(rows, {
          onConflict: "user_id,packet_id,action_id",
        });
      if (error) {
        throw new Error(
          "SOCIAL_WEEKLY_ACTION_REGISTER_FAILED:" + error.message,
        );
      }

      if (report) {
        await saveWeeklyReport(client, packet.ownerUserId, packet.id, report);
      }
      return resolved;
    },

    async saveReport({ ownerUserId, packetId, report }) {
      await saveWeeklyReport(client, ownerUserId, packetId, report);
    },

    async listActiveOwnerIds({ observedAt, limit = 100 }) {
      requireTimestamp(observedAt, "observedAt");
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
        throw new Error("SOCIAL_WEEKLY_OWNER_LIMIT_INVALID");
      }
      const { data, error } = await client
        .from("jhadina_social_weekly_packets")
        .select("user_id,week_starts_at")
        .in("status", ["approved", "active"])
        .lte("week_starts_at", observedAt)
        .gt("week_ends_at", observedAt)
        .order("week_starts_at", { ascending: true })
        .limit(Math.min(1000, limit * 10));
      if (error) {
        throw new Error(
          "SOCIAL_WEEKLY_OWNER_DISCOVERY_FAILED:" + error.message,
        );
      }
      const owners = [...new Set(
        (data ?? [])
          .map((row) => String(row.user_id ?? "").trim())
          .filter(Boolean),
      )];
      return owners.slice(0, limit);
    },

    async listDueActions({ ownerUserId, observedAt, limit = 100 }) {
      requireTimestamp(observedAt, "observedAt");
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
        throw new Error("SOCIAL_WEEKLY_DUE_LIMIT_INVALID");
      }

      const { data: packets, error: packetError } = await client
        .from("jhadina_social_weekly_packets")
        .select("id")
        .eq("user_id", ownerUserId)
        .in("status", ["approved", "active"]);
      if (packetError) {
        throw new Error(
          "SOCIAL_WEEKLY_PACKET_LIST_FAILED:" + packetError.message,
        );
      }
      const packetIds = (packets ?? []).map((row) => String(row.id));
      if (!packetIds.length) return [];

      const { data, error } = await client
        .from("jhadina_social_weekly_action_state")
        .select("*")
        .eq("user_id", ownerUserId)
        .in("packet_id", packetIds)
        .in("status", ["planned", "ready", "waiting"])
        .lte("scheduled_at", observedAt)
        .order("scheduled_at", { ascending: true })
        .limit(limit);
      if (error) {
        throw new Error(
          "SOCIAL_WEEKLY_DUE_ACTION_LIST_FAILED:" + error.message,
        );
      }
      return (data ?? []) as WeeklySocialActionStateRow[];
    },

    async updateActionState({
      ownerUserId,
      packetId,
      actionId,
      status,
      externalReceiptRefs = [],
      lastError,
    }) {
      const patch: Record<string, unknown> = {
        status,
        external_receipt_refs: [...new Set(externalReceiptRefs)],
        last_error: lastError?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (status === "running") {
        const { data: current, error: readError } = await client
          .from("jhadina_social_weekly_action_state")
          .select("attempt_count")
          .eq("user_id", ownerUserId)
          .eq("packet_id", packetId)
          .eq("action_id", actionId)
          .single();
        if (readError || !current) {
          throw new Error(
            "SOCIAL_WEEKLY_ACTION_STATE_NOT_FOUND:" + actionId,
          );
        }
        patch.attempt_count = Number(current.attempt_count ?? 0) + 1;
      }

      const { data, error } = await client
        .from("jhadina_social_weekly_action_state")
        .update(patch)
        .eq("user_id", ownerUserId)
        .eq("packet_id", packetId)
        .eq("action_id", actionId)
        .select("action_id")
        .single();
      if (error || !data) {
        throw new Error(
          "SOCIAL_WEEKLY_ACTION_STATE_UPDATE_FAILED:"
          + (error?.message ?? actionId),
        );
      }
    },

    async consume({
      permitId,
      ownerUserId,
      packetId,
      actionId,
      actionFingerprint,
      consumedAt,
    }) {
      requireTimestamp(consumedAt, "consumedAt");
      const { data, error } = await client.rpc(
        "jhadina_social_consume_weekly_permit",
        {
          p_user_id: ownerUserId,
          p_packet_id: packetId,
          p_permit_id: permitId,
          p_action_id: actionId,
          p_action_fingerprint: actionFingerprint,
          p_consumed_at: consumedAt,
        },
      );
      if (error) {
        throw new Error(
          "SOCIAL_WEEKLY_PERMIT_CONSUME_FAILED:" + error.message,
        );
      }
      return data === true;
    },

    async upsertEngagementTarget({ ownerUserId, target }) {
      const { error } = await client
        .from("jhadina_social_engagement_targets")
        .upsert(
          engagementTargetToRow(ownerUserId, target),
          { onConflict: "user_id,id" },
        );
      if (error) {
        throw new Error(
          "SOCIAL_ENGAGEMENT_TARGET_UPSERT_FAILED:" + error.message,
        );
      }
    },

    async listEngagementTargets({
      ownerUserId,
      brand,
      platform,
      activeOnly = false,
    }) {
      let query = client
        .from("jhadina_social_engagement_targets")
        .select("*")
        .eq("user_id", ownerUserId);
      if (brand) query = query.eq("brand", brand);
      if (platform) query = query.eq("platform", platform);
      if (activeOnly) query = query.eq("status", "active");

      const { data, error } = await query.order(
        "priority",
        { ascending: false },
      );
      if (error) {
        throw new Error(
          "SOCIAL_ENGAGEMENT_TARGET_LIST_FAILED:" + error.message,
        );
      }
      return (data ?? []).map(engagementTargetFromRow);
    },
  };
}

async function upsertPacket(
  client: SupabaseClient,
  input: {
    packet: WeeklySocialCampaignPacket
      | ApprovedWeeklySocialCampaignPacket;
    status: "pending_approval" | "approved";
    report?: WeeklyMarketingReport;
  },
): Promise<void> {
  const approvedPacket =
    input.status === "approved"
    && isApprovedWeeklyPacket(input.packet)
      ? input.packet
      : undefined;

  const { error } = await client
    .from("jhadina_social_weekly_packets")
    .upsert({
      user_id: input.packet.ownerUserId,
      id: input.packet.id,
      week_starts_at: input.packet.weekStartsAt,
      week_ends_at: input.packet.weekEndsAt,
      packet_fingerprint: input.packet.fingerprint,
      packet_payload: input.packet,
      report_payload: input.report ?? input.packet.report,
      status: input.status,
      approval_receipt_id: approvedPacket?.approvalReceiptId ?? null,
      approved_at: approvedPacket?.approvedAt ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,id",
    });
  if (error) {
    throw new Error(
      "SOCIAL_WEEKLY_PACKET_UPSERT_FAILED:" + error.message,
    );
  }
}

function isApprovedWeeklyPacket(
  packet: WeeklySocialCampaignPacket | ApprovedWeeklySocialCampaignPacket,
): packet is ApprovedWeeklySocialCampaignPacket {
  return "approvalReceiptId" in packet
    && "approvedAt" in packet
    && "approvedByUserId" in packet;
}

async function saveWeeklyReport(
  client: SupabaseClient,
  ownerUserId: string,
  packetId: string,
  report: WeeklyMarketingReport,
): Promise<void> {
  const { error } = await client
    .from("jhadina_social_weekly_reports")
    .upsert({
      user_id: ownerUserId,
      id: report.id,
      packet_id: packetId,
      report_payload: report,
      generated_at: report.generatedAt,
      evidence_refs: [...report.evidenceRefs],
    }, {
      onConflict: "user_id,id",
    });
  if (error) {
    throw new Error(
      "SOCIAL_WEEKLY_REPORT_UPSERT_FAILED:" + error.message,
    );
  }
}

function assertManifestMatchesPacket(
  packet: ApprovedWeeklySocialCampaignPacket,
  manifest: WeeklyDelegationManifest,
): void {
  if (
    manifest.packetId !== packet.id
    || manifest.ownerUserId !== packet.ownerUserId
    || manifest.parentApprovalReceiptId !== packet.approvalReceiptId
    || manifest.parentPacketFingerprint !== packet.fingerprint
    || manifest.permits.length !== packet.actions.length
  ) {
    throw new Error("SOCIAL_WEEKLY_RUNTIME_MANIFEST_MISMATCH");
  }
}

export function engagementTargetToRow(
  ownerUserId: string,
  target: SocialEngagementTargetAccount,
): Record<string, unknown> {
  return {
    user_id: ownerUserId,
    id: target.id,
    brand: target.brand,
    platform: target.platform,
    account_ref: target.accountRef,
    handle_or_label: target.handleOrLabel,
    source: target.source,
    status: target.status,
    priority: target.priority,
    topic_tags: [...target.topicTags],
    campaign_refs: [...target.campaignRefs],
    notes: target.notes ?? null,
    evidence_refs: [...target.evidenceRefs],
    added_at: target.addedAt,
    updated_at: new Date().toISOString(),
  };
}

export function engagementTargetFromRow(
  row: Record<string, unknown>,
): SocialEngagementTargetAccount {
  return Object.freeze({
    id: String(row.id),
    brand: String(row.brand) as SocialEngagementTargetAccount["brand"],
    platform: String(row.platform) as SocialEngagementTargetAccount["platform"],
    accountRef: String(row.account_ref),
    handleOrLabel: String(row.handle_or_label),
    source: String(row.source) as SocialEngagementTargetAccount["source"],
    status: String(row.status) as SocialEngagementTargetAccount["status"],
    priority: Number(row.priority),
    topicTags: Object.freeze(
      Array.isArray(row.topic_tags)
        ? row.topic_tags.map(String)
        : [],
    ),
    campaignRefs: Object.freeze(
      Array.isArray(row.campaign_refs)
        ? row.campaign_refs.map(String)
        : [],
    ),
    notes:
      typeof row.notes === "string" && row.notes.trim()
        ? row.notes
        : undefined,
    addedAt: String(row.added_at),
    evidenceRefs: Object.freeze(
      Array.isArray(row.evidence_refs)
        ? row.evidence_refs.map(String)
        : [],
    ),
    policy: Object.freeze({
      publicContentOnly: true as const,
      observeWithoutApproval: true as const,
      publicCommentRequiresWeeklyApproval: true as const,
      automaticDirectMessagesAllowed: false as const,
      automaticFollowUnfollowAllowed: false as const,
      massEngagementAllowed: false as const,
      ownerCuratedDoesNotBypassRelevance: true as const,
    }),
    authority: "ENGAGEMENT_TARGET_REGISTRY_ONLY" as const,
  });
}

function requireTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(
      "SOCIAL_WEEKLY_RUNTIME_TIME_INVALID:" + field,
    );
  }
}
