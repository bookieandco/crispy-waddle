import { createSharkObservation, type SharkObservation } from './observation.js'

export type SharkObservationInput = Omit<SharkObservation, 'id'> & { id?: string }

export interface SharkObservationSourceAdapter {
  readonly sourceId: string
  readonly source: SharkObservation['source']
  observe(): Promise<SharkObservationInput[]>
}

export type SharkObservationIngestionResult = {
  accepted: SharkObservation[]
  rejected: Array<{ input: SharkObservationInput; reason: string }>
}

/** Normalize observations from any source without granting the source execution authority. */
export async function ingestSharkObservations(
  adapters: SharkObservationSourceAdapter[],
): Promise<SharkObservationIngestionResult> {
  const accepted: SharkObservation[] = []
  const rejected: Array<{ input: SharkObservationInput; reason: string }> = []

  for (const adapter of adapters) {
    const inputs = await adapter.observe()
    for (const input of inputs) {
      try {
        accepted.push(createSharkObservation({
          ...input,
          sourceId: input.sourceId || adapter.sourceId,
          source: input.source || adapter.source,
        }))
      } catch (error) {
        rejected.push({ input, reason: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  return { accepted, rejected }
}
