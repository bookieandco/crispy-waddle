import type { CanonicalGameInput } from './controller.js';
import type { Game, GameRuntimeAdapter, GameSession, LaunchContext } from './runtime.js';

export interface MoonlightHost { id: string; name: string; address: string; paired: boolean; }
export interface MoonlightStreamCapabilities { video: readonly ('h264' | 'hevc' | 'av1')[]; audio: readonly ('stereo' | 'surround')[]; hdr: boolean; maxFps?: number; maxWidth?: number; maxHeight?: number; }
export interface MoonlightSession { id: string; hostId: string; appId: string; }
export interface MoonlightClient {
  discoverHosts(): Promise<readonly MoonlightHost[]>;
  launch(hostId: string, appId: string, input: LaunchContext): Promise<MoonlightSession>;
  sendInput(sessionId: string, input: CanonicalGameInput): Promise<void>;
  stop(sessionId: string): Promise<void>;
}

export class MoonlightRemoteRuntime implements GameRuntimeAdapter {
  readonly runtime = {
    id: 'moonlight-remote', name: 'Jhadina Moonlight Remote Runtime',
    platform: 'pc' as const, kind: 'cloud' as const,
    capabilities: ['remote-video', 'remote-audio', 'gamepad-input', 'hdr', 'high-refresh'] as const,
  };
  constructor(private readonly client: MoonlightClient) {}
  async canLaunch(game: Game): Promise<boolean> { return game.platform === 'pc' && game.contentUri.startsWith('moonlight://'); }
  async launch(game: Game, input: LaunchContext): Promise<GameSession> {
    if (!(await this.canLaunch(game))) throw new Error(`Moonlight cannot launch ${game.platform}:${game.id}`);
    const [, hostId, appId] = game.contentUri.split('://')[1]?.split('/') ?? [];
    if (!hostId || !appId) throw new Error('Moonlight URI must be moonlight://<host>/<app>');
    const session = await this.client.launch(hostId, appId, input);
    return { id: session.id, gameId: game.id, runtimeId: this.runtime.id, startedAt: new Date().toISOString() };
  }
  async input(sessionId: string, input: CanonicalGameInput): Promise<void> { await this.client.sendInput(sessionId, input); }
  async stop(sessionId: string): Promise<void> { await this.client.stop(sessionId); }
}