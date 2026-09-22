import { NextRequest, NextResponse } from "next/server"
import {
  compileDirectorSocialTakeRequest,
  type ContinuityLock,
} from "@jhadina/director-core"
import type { ContentProject } from "@jhadina/social-core"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { buildDirectorBriefFromSocial } from "@/lib/social/director-bridge"

export const dynamic = "force-dynamic"

type Body = {
  project?: ContentProject
  assetId?: string
  director?: {
    projectId?: string
    storyboardBoardId?: string
    sceneId?: string
    aspectRatio?: string
    targetRuntimeSeconds?: number
    referenceAssetIds?: string[]
    rightsEvidenceRefs?: string[]
    continuityLocks?: ContinuityLock[]
    commercialCreative?: {
      conceptId: string
      productBibleId: string
      styleBibleId: string
      multiplierVariantId?: string
      experimentId?: string
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRequestIdentity()
    const body = await req.json() as Body
    if (
      !body.project ||
      !body.assetId ||
      !body.director?.projectId ||
      !body.director.storyboardBoardId ||
      !body.director.sceneId
    ) {
      return NextResponse.json({
        success: false,
        error: "project, assetId, director.projectId, storyboardBoardId, and sceneId are required",
      }, { status: 400 })
    }

    const brief = buildDirectorBriefFromSocial(body.project, body.assetId, {
      directorProjectId: body.director.projectId,
      aspectRatio: body.director.aspectRatio,
      targetRuntimeSeconds: body.director.targetRuntimeSeconds,
      referenceAssetIds: body.director.referenceAssetIds,
      rightsEvidenceRefs: body.director.rightsEvidenceRefs,
      commercialCreative: body.director.commercialCreative,
    })

    const take = compileDirectorSocialTakeRequest(brief, {
      storyboardBoardId: body.director.storyboardBoardId,
      sceneId: body.director.sceneId,
      continuityLocks: body.director.continuityLocks,
    })

    return NextResponse.json({
      success: true,
      data: {
        brief,
        take,
        directorExecutionBoundary: "/api/director/generation/takes",
        executionAuthority: "DIRECTOR_ONLY",
        publicationAuthority: "NONE",
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare Director handoff"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
