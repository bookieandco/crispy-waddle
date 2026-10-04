export type DirectorProductionArchetype =
  | 'explainer'
  | 'product_demo'
  | 'testimonial'
  | 'talking_head_enhancement'
  | 'data_story'
  | 'ugc_ad'
  | 'faceless_youtube'
  | 'short_film'
  | 'film'

export type DirectorProductionArchetypeProfile = {
  archetype: DirectorProductionArchetype
  requiredSourceKinds: readonly string[]
  optionalSourceKinds: readonly string[]
  requiredStages: readonly (
    | 'research'
    | 'script'
    | 'storyboard'
    | 'rights'
    | 'rehearsal'
    | 'generation'
    | 'edit'
    | 'frame_qc'
    | 'review'
    | 'delivery'
  )[]
  requiredCapabilities: readonly string[]
  publicationAuthority: 'NONE'
}

export type DirectorArchetypePlan = {
  id: string
  projectId: string
  archetype: DirectorProductionArchetype
  profile: DirectorProductionArchetypeProfile
  sourceRefs: readonly string[]
  rightsEvidenceRefs: readonly string[]
  createdAt: string
  authority: 'PLANNING_ONLY'
  publicationAuthority: 'NONE'
}

const PROFILES: Readonly<Record<DirectorProductionArchetype, DirectorProductionArchetypeProfile>> = Object.freeze({
  explainer: profile('explainer', ['topic-evidence'], ['brand-assets', 'music'], ['research','script','storyboard','rights','generation','edit','frame_qc','review','delivery'], ['storyboard','motion-graphics','timeline-editing','media-qc']),
  product_demo: profile('product_demo', ['product-source'], ['website-screenshots','product-images','social-proof'], ['research','script','storyboard','rights','generation','edit','frame_qc','review','delivery'], ['product-reference','browser-observation','motion-graphics','timeline-editing','media-qc']),
  testimonial: profile('testimonial', ['testimonial-evidence'], ['business-profile','brand-assets'], ['research','script','storyboard','rights','generation','edit','frame_qc','review','delivery'], ['evidence-provenance','motion-graphics','timeline-editing','media-qc']),
  talking_head_enhancement: profile('talking_head_enhancement', ['source-video'], ['transcript','screenshots','b-roll'], ['research','script','storyboard','rights','edit','frame_qc','review','delivery'], ['transcript-timecode','protected-region-layout','timeline-editing','media-qc']),
  data_story: profile('data_story', ['dataset-evidence'], ['research-paper','brand-assets','music'], ['research','script','storyboard','rights','generation','edit','frame_qc','review','delivery'], ['data-visualization','evidence-provenance','motion-graphics','timeline-editing','media-qc']),
  ugc_ad: profile('ugc_ad', ['product-evidence'], ['creator-reference','location-reference','script'], ['research','script','storyboard','rights','rehearsal','generation','edit','frame_qc','review','delivery'], ['product-reference','performance-master','generation','timeline-editing','media-qc']),
  faceless_youtube: profile('faceless_youtube', ['topic-evidence'], ['brand-assets','music','b-roll','data-sources'], ['research','script','storyboard','rights','generation','edit','frame_qc','review','delivery'], ['narration','b-roll','motion-graphics','timeline-editing','media-qc']),
  short_film: profile('short_film', ['script-evidence'], ['cast','world','props','music'], ['research','script','storyboard','rights','rehearsal','generation','edit','frame_qc','review','delivery'], ['storyboard','continuity','performance-master','generation','timeline-editing','media-qc']),
  film: profile('film', ['script-evidence'], ['cast','world','props','music'], ['research','script','storyboard','rights','rehearsal','generation','edit','frame_qc','review','delivery'], ['storyboard','continuity','longform-dialogue','performance-master','generation','timeline-editing','media-qc']),
})

export function directorProductionArchetypeProfile(
  archetype: DirectorProductionArchetype,
): DirectorProductionArchetypeProfile {
  const found = PROFILES[archetype]
  if (!found) throw new Error('DIRECTOR_PRODUCTION_ARCHETYPE_UNKNOWN')
  return found
}

export function createDirectorArchetypePlan(input: {
  id: string
  projectId: string
  archetype: DirectorProductionArchetype
  sourceRefs: readonly string[]
  rightsEvidenceRefs: readonly string[]
  createdAt: string
}): DirectorArchetypePlan {
  requireText(input.id, 'DIRECTOR_ARCHETYPE_PLAN_ID_REQUIRED')
  requireText(input.projectId, 'DIRECTOR_ARCHETYPE_PROJECT_ID_REQUIRED')
  if (!input.sourceRefs.length || input.sourceRefs.some((value) => !value.trim())) {
    throw new Error('DIRECTOR_ARCHETYPE_SOURCE_REQUIRED')
  }
  if (!input.rightsEvidenceRefs.length || input.rightsEvidenceRefs.some((value) => !value.trim())) {
    throw new Error('DIRECTOR_ARCHETYPE_RIGHTS_REQUIRED')
  }
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('DIRECTOR_ARCHETYPE_DATE_INVALID')

  return Object.freeze({
    id: input.id.trim(),
    projectId: input.projectId.trim(),
    archetype: input.archetype,
    profile: directorProductionArchetypeProfile(input.archetype),
    sourceRefs: Object.freeze(unique(input.sourceRefs)),
    rightsEvidenceRefs: Object.freeze(unique(input.rightsEvidenceRefs)),
    createdAt: input.createdAt,
    authority: 'PLANNING_ONLY',
    publicationAuthority: 'NONE',
  })
}

function profile(
  archetype: DirectorProductionArchetype,
  requiredSourceKinds: readonly string[],
  optionalSourceKinds: readonly string[],
  requiredStages: DirectorProductionArchetypeProfile['requiredStages'],
  requiredCapabilities: readonly string[],
): DirectorProductionArchetypeProfile {
  return Object.freeze({
    archetype,
    requiredSourceKinds: Object.freeze([...requiredSourceKinds]),
    optionalSourceKinds: Object.freeze([...optionalSourceKinds]),
    requiredStages: Object.freeze([...requiredStages]),
    requiredCapabilities: Object.freeze([...requiredCapabilities]),
    publicationAuthority: 'NONE',
  })
}

function requireText(value: string, code: string): void {
  if (!value?.trim()) throw new Error(code)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
