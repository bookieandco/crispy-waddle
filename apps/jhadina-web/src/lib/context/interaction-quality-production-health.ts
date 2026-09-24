import {
  certifyInteractionQuality,
  type InteractionQualityCertification,
} from "@jhadina/core-spine"
import { INTERACTION_QUALITY_SYSTEM_RULES } from "@jhadina/intelligence-core"

export interface InteractionQualityProductionHealth {
  status: "READY" | "DEGRADED"
  contractVersion: "JHADINA-INTERACTION-QUALITY.FINAL"
  commitSha: string | null
  environment: string | null
  modelGuidanceRules: number
  certification: InteractionQualityCertification
}

export function checkInteractionQualityProductionHealth(): InteractionQualityProductionHealth {
  const certification = certifyInteractionQuality()
  const modelGuidanceRules = INTERACTION_QUALITY_SYSTEM_RULES.length
  const ready =
    certification.status === "READY" &&
    certification.gates.every((gate) => gate.ready) &&
    modelGuidanceRules >= 15

  return {
    status: ready ? "READY" : "DEGRADED",
    contractVersion: "JHADINA-INTERACTION-QUALITY.FINAL",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    environment: process.env.VERCEL_ENV ?? null,
    modelGuidanceRules,
    certification,
  }
}
