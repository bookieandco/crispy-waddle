import type { Observation } from './observation-bus.js';
import type { CinematicStudyNote } from './cinematic-study.js';

export type CinematicNoteEngine = {
  consider(observations: Observation[]): Promise<CinematicStudyNote | null>;
};

const cinematicKinds = new Set(['cut', 'camera-movement', 'composition-change', 'music-entry', 'sound-transition', 'dialogue-beat', 'performance-beat', 'scene-change', 'transition']);

export function createCinematicNoteEngine(writer: { write(note: CinematicStudyNote): Promise<void> }): CinematicNoteEngine {
  return {
    async consider(observations) {
      const meaningful = observations.filter(item =>
        (item.confidence === undefined || item.confidence >= 0.7) &&
        (cinematicKinds.has(item.kind) || item.modality === 'vision' || item.modality === 'audio' || item.modality === 'transcript'),
      );
      if (!meaningful.length) return null;

      const first = meaningful[0];
      const end = Math.max(...meaningful.map(item => item.time.endSeconds));
      const labels = [...new Set(meaningful.flatMap(item => [item.label, item.kind]).filter(Boolean))];
      const transcript = meaningful.map(item => item.text).filter(Boolean).join(' ');
      const note: CinematicStudyNote = {
        id: `study:${first.assetId}:${first.time.startSeconds.toFixed(3)}`,
        sourceId: first.assetId,
        time: { startSeconds: first.time.startSeconds, endSeconds: end },
        type: meaningful.some(item => item.kind === 'camera-movement' || item.kind === 'composition-change') ? 'camera' : meaningful.some(item => item.modality === 'audio') ? 'sound' : meaningful.some(item => item.modality === 'transcript') ? 'performance' : 'shot',
        observation: [labels.join(', '), transcript].filter(Boolean).join(' — '),
        tags: labels.map(value => value.toLowerCase()),
        createdAt: new Date().toISOString(),
      };
      await writer.write(note);
      return note;
    },
  };
}
