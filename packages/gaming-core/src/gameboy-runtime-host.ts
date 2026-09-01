import type { CanonicalGameInput } from './controller.js';
import type { GameBoyRuntimeHost } from './gameboy-runtime.js';
import type { LaunchContext } from './runtime.js';

export interface GameBoyEmulatorInstance {
  setInput(input: CanonicalGameInput): void;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
}

export interface GameBoyEmulatorFactory {
  create(contentUri: string): Promise<GameBoyEmulatorInstance>;
}

export class GameBoyRuntimeHostAdapter implements GameBoyRuntimeHost {
  private readonly sessions = new Map<string, GameBoyEmulatorInstance>();

  constructor(private readonly factory: GameBoyEmulatorFactory) {}

  async launch(contentUri: string, _input: LaunchContext): Promise<{ sessionId: string }> {
    if (!contentUri.trim()) throw new Error('Game Boy content URI is required');
    const emulator = await this.factory.create(contentUri);
    const sessionId = `gb-${crypto.randomUUID()}`;
    this.sessions.set(sessionId, emulator);
    await emulator.start();
    return { sessionId };
  }

  get(sessionId: string): GameBoyEmulatorInstance | undefined { return this.sessions.get(sessionId); }

  async stop(sessionId: string): Promise<void> {
    const emulator = this.sessions.get(sessionId);
    if (!emulator) throw new Error(`Game Boy session not found: ${sessionId}`);
    await emulator.stop();
    this.sessions.delete(sessionId);
  }
}
