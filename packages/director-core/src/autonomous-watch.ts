import type { Observation } from './observation-bus.js';
import type { CinematicStudyNote } from './cinematic-study.js';

export type WatchFrame = { timeSeconds: number; observations: Observation[] };
export type CinematicNoteWriter = { write(note: CinematicStudyNote): Promise<void> };
export type WatchObserver = { observe(frame: WatchFrame): Promise<Observation[]> };

export type AutonomousWatchSession = {
  sourceId: string;
  startedAt: string;
  notesCreated: number;
};

export async function watchAndTakeNotes(
  session: AutonomousWatchSession,
  frames: AsyncIterable<WatchFrame>,
  observer: WatchObserver,
  writer: CinematicNoteWriter,
): Promise<AutonomousWatchSession> {
  let notesCreated = session.notesCreated;
  for await (const frame of frames) {
    const observations = await observer.observe(frame);
    const meaningful = observations.filter(item => item.confidence === undefined || item.confidence >= 0.7);
    if (!meaningful.length) continue;

    const grouped = [...new Set(meaningful.map(item => item.label ?? item.kind).filter(Boolean))];
    const transcript = meaningful.filter(item => item.modality === 'transcript').map(item => item.text).filter(Boolean).join(' ');
    const note: CinematicStudyNote = {
      id: `${session.sourceId}:${frame.timeSeconds.toFixed(3)}`,
      sourceId: session.sourceId,
      time: { startSeconds: frame.timeSeconds, endSeconds: frame.timeSeconds },
      type: meaningful.some(item => item.modality === 'vision') ? 'shot' : meaningful.some(item => item.modality === 'audio') ? 'sound' : 'general',
      observation: [grouped.join(', '), transcript].filter(Boolean).join(' — '),
      tags: grouped.map(value => value.toLowerCase()),
      createdAt: new Date().toISOString(),
    };
    await writer.write(note);
    notesCreated += 1;
  }
  return { ...session, notesCreated };
}
