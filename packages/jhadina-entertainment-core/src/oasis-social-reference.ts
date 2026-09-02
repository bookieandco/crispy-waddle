/** OASIS-inspired social simulation boundary. OASIS remains an external research/simulation dependency. */
export interface SocialSimulationRequest {
  scenario: string;
  agentCount: number;
  platform: 'twitter' | 'reddit' | 'custom';
  acceleratedSteps?: number;
}

export interface SocialSimulationResult {
  scenario: string;
  reactions: Array<{ type: string; count: number; rate: number }>;
  discoveredReferences: string[];
  voiceSignals: string[];
}

export interface SocialSimulationAdapter {
  run(request: SocialSimulationRequest): Promise<SocialSimulationResult>;
}
