import type { TimelineCommand } from './timeline-command.js';
import { resolveEditIntent, validateEditIntent, type EditResolutionContext, type NaturalLanguageEdit } from './natural-language-edit.js';

export type EditPreview = {
  status: 'ready' | 'needs-review' | 'rejected';
  edit: NaturalLanguageEdit | null;
  errors: string[];
};

/** Converts natural-language intent into a validated command preview without mutating timeline state. */
export function previewEditCommand(instruction: string, context: EditResolutionContext = {}): EditPreview {
  const edit = resolveEditIntent(instruction, context);
  if (!edit) return { status: 'rejected', edit: null, errors: ['Unable to resolve a supported edit intent'] };
  const errors = validateEditIntent(edit, context);
  if (errors.length) return { status: 'rejected', edit, errors };
  return { status: edit.requiresConfirmation ? 'needs-review' : 'ready', edit, errors: [] };
}

/** Converts an already approved preview into an executable command. */
export function approveEditCommand(preview: EditPreview): TimelineCommand {
  if (preview.status === 'rejected' || !preview.edit) throw new Error('Edit preview is not executable');
  return preview.edit.command;
}

/** Explicit approval transition. This never mutates timeline state. */
export function approveEditPreview(preview: EditPreview): EditPreview {
  if (preview.status === 'rejected' || !preview.edit) throw new Error('Edit preview is not approvable');
  return { ...preview, status: 'ready' };
}
