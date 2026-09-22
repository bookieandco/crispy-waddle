export interface ScoreTheme {
  id: string;
  projectId: string;
  name: string;
  motifRef?: string;
  stemAssetIds: readonly string[];
  instrumentation: readonly string[];
  tempoBpm?: number;
  key?: string;
  usageNotes?: readonly string[];
}

export interface SceneScoreCue {
  id: string;
  sceneId: string;
  themeId?: string;
  startSeconds: number;
  endSeconds: number;
  intensity: number;
  dialoguePriority: boolean;
  evidenceIds: readonly string[];
}

export interface MovieAudioBible {
  projectId: string;
  scoreThemes: readonly ScoreTheme[];
  sceneCues: readonly SceneScoreCue[];
  dialogueLoudnessTargetLufs: number;
  musicLoudnessTargetLufs: number;
  foleyLoudnessTargetLufs: number;
  finalPeakDbfs: number;
}

export function validateMovieAudioBible(bible: MovieAudioBible): readonly string[] {
  const reasons: string[] = [];
  const themeIds = new Set(bible.scoreThemes.map((theme) => theme.id));
  for (const cue of bible.sceneCues) {
    if (cue.themeId && !themeIds.has(cue.themeId)) reasons.push(`DIRECTOR_SCORE_THEME_UNKNOWN:${cue.id}`);
    if (!Number.isFinite(cue.startSeconds) || !Number.isFinite(cue.endSeconds) || cue.startSeconds < 0 || cue.endSeconds <= cue.startSeconds) {
      reasons.push(`DIRECTOR_SCORE_CUE_RANGE_INVALID:${cue.id}`);
    }
    if (!Number.isFinite(cue.intensity) || cue.intensity < 0 || cue.intensity > 1) reasons.push(`DIRECTOR_SCORE_INTENSITY_INVALID:${cue.id}`);
    if (!cue.evidenceIds.length) reasons.push(`DIRECTOR_SCORE_EVIDENCE_REQUIRED:${cue.id}`);
  }
  for (const value of [bible.dialogueLoudnessTargetLufs, bible.musicLoudnessTargetLufs, bible.foleyLoudnessTargetLufs, bible.finalPeakDbfs]) {
    if (!Number.isFinite(value)) reasons.push('DIRECTOR_AUDIO_BIBLE_LEVEL_INVALID');
  }
  return Object.freeze([...new Set(reasons)]);
}
