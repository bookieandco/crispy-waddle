export type SceneRecoveryMode = 'stop' | 'continue';
export type SceneActionStatus = 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface SceneRecoveryAction { readonly actionId: string; readonly deviceId: string; readonly capability: string; readonly payload?: unknown; readonly compensation?: { readonly deviceId: string; readonly capability: string; readonly payload?: unknown }; }
export interface SceneRecoveryResult { readonly status: 'completed' | 'failed' | 'cancelled'; readonly completed: readonly string[]; readonly failed?: string; readonly compensated: readonly string[]; readonly skipped: readonly string[]; }

export interface SceneActionExecutor { execute(action: SceneRecoveryAction): Promise<void>; }

export class SceneCancellationError extends Error {
  constructor() { super('Scene execution cancelled'); this.name = 'SceneCancellationError'; }
}

export class SceneRunner {
  private cancelled = false;
  constructor(private readonly executor: SceneActionExecutor) {}

  cancel(): void { this.cancelled = true; }

  async run(actions: readonly SceneRecoveryAction[], mode: SceneRecoveryMode = 'stop'): Promise<SceneRecoveryResult> {
    const completed: string[] = [];
    const compensated: string[] = [];
    const skipped: string[] = [];
    for (const action of actions) {
      if (this.cancelled) {
        skipped.push(...actions.slice(completed.length + skipped.length).map(a => a.actionId));
        return { status: 'cancelled', completed, compensated, skipped };
      }
      try {
        await this.executor.execute(action);
        completed.push(action.actionId);
      } catch {
        if (mode === 'continue') { skipped.push(action.actionId); continue; }
        for (const prior of [...actions].reverse().filter(a => completed.includes(a.actionId) && a.compensation)) {
          try { await this.executor.execute({ actionId: `compensate:${prior.actionId}`, ...prior.compensation! }); compensated.push(prior.actionId); } catch { /* best-effort compensation; original failure remains authoritative */ }
        }
        return { status: 'failed', completed, failed: action.actionId, compensated, skipped };
      }
    }
    return { status: 'completed', completed, compensated, skipped };
  }
}
