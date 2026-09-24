const PERSONAL_CONTEXT_PATTERNS: readonly RegExp[] = [
  /\b(use|using|consider|based on|given)\b.{0,60}\b(what you know|my history|my preferences?|my goals?|my style|my personality|my past|my memories?|what you remember)\b/i,
  /\b(what you know|what you remember)\b.{0,60}\b(about me|about my)\b/i,
  /\b(my history|my preferences?|my goals?|my style|my personality|my memories?)\b.{0,60}\b(which|what|recommend|should|priority|prioritize)\b/i,
  /\b(which|what)\b.{0,50}\b(best for me|fits me|matches me)\b/i,
  /\bwhat do i usually\b/i,
  /\brecommend\b.{0,80}\b(for me|based on|using my|given my)\b/i,
]

const SPATIAL_CONTEXT_PATTERNS: readonly RegExp[] = [
  /\b(god['’]?s eye view|gev|spatial intelligence|spatial context)\b/i,
  /\b(near me|nearby|around me|my location|current location|where i am|where am i)\b/i,
  /\b(cameras?|cctv|onvif|rtsp|frigate|camera\s+specs?|camera\s+models?|traffic|aircraft|flights?|planes?|vessels?|ships?|boats?|wildfires?|fires?|earthquakes?|quakes?|satellites?|harbors?|ports?)\b/i,
  /\b(what(?:'s| is) happening|what(?:'s| is) going on)\b.{0,60}\b(near|around|within|at|in)\b/i,
  /\b(near|around|within|inside)\b.{0,80}\b(airport|stadium|venue|port|harbor|road|highway|city|county|address|facility)\b/i,
]

export function requiresSpatialContextForRead(activeTask: string): boolean {
  const normalized = activeTask.trim()
  if (!normalized) return false
  return SPATIAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized))
}

const DEVICE_LOCATION_PATTERNS: readonly RegExp[] = [
  /\b(near me|around me|around here|near here|in my area|my location|current location|where i am|where am i)\b/i,
  /\b(what(?:'s| is) happening|what(?:'s| is) going on)\b.{0,40}\b(here|nearby)\b/i,
  /\b(flights?|aircraft|planes?|traffic|cameras?|cctv|fires?|wildfires?|ships?|vessels?)\b.{0,40}\b(nearby|around here|near me)\b/i,
  /\bnearby\b.{0,40}\b(flights?|aircraft|planes?|traffic|cameras?|cctv|fires?|wildfires?|ships?|vessels?)\b/i,
]

/** True only for spatial reads whose scope is explicitly relative to the user's device location. */
export function requiresDeviceLocationForSpatialRead(activeTask: string): boolean {
  const normalized = activeTask.trim()
  if (!normalized) return false
  return requiresSpatialContextForRead(normalized)
    && DEVICE_LOCATION_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * True when a read/analysis answer needs canonical JLLM context rather than a
 * narrow deterministic subsystem shortcut.
 *
 * This includes explicit personal/history context and spatial/GEV context. The
 * latter is important because the canonical Context Builder is the governed
 * entry point that can attach GEV-backed SpatialContext to Ask Jhadina.
 *
 * Callers must still decide whether the matched subsystem operation is read-only.
 * This function alone never routes mutating or consequential work through a model.
 */
export function requiresFullJllmContextForRead(activeTask: string): boolean {
  const normalized = activeTask.trim()
  if (!normalized) return false
  return PERSONAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized))
    || requiresSpatialContextForRead(normalized)
}
