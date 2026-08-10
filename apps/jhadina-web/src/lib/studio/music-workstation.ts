export type MusicTrackKind = "audio" | "midi" | "stem" | "instrument" | "voice" | "restoration";
export type RecordingState = "idle" | "armed" | "recording" | "paused" | "stopped";

export interface AudioTake { id: string; trackId: string; startSeconds: number; durationSeconds: number; sampleRate: number; channels: number; source: "microphone" | "line-in" | "import"; }
export interface MidiEvent { id: string; trackId: string; tick: number; note: number; velocity: number; durationTicks: number; channel: number; }
export interface MusicTrack { id: string; name: string; kind: MusicTrackKind; armed: boolean; muted: boolean; solo: boolean; clips: string[]; }
export interface RestorationJob { id: string; sourceTrackId: string; operations: ("denoise" | "declick" | "dehum" | "spectral-repair" | "stem-separate" | "master")[]; status: "proposed" | "running" | "qc" | "approved"; }
export interface MusicSession { id: string; tempo: number; sampleRate: number; tracks: MusicTrack[]; takes: AudioTake[]; midiEvents: MidiEvent[]; restorationJobs: RestorationJob[]; recordingState: RecordingState; }

export function createMusicSession(tempo = 120, sampleRate = 48000): MusicSession {
  return { id: crypto.randomUUID(), tempo, sampleRate, tracks: [], takes: [], midiEvents: [], restorationJobs: [], recordingState: "idle" };
}

export function armTrack(session: MusicSession, trackId: string): MusicSession {
  return { ...session, tracks: session.tracks.map(t => ({ ...t, armed: t.id === trackId })) };
}

export function setRecordingState(session: MusicSession, state: RecordingState): MusicSession {
  return { ...session, recordingState: state };
}

export function addAudioTake(session: MusicSession, take: Omit<AudioTake, "id">): MusicSession {
  return { ...session, takes: [...session.takes, { ...take, id: crypto.randomUUID() }] };
}

export function addMidiEvent(session: MusicSession, event: Omit<MidiEvent, "id">): MusicSession {
  return { ...session, midiEvents: [...session.midiEvents, { ...event, id: crypto.randomUUID() }] };
}
