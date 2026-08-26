export type TimeRange = { startSeconds: number; endSeconds: number };

export type VisionObservation = {
  id: string;
  time: TimeRange;
  type: 'box' | 'polygon' | 'mask' | 'point' | 'track';
  label: string;
  confidence?: number;
  attributes?: Record<string, string | number | boolean>;
};

export type TranscriptObservation = {
  id: string;
  time: TimeRange;
  text: string;
  speaker?: string;
  confidence?: number;
};

export type AudioObservation = {
  id: string;
  time: TimeRange;
  kind: 'speech' | 'music' | 'sfx' | 'silence' | 'noise' | 'unknown';
  confidence?: number;
  features?: Record<string, number>;
};

export type ShotIndexEntry = {
  id: string;
  assetId: string;
  time: TimeRange;
  vision: VisionObservation[];
  transcript: TranscriptObservation[];
  audio: AudioObservation[];
  keywords: string[];
};

export type ShotIndexQuery = {
  text?: string;
  labels?: string[];
  audioKinds?: AudioObservation['kind'][];
  startSeconds?: number;
  endSeconds?: number;
};

export function createShotIndexEntry(input: Omit<ShotIndexEntry, 'keywords'>): ShotIndexEntry {
  const keywords = new Set<string>();
  input.vision.forEach(item => keywords.add(item.label.toLowerCase()));
  input.transcript.flatMap(item => item.text.toLowerCase().split(/\W+/)).filter(Boolean).forEach(word => keywords.add(word));
  input.audio.forEach(item => keywords.add(item.kind));
  return { ...input, keywords: [...keywords] };
}

export function searchShotIndex(entries: ShotIndexEntry[], query: ShotIndexQuery): ShotIndexEntry[] {
  const text = query.text?.trim().toLowerCase();
  return entries.filter(entry => {
    if (query.labels?.length && !query.labels.every(label => entry.vision.some(v => v.label.toLowerCase() === label.toLowerCase()))) return false;
    if (query.audioKinds?.length && !query.audioKinds.some(kind => entry.audio.some(a => a.kind === kind))) return false;
    if (query.startSeconds !== undefined && entry.time.endSeconds < query.startSeconds) return false;
    if (query.endSeconds !== undefined && entry.time.startSeconds > query.endSeconds) return false;
    if (text && !entry.keywords.some(keyword => keyword.includes(text)) && !entry.transcript.some(t => t.text.toLowerCase().includes(text))) return false;
    return true;
  });
}
