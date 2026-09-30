import type { MusicCampaignState } from './domain.js';

const ALLOWED: Readonly<Record<MusicCampaignState, readonly MusicCampaignState[]>> = Object.freeze({
  INGESTED: ['EXPLORING', 'CATALOG_HOLD'],
  EXPLORING: ['EARLY_SIGNAL', 'REPACKAGE', 'CAPITAL_STOP', 'CATALOG_HOLD'],
  EARLY_SIGNAL: ['VALIDATING', 'REPACKAGE', 'CAPITAL_STOP'],
  VALIDATING: ['PROVEN', 'REPACKAGE', 'CAPITAL_STOP'],
  PROVEN: ['SCALING', 'STEADY_STATE', 'CAPITAL_STOP'],
  SCALING: ['STEADY_STATE', 'CAPITAL_STOP'],
  STEADY_STATE: ['SCALING', 'CATALOG_HOLD', 'CAPITAL_STOP'],
  REPACKAGE: ['EXPLORING', 'CAPITAL_STOP', 'CATALOG_HOLD'],
  CAPITAL_STOP: ['REPACKAGE', 'CATALOG_HOLD', 'RESURRECTED'],
  CATALOG_HOLD: ['RESURRECTED', 'EXPLORING'],
  RESURRECTED: ['EXPLORING', 'EARLY_SIGNAL'],
});

export function canTransitionMusicCampaign(from: MusicCampaignState, to: MusicCampaignState): boolean {
  return ALLOWED[from].includes(to);
}

export function transitionMusicCampaign(from: MusicCampaignState, to: MusicCampaignState): MusicCampaignState {
  if (!canTransitionMusicCampaign(from, to)) {
    throw new Error('MUSIC_JUGGERNAUT_ILLEGAL_STATE_TRANSITION');
  }
  return to;
}
