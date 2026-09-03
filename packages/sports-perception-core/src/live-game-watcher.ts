export type ObservationKind =
  | 'DETECTION'
  | 'TRACK'
  | 'POSE'
  | 'PLAY_CLASSIFICATION'
  | 'SCOREBOARD'
  | 'PLAY_BY_PLAY'
  | 'COMMENTARY'
  | 'SPATIAL_STATE';

export type NoteType =
  | 'OBSERVATION'
  | 'EVENT'
  | 'INFERENCE'
  | 'HYPOTHESIS'
  | 'VALIDATION'
  | 'CORRECTION';

export interface PerceptionObservation {
  observationId: string;
  eventId: string;
  sourceId: string;
  observedAt: string;
  sourceTimestamp?: number;
  kind: ObservationKind;
  text: string;
  subjectIds?: readonly string[];
  confidence: number;
  evidenceIds?: readonly string[];
  stateVersion?: string;
}

export interface GameNote {
  noteId: string;
  eventId: string;
  sourceId: string;
  observedAt: string;
  sourceTimestamp?: number;
  type: NoteType;
  text: string;
  subjectIds: readonly string[];
  evidenceIds: readonly string[];
  confidence: number;
  stateVersion?: string;
  relationToNoteId?: string;
  derivedFromObservationIds: readonly string[];
}

export interface HypothesisValidation {
  hypothesisNoteId: string;
  validationNoteId: string;
  status: 'SUPPORTED' | 'CONTRADICTED' | 'INCONCLUSIVE';
}

export interface WatchSession {
  sessionId: string;
  eventId: string;
  startedAt: string;
  lastSourceTimestamp?: number;
  stateVersion?: string;
}

function assertProbability(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('confidence must be between 0 and 1');
  }
}

function compareNotes(a: GameNote, b: GameNote): number {
  const aTime = a.sourceTimestamp ?? Number.POSITIVE_INFINITY;
  const bTime = b.sourceTimestamp ?? Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  if (a.observedAt !== b.observedAt) return a.observedAt.localeCompare(b.observedAt);
  return a.noteId.localeCompare(b.noteId);
}

function cloneNote(note: GameNote): GameNote {
  return {
    ...note,
    subjectIds: [...note.subjectIds],
    evidenceIds: [...note.evidenceIds],
    derivedFromObservationIds: [...note.derivedFromObservationIds],
  };
}

/**
 * Append-only game notebook. Perception is kept separate from interpretation:
 * detectors/classifiers can ingest observations, while inference/hypothesis
 * notes require an explicit caller action.
 */
export class LiveGameWatcher {
  private readonly observations = new Map<string, PerceptionObservation>();
  private readonly notes = new Map<string, GameNote>();
  private readonly sessions = new Map<string, WatchSession>();

  startSession(session: WatchSession): void {
    if (!session.sessionId || !session.eventId) throw new Error('session identity is required');
    if (this.sessions.has(session.sessionId)) throw new Error('session already exists');
    this.sessions.set(session.sessionId, { ...session });
  }

  ingestObservation(observation: PerceptionObservation): GameNote | null {
    if (!observation.observationId || !observation.eventId || !observation.sourceId) {
      throw new Error('observation identity is required');
    }
    assertProbability(observation.confidence);
    if (this.observations.has(observation.observationId)) return null;

    const normalized: PerceptionObservation = {
      ...observation,
      subjectIds: [...(observation.subjectIds ?? [])],
      evidenceIds: [...(observation.evidenceIds ?? [])],
    };
    this.observations.set(observation.observationId, normalized);

    const noteType: NoteType =
      observation.kind === 'PLAY_CLASSIFICATION' || observation.kind === 'PLAY_BY_PLAY' || observation.kind === 'SCOREBOARD'
        ? 'EVENT'
        : 'OBSERVATION';

    const note: GameNote = {
      noteId: `obs:${observation.observationId}`,
      eventId: observation.eventId,
      sourceId: observation.sourceId,
      observedAt: observation.observedAt,
      sourceTimestamp: observation.sourceTimestamp,
      type: noteType,
      text: observation.text,
      subjectIds: [...(observation.subjectIds ?? [])],
      evidenceIds: [...(observation.evidenceIds ?? [])],
      confidence: observation.confidence,
      stateVersion: observation.stateVersion,
      derivedFromObservationIds: [observation.observationId],
    };
    this.notes.set(note.noteId, note);
    return cloneNote(note);
  }

  addInterpretation(note: Omit<GameNote, 'derivedFromObservationIds'> & { derivedFromObservationIds: readonly string[] }): GameNote {
    if (!['INFERENCE', 'HYPOTHESIS'].includes(note.type)) throw new Error('interpretation must be inference or hypothesis');
    if (note.derivedFromObservationIds.length === 0) throw new Error('interpretation requires observations');
    const sourceObservations = note.derivedFromObservationIds.map((id) => {
      const observation = this.observations.get(id);
      if (!observation) throw new Error(`unknown observation: ${id}`);
      if (observation.eventId !== note.eventId) throw new Error('interpretation crosses event boundaries');
      return observation;
    });
    assertProbability(note.confidence);
    if (this.notes.has(note.noteId)) throw new Error('note already exists');
    if (note.type === 'HYPOTHESIS' && note.sourceTimestamp !== undefined) {
      const latestSource = Math.max(...sourceObservations.map((item) => item.sourceTimestamp ?? -Infinity));
      if (Number.isFinite(latestSource) && note.sourceTimestamp < latestSource) {
        throw new Error('hypothesis cannot precede its source observations');
      }
    }
    const stored: GameNote = {
      ...note,
      subjectIds: [...note.subjectIds],
      evidenceIds: [...note.evidenceIds],
      derivedFromObservationIds: [...note.derivedFromObservationIds],
    };
    this.notes.set(note.noteId, stored);
    return cloneNote(stored);
  }

  validateHypothesis(hypothesisNoteId: string, validationNote: Omit<GameNote, 'type' | 'relationToNoteId'>): HypothesisValidation {
    const hypothesis = this.notes.get(hypothesisNoteId);
    if (!hypothesis || hypothesis.type !== 'HYPOTHESIS') throw new Error('hypothesis note not found');
    if (validationNote.eventId !== hypothesis.eventId) throw new Error('validation crosses event boundaries');
    if (validationNote.sourceTimestamp !== undefined && hypothesis.sourceTimestamp !== undefined && validationNote.sourceTimestamp < hypothesis.sourceTimestamp) {
      throw new Error('validation cannot precede hypothesis');
    }
    for (const id of validationNote.derivedFromObservationIds) {
      const observation = this.observations.get(id);
      if (!observation) throw new Error(`unknown observation: ${id}`);
      if (observation.eventId !== hypothesis.eventId) throw new Error('validation crosses event boundaries');
      if (hypothesis.sourceTimestamp !== undefined && observation.sourceTimestamp !== undefined && observation.sourceTimestamp < hypothesis.sourceTimestamp) {
        throw new Error('validation evidence must occur after hypothesis');
      }
    }
    assertProbability(validationNote.confidence);
    const validation: GameNote = {
      ...validationNote,
      type: 'VALIDATION',
      relationToNoteId: hypothesisNoteId,
      subjectIds: [...validationNote.subjectIds],
      evidenceIds: [...validationNote.evidenceIds],
      derivedFromObservationIds: [...validationNote.derivedFromObservationIds],
    };
    if (this.notes.has(validation.noteId)) throw new Error('note already exists');
    this.notes.set(validation.noteId, validation);
    const status = /contradict|false|no longer|not supported/i.test(validation.text)
      ? 'CONTRADICTED'
      : /confirm|support|consistent|again|validated/i.test(validation.text)
        ? 'SUPPORTED'
        : 'INCONCLUSIVE';
    return { hypothesisNoteId, validationNoteId: validation.noteId, status };
  }

  correctNote(noteId: string, correction: Omit<GameNote, 'type' | 'relationToNoteId'>): GameNote {
    if (!this.notes.has(noteId)) throw new Error('note not found');
    if (correction.eventId !== this.notes.get(noteId)?.eventId) throw new Error('correction crosses event boundaries');
    const note: GameNote = {
      ...correction,
      type: 'CORRECTION',
      relationToNoteId: noteId,
      subjectIds: [...correction.subjectIds],
      evidenceIds: [...correction.evidenceIds],
      derivedFromObservationIds: [...correction.derivedFromObservationIds],
    };
    assertProbability(note.confidence);
    if (this.notes.has(note.noteId)) throw new Error('note already exists');
    this.notes.set(note.noteId, note);
    return cloneNote(note);
  }

  getObservations(eventId?: string): readonly PerceptionObservation[] {
    return [...this.observations.values()]
      .filter((item) => eventId === undefined || item.eventId === eventId)
      .sort((a, b) => (a.sourceTimestamp ?? Infinity) - (b.sourceTimestamp ?? Infinity) || a.observationId.localeCompare(b.observationId))
      .map((item) => ({ ...item, subjectIds: [...(item.subjectIds ?? [])], evidenceIds: [...(item.evidenceIds ?? [])] }));
  }

  getNotes(eventId?: string): readonly GameNote[] {
    return [...this.notes.values()]
      .filter((item) => eventId === undefined || item.eventId === eventId)
      .sort(compareNotes)
      .map(cloneNote);
  }
}
