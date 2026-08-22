import { NextRequest, NextResponse } from "next/server"
import { type DispatcherContext } from "@jhadina/truckeros-core"
import { getTruckerOS } from "../composition"

const MAX_MESSAGE_LENGTH = 2000
const MAX_LOADS = 25

class DispatcherValidationError extends Error {}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DispatcherValidationError(`${field} is required and must be a non-empty string`)
  }
  return value
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DispatcherValidationError(`${field} is required and must be a finite number`)
  }
  return value
}

export async function handlePostDispatcherFromProvider(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new DispatcherValidationError("Request body must be valid JSON")
    })

    const message = requireString(body?.message, "message")
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new DispatcherValidationError(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer`)
    }

    const rawContext = body?.context
    if (typeof rawContext !== "object" || rawContext === null) {
      throw new DispatcherValidationError("context is required and must be an object")
    }

    const minimumNetCentsPerMile = requireFiniteNumber(
      rawContext.minimumNetCentsPerMile,
      "context.minimumNetCentsPerMile"
    )
    const targetNetCentsPerMile = requireFiniteNumber(
      rawContext.targetNetCentsPerMile,
      "context.targetNetCentsPerMile"
    )
    if (targetNetCentsPerMile < minimumNetCentsPerMile) {
      throw new DispatcherValidationError(
        "context.targetNetCentsPerMile must be greater than or equal to context.minimumNetCentsPerMile"
      )
    }

    const { driverRepo, loadProvider, dispatcherService, dispatcherReasoner, auditService } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    const destinationHint = typeof rawContext.destinationHint === "string" ? rawContext.destinationHint : null
    const loads = await loadProvider.search({
      origin: driver.currentLocation,
      destinationHint,
      maxResults: MAX_LOADS,
    })

    if (loads.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          brief: {
            recommendation: "decline",
            headline: "No load opportunities were found.",
            candidates: [],
            warnings: ["The configured load provider returned no candidates."],
          },
          explanation: "I couldn't find a load to evaluate from the current provider.",
          safety: {
            aiRole: "advisory",
            economicsSource: "deterministic",
            executionAllowed: false,
            requiresDriverApproval: true,
          },
        },
      })
    }

    const dispatcherContext: DispatcherContext = {
      driver,
      currentLocation: driver.currentLocation,
      loads,
      minimumNetCentsPerMile,
      targetNetCentsPerMile,
    }

    const brief = dispatcherService.brief(dispatcherContext)
    const explanation = await dispatcherReasoner.explain(brief, message)

    await auditService.record({
      actorType: "api_gateway",
      actorId: driver.id,
      eventName: "dispatcher.brief_requested",
      payload: {
        message,
        loadCount: loads.length,
        recommendation: brief.recommendation,
        topLoadId: brief.candidates[0]?.load.id ?? null,
        minimumNetCentsPerMile,
        targetNetCentsPerMile,
        loadProvider: "mock_offline",
      },
      triggeredBy: "driver_action:dispatcher_query",
      driverApproved: null,
    })

    return NextResponse.json({
      success: true,
      data: {
        brief,
        explanation,
        safety: {
          aiRole: "advisory",
          economicsSource: "deterministic",
          executionAllowed: false,
          requiresDriverApproval: true,
        },
      },
    })
  } catch (error) {
    if (error instanceof DispatcherValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[truckeros-web] ${message}`)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
