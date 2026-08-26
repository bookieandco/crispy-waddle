import type { TranscriptSegment } from './transcript-core.js';
import { resolveTranscriptSelection, type TranscriptSelection } from './transcript-editor-bridge.js';
import type { EditableTimeline } from './timeline-model.js';

export type TextEditCommand =
  | { type: 'delete-transcript'; phrase: string }
  | { type: 'select-transcript'; phrase: string };

export type ParsedTextEdit = {
  command: TextEditCommand;
  selection: TranscriptSelection;
  matchedSegmentIds: string[];
};

/**
 * Deliberately conservative parser: exact normalized phrase matching only.
 * Semantic/LLM interpretation belongs above this deterministic boundary.
 */
export function parseTextEditCommand(text: string): TextEditCommand | null {
  const normalized = text.trim().replace(/[.!?]+$/, '');
  const deleteMatch = normalized.match(/^(?:delete|remove|cut)\s+(?:the\s+)?(?:part|sentence|section)?\s*(?:where\s+I\s+say\s+|saying\s+)?["“](.+)["”]$/i);
  if (deleteMatch) return { type: 'delete-transcript', phrase: deleteMatch[1].trim() };
  const selectMatch = normalized.match(/^(?:select|find|show)\s+(?:the\s+)?(?:part|sentence|section)?\s*(?:where\s+I\s+say\s+|saying\s+)?["“](.+)["”]$/i);
  if (selectMatch) return { type: 'select-transcript', phrase: selectMatch[1].trim() };
  return null;
}

export function resolveTextEdit(
  timeline: EditableTimeline,
  transcript: { assetId: string; segments: TranscriptSegment[] },
  command: TextEditCommand,
): ParsedTextEdit | null {
  const phrase = normalize(command.phrase);
  const matches = transcript.segments.filter(segment => normalize(segment.text).includes(phrase));
  if (matches.length !== 1) return null;
  const selection = resolveTranscriptSelection(timeline, transcript, matches[0].id);
  if (!selection) return null;
  return { command, selection, matchedSegmentIds: [matches[0].id] };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
