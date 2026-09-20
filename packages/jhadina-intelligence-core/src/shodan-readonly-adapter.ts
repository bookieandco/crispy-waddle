import { createObservationEnvelope, type ObservationEnvelope } from './observation.js'

export const SHODAN_READ_CAPABILITIES = ['host.read', 'internetdb.read', 'dns.read', 'search.read', 'history.read'] as const
export type ShodanReadCapability = typeof SHODAN_READ_CAPABILITIES[number]

export type ShodanTransport = {
  read(capability: ShodanReadCapability, subject: string): Promise<unknown>
}

export type ShodanObservation = {
  capability: ShodanReadCapability
  record: unknown
}

function assertReadCapability(capability: string): asserts capability is ShodanReadCapability {
  if (!(SHODAN_READ_CAPABILITIES as readonly string[]).includes(capability)) {
    throw new Error('SHODAN_CAPABILITY_NOT_READ_ONLY')
  }
}

export class ShodanReadOnlyAdapter {
  readonly provider = 'shodan'
  readonly adapterVersion = '1'

  constructor(private readonly transport: ShodanTransport) {}

  async observe(input: {
    observationId: string
    subjectId: string
    capability: string
    observedAt: string
    receivedAt?: string
    evidenceRefs?: readonly string[]
  }): Promise<ObservationEnvelope<ShodanObservation>> {
    assertReadCapability(input.capability)
    const receivedAt = input.receivedAt ?? new Date().toISOString()
    const record = await this.transport.read(input.capability, input.subjectId)

    return createObservationEnvelope({
      observationId: input.observationId,
      subjectId: input.subjectId,
      source: {
        provider: this.provider,
        capability: input.capability,
        adapterVersion: this.adapterVersion,
        sourceRef: `shodan:${input.capability}:${input.subjectId}`,
      },
      provenance: {
        observedAt: input.observedAt,
        receivedAt,
        retrievedAt: receivedAt,
        evidenceRefs: [...(input.evidenceRefs ?? [`shodan:${input.capability}:${input.subjectId}`])],
      },
      payload: { capability: input.capability, record },
      limitations: {
        freshness: input.capability === 'history.read' ? 'historical' : 'unknown',
        limitations: ['Third-party passive observation; not independently verified.', 'Observation does not establish identity, trust, authorization, or current world state.'],
      },
    })
  }

  async execute(_operation: string): Promise<never> {
    throw new Error('SHODAN_MUTATION_UNSUPPORTED')
  }
}
