import type { EditableTimeline } from './timeline-model';
import type { TimelineCommand } from './timeline-command';
import { applyTimelineCommand } from './timeline-command';

export type CommandHistoryEntry = {
  id: string;
  command: TimelineCommand;
  before: EditableTimeline;
  after: EditableTimeline;
  createdAt: string;
};

export class TimelineCommandManager {
  private readonly history: CommandHistoryEntry[] = [];
  private redoStack: CommandHistoryEntry[] = [];
  private current: EditableTimeline;

  constructor(initial: EditableTimeline) {
    this.current = initial;
  }

  get timeline(): EditableTimeline { return this.current; }
  get canUndo(): boolean { return this.history.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get entries(): readonly CommandHistoryEntry[] { return this.history; }

  execute(command: TimelineCommand): EditableTimeline {
    const before = this.current;
    const after = applyTimelineCommand(before, command);
    if (after === before) return this.current;
    const entry: CommandHistoryEntry = {
      id: crypto.randomUUID(),
      command,
      before,
      after,
      createdAt: new Date().toISOString(),
    };
    this.current = after;
    this.history.push(entry);
    this.redoStack = [];
    return this.current;
  }

  undo(): EditableTimeline {
    const entry = this.history.pop();
    if (!entry) return this.current;
    this.current = entry.before;
    this.redoStack.push(entry);
    return this.current;
  }

  redo(): EditableTimeline {
    const entry = this.redoStack.pop();
    if (!entry) return this.current;
    this.current = entry.after;
    this.history.push(entry);
    return this.current;
  }

  clearHistory(): void {
    this.history.length = 0;
    this.redoStack = [];
  }
}
