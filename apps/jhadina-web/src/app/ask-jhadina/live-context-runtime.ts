import type { JhadinaConversationLine } from "./interactive-runtime"

export interface LiveContextWorkSessionInput {
  id: string
  goal?: string
  activeSubsystems: readonly string[]
  admittedArtifactIds: readonly string[]
}

export function buildLiveContext(
  conversationLines: readonly JhadinaConversationLine[],
  workSession?: LiveContextWorkSessionInput,
) {
  return {
    source: "ask-jhadina-live" as const,
    observedAt: new Date().toISOString(),
    recentTurns: conversationLines.slice(-8).map(({ id, speaker, text, createdAt }) => ({
      id,
      speaker,
      text,
      createdAt,
    })),
    ...(workSession ? {
      workSession: {
        id: workSession.id,
        ...(workSession.goal ? { goal: workSession.goal } : {}),
        activeSubsystems: [...workSession.activeSubsystems].slice(0, 16),
        admittedArtifactIds: [...workSession.admittedArtifactIds].slice(0, 8),
      },
    } : {}),
    limitations: [] as string[],
  }
}

export function isMeaningfulScreenChange(
  previous: Uint8Array | null,
  next: Uint8Array,
  meanAbsoluteThreshold = 7,
): boolean {
  if (!previous || previous.length !== next.length) return true
  if (next.length === 0) return false
  let total = 0
  for (let index = 0; index < next.length; index += 1) {
    total += Math.abs(next[index]! - previous[index]!)
  }
  return total / next.length >= meanAbsoluteThreshold
}


export interface RestoredWorkSessionContinuity {
  goal: string
  activeSubsystems: string[]
  admittedArtifactIds: string[]
}

export function restoreWorkSessionContinuity(session: unknown): RestoredWorkSessionContinuity {
  if (!session || typeof session !== "object") {
    return { goal: "", activeSubsystems: [], admittedArtifactIds: [] }
  }
  const raw=session as Record<string, unknown>
  const goal=typeof raw.goal==="string"?raw.goal:""
  const activeSubsystems=Array.isArray(raw.activeSubsystems)
    ? raw.activeSubsystems.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim())).slice(0,16)
    : []
  const admittedArtifactIds=Array.isArray(raw.artifactRefs)
    ? raw.artifactRefs
      .filter((item):item is {id:string;admitted?:boolean}=>Boolean(item&&typeof item==="object"&&typeof (item as {id?:unknown}).id==="string"))
      .filter((item)=>item.admitted!==false)
      .map((item)=>item.id)
      .slice(0,8)
    : []
  return { goal, activeSubsystems, admittedArtifactIds }
}
