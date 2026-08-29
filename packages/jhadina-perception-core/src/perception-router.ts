import type { PerceptionEvent, PerceptionObservation, PerceptionPrivacyPort, PerceptionProvider } from "./perception-contract";

export class PerceptionRouter {
  constructor(
    private readonly providers: PerceptionProvider[],
    private readonly privacy: PerceptionPrivacyPort,
  ) {}

  async observe(event: PerceptionEvent): Promise<PerceptionObservation> {
    if (!this.privacy.isAllowed(event)) {
      throw new Error("Perception blocked by privacy policy.");
    }

    const provider = this.providers.find((candidate) => candidate.supports(event.source.modality));
    if (!provider) {
      throw new Error(`No perception provider supports ${event.source.modality}.`);
    }

    return provider.observe(event);
  }
}
