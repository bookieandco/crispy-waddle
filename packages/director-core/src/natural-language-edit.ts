import type { TimelineCommand } from './timeline-command.js';

export type EditTarget = { clipId?: string; startSeconds?: number; endSeconds?: number; text?: string; trackId?: string };
export type NaturalLanguageEdit = { instruction: string; target?: EditTarget; command: TimelineCommand; confidence: number; requiresConfirmation: boolean };
export type EditResolutionContext = { clipIds?: string[]; trackIds?: string[]; transcriptMatches?: Array<{ text: string; startSeconds: number; endSeconds: number; clipId?: string }> };

/** Resolves only safe, previewable intents. It never mutates the timeline. */
export function resolveEditIntent(instruction: string, context: EditResolutionContext = {}): NaturalLanguageEdit | null {
  const text = instruction.trim(); const lower = text.toLowerCase();
  const match = context.transcriptMatches?.find(item => lower.includes(item.text.toLowerCase()));
  if (match) {
    return { instruction: text, target: { text: match.text, startSeconds: match.startSeconds, endSeconds: match.endSeconds, clipId: match.clipId },
      command: match.clipId ? { type: 'ripple-delete', clipId: match.clipId } : { type: 'generative-region', region: { id: `edit-${Date.now()}`, startSeconds: match.startSeconds, durationSeconds: Math.max(0.1, match.endSeconds - match.startSeconds), operation: 'remove', instruction: text, approved: false } },
      confidence: 0.72, requiresConfirmation: true };
  }
  const clipId = context.clipIds?.length === 1 ? context.clipIds[0] : undefined;
  if (clipId && /\b(remove|delete|cut out)\b/.test(lower)) return { instruction: text, target: { clipId }, command: { type: 'ripple-delete', clipId }, confidence: 0.62, requiresConfirmation: true };
  return null;
}

export function validateEditIntent(edit: NaturalLanguageEdit, context: EditResolutionContext = {}): string[] {
  const errors: string[] = [];
  if (!edit.instruction.trim()) errors.push('Instruction is empty');
  if (!Number.isFinite(edit.confidence) || edit.confidence < 0 || edit.confidence > 1) errors.push('Confidence must be between 0 and 1');
  if (edit.command.type !== 'generative-region' && edit.command.type !== 'generate-sfx' && !edit.command.clipId) errors.push('Clip target is required');
  if (edit.command.type === 'ripple-delete' && context.clipIds && !context.clipIds.includes(edit.command.clipId)) errors.push('Target clip is not present in context');
  return errors;
}
