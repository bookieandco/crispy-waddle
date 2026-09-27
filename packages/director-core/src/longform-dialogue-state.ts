export type LongformDialogueTurnKind = 'line' | 'continue' | 'interrupt' | 'overlap' | 'reaction';
export type LongformDialogueGesture = 'none' | 'minor' | 'major';

export interface DialogueCastBinding {
  characterId: string;
  voiceIdentityId: string;
  positionLabel?: string;
}

export interface LongformDialogueTurn {
  id: string;
  segmentIndex: number;
  order: number;
  kind: LongformDialogueTurnKind;
  characterId: string;
  voiceIdentityId: string;
  lineId?: string;
  text?: string;
  listenerCharacterIds: readonly string[];
  gesture: LongformDialogueGesture;
  evidenceIds: readonly string[];
}

export interface LongformDialogueSegment {
  id: string;
  index: number;
  visualAnchorAssetId: string;
  turnIds: readonly string[];
  previousSegmentId?: string;
  evidenceIds: readonly string[];
}

export interface LongformDialogueState {
  id: string;
  projectId: string;
  sceneId: string;
  cast: readonly DialogueCastBinding[];
  turns: readonly LongformDialogueTurn[];
  segments: readonly LongformDialogueSegment[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_LONGFORM_DIALOGUE_STATE';
}

export interface DialogueSegmentContinuityPacket {
  stateId: string;
  projectId: string;
  sceneId: string;
  segmentId: string;
  segmentIndex: number;
  previousSegmentId?: string;
  cast: readonly DialogueCastBinding[];
  turns: readonly LongformDialogueTurn[];
  previousLastSpeakerCharacterId?: string;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_DIALOGUE_SEGMENT_CONTINUITY';
}

export function validateLongformDialogueState(state: LongformDialogueState): readonly string[] {
  const reasons: string[] = [];
  if (!state.id.trim() || !state.projectId.trim() || !state.sceneId.trim()) {
    reasons.push('DIRECTOR_DIALOGUE_STATE_IDENTITY_REQUIRED');
  }
  if (state.cast.length < 2) reasons.push('DIRECTOR_DIALOGUE_STATE_MULTI_CHARACTER_REQUIRED');
  if (!state.evidenceIds.length) reasons.push('DIRECTOR_DIALOGUE_STATE_EVIDENCE_REQUIRED');

  const castByCharacter = new Map<string, DialogueCastBinding>();
  const voiceOwners = new Map<string, string>();
  for (const binding of state.cast) {
    if (!binding.characterId.trim() || !binding.voiceIdentityId.trim() || castByCharacter.has(binding.characterId)) {
      reasons.push(`DIRECTOR_DIALOGUE_CAST_INVALID:${binding.characterId || 'unknown'}`);
      continue;
    }
    const existingOwner = voiceOwners.get(binding.voiceIdentityId);
    if (existingOwner && existingOwner !== binding.characterId) {
      reasons.push(`DIRECTOR_DIALOGUE_VOICE_SHARED:${binding.voiceIdentityId}`);
    }
    castByCharacter.set(binding.characterId, binding);
    voiceOwners.set(binding.voiceIdentityId, binding.characterId);
  }

  const turnById = new Map<string, LongformDialogueTurn>();
  for (const turn of state.turns) {
    if (!turn.id.trim() || turnById.has(turn.id)) reasons.push(`DIRECTOR_DIALOGUE_TURN_ID_INVALID:${turn.id || 'unknown'}`);
    turnById.set(turn.id, turn);
    const cast = castByCharacter.get(turn.characterId);
    if (!cast) reasons.push(`DIRECTOR_DIALOGUE_TURN_CHARACTER_UNKNOWN:${turn.id}`);
    else if (cast.voiceIdentityId !== turn.voiceIdentityId) reasons.push(`DIRECTOR_DIALOGUE_TURN_VOICE_CROSSOVER:${turn.id}`);
    if (!Number.isInteger(turn.segmentIndex) || turn.segmentIndex < 0 || !Number.isInteger(turn.order) || turn.order < 0) {
      reasons.push(`DIRECTOR_DIALOGUE_TURN_POSITION_INVALID:${turn.id}`);
    }
    if (turn.kind !== 'reaction' && !turn.text?.trim()) reasons.push(`DIRECTOR_DIALOGUE_TURN_TEXT_REQUIRED:${turn.id}`);
    if (turn.kind === 'reaction' && turn.text?.trim()) reasons.push(`DIRECTOR_DIALOGUE_REACTION_TEXT_UNEXPECTED:${turn.id}`);
    if (!turn.evidenceIds.length) reasons.push(`DIRECTOR_DIALOGUE_TURN_EVIDENCE_REQUIRED:${turn.id}`);
    for (const listenerId of turn.listenerCharacterIds) {
      if (!castByCharacter.has(listenerId) || listenerId === turn.characterId) {
        reasons.push(`DIRECTOR_DIALOGUE_LISTENER_INVALID:${turn.id}:${listenerId}`);
      }
    }
  }

  const orderedSegments = [...state.segments].sort((a, b) => a.index - b.index);
  const usedTurnIds = new Set<string>();
  for (let i = 0; i < orderedSegments.length; i += 1) {
    const segment = orderedSegments[i]!;
    if (!segment.id.trim() || segment.index !== i) reasons.push(`DIRECTOR_DIALOGUE_SEGMENT_INDEX_INVALID:${segment.id || i}`);
    const expectedPrevious = i > 0 ? orderedSegments[i - 1]!.id : undefined;
    if (segment.previousSegmentId !== expectedPrevious) reasons.push(`DIRECTOR_DIALOGUE_SEGMENT_CHAIN_INVALID:${segment.id}`);
    if (!segment.visualAnchorAssetId.trim()) reasons.push(`DIRECTOR_DIALOGUE_SEGMENT_ANCHOR_REQUIRED:${segment.id}`);
    if (!segment.turnIds.length) reasons.push(`DIRECTOR_DIALOGUE_SEGMENT_TURNS_REQUIRED:${segment.id}`);
    if (!segment.evidenceIds.length) reasons.push(`DIRECTOR_DIALOGUE_SEGMENT_EVIDENCE_REQUIRED:${segment.id}`);
    let previousOrder = -1;
    for (const turnId of segment.turnIds) {
      const turn = turnById.get(turnId);
      if (!turn) {
        reasons.push(`DIRECTOR_DIALOGUE_SEGMENT_TURN_UNKNOWN:${segment.id}:${turnId}`);
        continue;
      }
      if (usedTurnIds.has(turnId)) reasons.push(`DIRECTOR_DIALOGUE_TURN_REUSED:${turnId}`);
      usedTurnIds.add(turnId);
      if (turn.segmentIndex !== segment.index) reasons.push(`DIRECTOR_DIALOGUE_TURN_SEGMENT_MISMATCH:${turnId}`);
      if (turn.order <= previousOrder) reasons.push(`DIRECTOR_DIALOGUE_TURN_ORDER_INVALID:${turnId}`);
      previousOrder = turn.order;
    }
  }
  for (const turn of state.turns) {
    if (!usedTurnIds.has(turn.id)) reasons.push(`DIRECTOR_DIALOGUE_TURN_UNASSIGNED:${turn.id}`);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function buildDialogueSegmentContinuityPacket(
  state: LongformDialogueState,
  segmentIndex: number,
): DialogueSegmentContinuityPacket {
  const reasons = validateLongformDialogueState(state);
  if (reasons.length) throw new Error(`DIRECTOR_LONGFORM_DIALOGUE_INVALID: ${reasons.join(', ')}`);
  const segment = state.segments.find((candidate) => candidate.index === segmentIndex);
  if (!segment) throw new Error('DIRECTOR_DIALOGUE_SEGMENT_UNKNOWN');
  const turns = segment.turnIds.map((id) => state.turns.find((turn) => turn.id === id)!).filter(Boolean);
  const previous = segmentIndex > 0 ? state.segments.find((candidate) => candidate.index === segmentIndex - 1) : undefined;
  const previousTurns = previous
    ? previous.turnIds.map((id) => state.turns.find((turn) => turn.id === id)!).filter(Boolean)
    : [];
  const previousLastSpeakerCharacterId = [...previousTurns].reverse().find((turn) => turn.kind !== 'reaction')?.characterId;
  return Object.freeze({
    stateId: state.id,
    projectId: state.projectId,
    sceneId: state.sceneId,
    segmentId: segment.id,
    segmentIndex,
    previousSegmentId: segment.previousSegmentId,
    cast: Object.freeze([...state.cast]),
    turns: Object.freeze(turns),
    previousLastSpeakerCharacterId,
    evidenceIds: Object.freeze([...new Set([...state.evidenceIds, ...segment.evidenceIds, ...turns.flatMap((turn) => turn.evidenceIds)])]),
    authority: 'DIRECTOR_DIALOGUE_SEGMENT_CONTINUITY',
  });
}
