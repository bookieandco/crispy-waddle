export type StudySource = 'youtube' | 'stream' | 'local-media';

export type LinkedStudy = {
  id: string;
  source: StudySource;
  url: string;
  title?: string;
  startedAt: string;
  autonomous: boolean;
  learnAcrossJhadina: boolean;
};

export type LearningCandidate = {
  id: string;
  studyId: string;
  concept: string;
  domain: string;
  evidenceObservationIds: string[];
  confidence: number;
  status: 'candidate' | 'corroborated' | 'approved';
  provenance: { sourceUrl: string; time?: { startSeconds: number; endSeconds: number } }[];
};

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

export function isSupportedStudyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function createLinkedStudy(input: Omit<LinkedStudy, 'id' | 'startedAt'> & { id?: string }): LinkedStudy {
  if (input.source === 'youtube' && !isSupportedStudyUrl(input.url)) throw new Error('Invalid YouTube study URL');
  return {
    ...input,
    id: input.id ?? `study:${Date.now()}`,
    startedAt: new Date().toISOString(),
  };
}

export type AutonomousViewer = {
  start(study: LinkedStudy): Promise<void>;
  stop(studyId: string): Promise<void>;
};

export function createAutonomousViewer(deps: {
  observe(study: LinkedStudy): Promise<void>;
  stopObserving(studyId: string): Promise<void>;
}): AutonomousViewer {
  return {
    start: study => deps.observe(study),
    stop: studyId => deps.stopObserving(studyId),
  };
}
