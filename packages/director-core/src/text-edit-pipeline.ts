import type { EditableTimeline } from './timeline-model.js';
import type { TranscriptSegment } from './transcript-core.js';
import { parseTextEditCommand, resolveTextEdit, type ParsedTextEdit } from './text-edit-command.js';
import { createTranscriptEditProposal, type TranscriptEditProposal } from './transcript-edit-approval.js';

export type TextEditPipelineResult = {
  parsed: ParsedTextEdit;
  proposal: TranscriptEditProposal;
};

/** Converts a deterministic text command into a governed transcript edit proposal. */
export function createTextEditProposal(
  text: string,
  timeline: EditableTimeline,
  transcript: { assetId: string; segments: TranscriptSegment[] },
): TextEditPipelineResult | null {
  const command = parseTextEditCommand(text);
  if (!command) return null;

  const parsed = resolveTextEdit(timeline, transcript, command);
  if (!parsed) return null;

  const proposal = createTranscriptEditProposal({
    action: command.type === 'delete-transcript' ? 'delete' : 'select',
    selection: parsed.selection,
    reason: `Text command: ${text.trim()}`,
  });

  return { parsed, proposal };
}
