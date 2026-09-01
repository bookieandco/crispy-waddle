import type { CanonicalGameInput } from './controller.js';
import type { Game, GameSession, LaunchContext } from './runtime.js';
import type { MoonlightClient } from './moonlight-runtime.js';
import { InputSynchronizationEngine, type InputEvent } from './input-sync.js';

export interface RemotePlaySession {
  session: GameSession;
  remoteSessionId: string;
  hostId: string;
  appId: string;
}

export interface RemotePlayInput extends InputEvent {
  canonical: CanonicalGameInput;
}

export class RemotePlaySessionCoordinator {
  private readonly sync = new InputSynchronizationEngine();
  private readonly sessions = new Map<string, RemotePlaySession>();

  constructor(private readonly client: MoonlightClient) {}

  async start(game: Game, context: LaunchContext = {}): Promise<RemotePlaySession> {
    if (!game.contentUri.startsWith('moonlight://')) throw new Error(`Not a Moonlight game: ${game.id}`);
    const [, hostId, appId] = game.contentUri.split('://')[1]?.split('/') ?? [];
    if (!hostId || !appId) throw new Error('Moonlight URI must be moonlight://<host>/<app>');
    const remote = await this.client.launch(hostId, appId, context);
    const session: RemotePlaySession = {
      session: { id: `remote:${remote.id}`, gameId: game.id, runtimeId: 'moonlight-remote', startedAt: new Date().toISOString() },
      remoteSessionId: remote.id, hostId, appId,
    };
    this.sessions.set(session.session.id, session);
    return session;
  }

  async sendInput(sessionId: string, input: RemotePlayInput, nowMs = Date.now()): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Remote play session not found: ${sessionId}`);
    const result = this.sync.accept(input, nowMs);
    if (!result.accepted) return;
    await this.client.sendInput(session.remoteSessionId, input.canonical);
  }

  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    await this.client.stop(session.remoteSessionId);
    this.sessions.delete(sessionId);
  }
}
