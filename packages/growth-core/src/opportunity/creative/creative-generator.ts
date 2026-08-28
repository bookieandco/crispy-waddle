import type { CreativeBrief } from './opportunity-to-creative-dna.js'
import type { CreativeBody, CreativeCTA, CreativeDNA, CreativeHook } from './creative-dna.js'

export type CreativeGenerationRequest = CreativeBrief & {
  hookCount: number
  bodyCount: number
  ctaCount: number
}

export type CreativeGenerationProvider = {
  generate(request: CreativeGenerationRequest): Promise<Pick<CreativeDNA, 'hooks' | 'bodies' | 'ctas'>>
}

export function buildCreativeGenerationRequest(
  brief: CreativeBrief,
  counts: Partial<Pick<CreativeGenerationRequest, 'hookCount' | 'bodyCount' | 'ctaCount'>> = {},
): CreativeGenerationRequest {
  return {
    ...brief,
    hookCount: counts.hookCount ?? 5,
    bodyCount: counts.bodyCount ?? 3,
    ctaCount: counts.ctaCount ?? 2,
  }
}

export function validateGeneratedCreatives(
  generated: Pick<CreativeDNA, 'hooks' | 'bodies' | 'ctas'>,
  request: CreativeGenerationRequest,
): void {
  if (generated.hooks.length !== request.hookCount) throw new Error('creative_generator_invalid_hook_count')
  if (generated.bodies.length !== request.bodyCount) throw new Error('creative_generator_invalid_body_count')
  if (generated.ctas.length !== request.ctaCount) throw new Error('creative_generator_invalid_cta_count')
  if ([...generated.hooks, ...generated.bodies, ...generated.ctas].some((item) => !item)) {
    throw new Error('creative_generator_empty_variant')
  }
}

export type { CreativeHook, CreativeBody, CreativeCTA }
