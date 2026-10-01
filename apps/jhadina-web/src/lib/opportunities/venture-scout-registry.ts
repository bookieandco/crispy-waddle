import type {
  Opportunity,
  VentureRuntimeState,
  VentureScoutBatch,
} from '@jhadina/opportunity-core'
import type { VentureMarketScout } from './venture-runtime'

export type VentureScoutSourceKind =
  | 'marketplace'
  | 'search_trend'
  | 'social_trend'
  | 'creator_marketplace'
  | 'affiliate'
  | 'software_market'
  | 'digital_asset_market'
  | 'public_procurement'
  | 'other'

export type VentureScoutDescriptor = {
  id: string
  label: string
  sourceKind: VentureScoutSourceKind
  enabled: boolean
  maxSignalsPerRun: number
  maxRuntimeMs: number
  readOnly: true
}

export type RegisteredVentureScout = {
  descriptor: VentureScoutDescriptor
  scout: VentureMarketScout
}

export class VentureScoutRegistry {
  private readonly scouts = new Map<string, RegisteredVentureScout>()

  register(input: RegisteredVentureScout): void {
    validateDescriptor(input.descriptor)
    if (input.descriptor.id !== input.scout.id) {
      throw new Error('Venture scout descriptor id must match scout id')
    }
    if (this.scouts.has(input.descriptor.id)) {
      throw new Error('Venture scout already registered: ' + input.descriptor.id)
    }
    this.scouts.set(input.descriptor.id, input)
  }

  list(): VentureScoutDescriptor[] {
    return [...this.scouts.values()]
      .map(({ descriptor }) => ({ ...descriptor }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  enabled(): VentureMarketScout[] {
    return [...this.scouts.values()]
      .filter(({ descriptor }) => descriptor.enabled)
      .sort((a, b) => a.descriptor.id.localeCompare(b.descriptor.id))
      .map(({ scout }) => scout)
  }

  get(id: string): RegisteredVentureScout | undefined {
    const value = this.scouts.get(id)
    return value ? { descriptor: { ...value.descriptor }, scout: value.scout } : undefined
  }
}

export function createReadOnlyVentureScout(input: {
  descriptor: VentureScoutDescriptor
  scan: (input: {
    opportunity: Opportunity
    state?: VentureRuntimeState
    capturedAt: string
    signalLimit: number
  }) => Promise<Omit<VentureScoutBatch, 'scoutId' | 'capturedAt' | 'externalMutationPerformed'>>
}): RegisteredVentureScout {
  validateDescriptor(input.descriptor)
  const scout: VentureMarketScout = {
    id: input.descriptor.id,
    async scan(context) {
      const started = Date.now()
      const result = await input.scan({
        ...context,
        signalLimit: input.descriptor.maxSignalsPerRun,
      })
      const elapsed = Date.now() - started
      if (elapsed > input.descriptor.maxRuntimeMs) {
        throw new Error('Venture scout exceeded maxRuntimeMs: ' + input.descriptor.id)
      }
      if (result.signals.length > input.descriptor.maxSignalsPerRun) {
        throw new Error('Venture scout exceeded maxSignalsPerRun: ' + input.descriptor.id)
      }
      return {
        scoutId: input.descriptor.id,
        source: result.source,
        capturedAt: context.capturedAt,
        signals: result.signals,
        evidenceRefs: result.evidenceRefs,
        externalMutationPerformed: false,
      }
    },
  }
  return { descriptor: { ...input.descriptor }, scout }
}

function validateDescriptor(descriptor: VentureScoutDescriptor): void {
  if (!descriptor.id.trim()) throw new Error('Venture scout descriptor id is required')
  if (!descriptor.label.trim()) throw new Error('Venture scout descriptor label is required')
  if (descriptor.readOnly !== true) throw new Error('Venture market scouts must be read-only')
  if (!Number.isInteger(descriptor.maxSignalsPerRun) || descriptor.maxSignalsPerRun < 1 || descriptor.maxSignalsPerRun > 500) {
    throw new Error('Venture scout maxSignalsPerRun must be between 1 and 500')
  }
  if (!Number.isInteger(descriptor.maxRuntimeMs) || descriptor.maxRuntimeMs < 100 || descriptor.maxRuntimeMs > 300_000) {
    throw new Error('Venture scout maxRuntimeMs must be between 100 and 300000')
  }
}
