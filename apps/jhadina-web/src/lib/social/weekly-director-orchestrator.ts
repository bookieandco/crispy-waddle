import type {
  ApprovedWeeklySocialCampaignPacket,
  ContentProject,
  WeeklyDirectorProductionAction,
} from "@jhadina/social-core";
import { buildDirectorBriefFromSocial } from "./director-bridge";

export interface WeeklyDirectorProjectBinding {
  actionId: string;
  contentProject: ContentProject;
  mediaType?: "image" | "video" | "motion";
  referenceAssetIds?: readonly string[];
  rightsEvidenceRefs?: readonly string[];
  aspectRatio?: string;
  targetRuntimeSeconds?: number;
}

export interface WeeklyDirectorQueueEntry {
  actionId: string;
  campaignId: string;
  requiredBy: string;
  socialContentProjectRef: string;
  socialAssetRef: string;
  directorProjectRef: string;
  brief: ReturnType<typeof buildDirectorBriefFromSocial>;
  weeklyApprovalReceiptId: string;
  weeklyApprovalFingerprint: string;
  authority: "DIRECTOR_PRODUCTION_QUEUE_ONLY";
  publicationAuthority: "NONE";
}

export function compileApprovedWeeklyDirectorQueue(input: {
  packet: ApprovedWeeklySocialCampaignPacket;
  bindings: readonly WeeklyDirectorProjectBinding[];
}): readonly WeeklyDirectorQueueEntry[] {
  const bindings = new Map(input.bindings.map((binding) => [binding.actionId, binding]));

  return Object.freeze(
    input.packet.actions
      .filter((action): action is WeeklyDirectorProductionAction =>
        action.kind === "director_production")
      .map((action) => {
        const binding = bindings.get(action.id);
        if (!binding) {
          throw new Error("SOCIAL_WEEKLY_DIRECTOR_BINDING_REQUIRED");
        }
        if (binding.contentProject.id !== action.socialContentProjectRef) {
          throw new Error("SOCIAL_WEEKLY_DIRECTOR_PROJECT_MISMATCH");
        }
        if (
          binding.contentProject.characterProfileRef
          !== action.profile.characterProfileRef
          || binding.contentProject.voiceProfileRef
          !== action.profile.voiceProfileRef
          || (binding.contentProject.speakerIdentityRef ?? "")
          !== (action.profile.speakerIdentityRef ?? "")
        ) {
          throw new Error("SOCIAL_WEEKLY_DIRECTOR_PROFILE_MISMATCH");
        }

        const brief = buildDirectorBriefFromSocial(
          binding.contentProject,
          action.socialAssetRef,
          {
            directorProjectId: action.directorProjectRef,
            mediaType: binding.mediaType,
            referenceAssetIds: binding.referenceAssetIds,
            rightsEvidenceRefs: binding.rightsEvidenceRefs,
            aspectRatio: binding.aspectRatio,
            targetRuntimeSeconds: binding.targetRuntimeSeconds,
          },
        );

        if (brief.id !== action.productionBriefRef) {
          throw new Error("SOCIAL_WEEKLY_DIRECTOR_BRIEF_FINGERPRINT_MISMATCH");
        }

        return Object.freeze({
          actionId: action.id,
          campaignId: action.campaignId,
          requiredBy: action.requiredBy,
          socialContentProjectRef: action.socialContentProjectRef,
          socialAssetRef: action.socialAssetRef,
          directorProjectRef: action.directorProjectRef,
          brief,
          weeklyApprovalReceiptId: input.packet.approvalReceiptId,
          weeklyApprovalFingerprint: input.packet.approvedFingerprint,
          authority: "DIRECTOR_PRODUCTION_QUEUE_ONLY" as const,
          publicationAuthority: "NONE" as const,
        });
      }),
  );
}
