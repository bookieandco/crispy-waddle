import type { Game, GameRuntimeAdapter, GameSession, LaunchContext } from './runtime.js';
import { RuntimeResolver } from './runtime.js';
import type { ControllerCore, ControllerDevice, ControllerRepository } from './controller.js';

export interface GamingCore {
  discoverControllers(): Promise<ControllerDevice[]>;
  launch(game: Game, context?: LaunchContext): Promise<GameSession>;
}

export type GamingAction =
  | { type: 'gaming.controllers.discover' }
  | { type: 'gaming.game.launch'; game: Game; context?: LaunchContext };

export type GamingActionResult = {
  controllers?: ControllerDevice[];
  session?: GameSession;
};

export class JhadinaGamingCapability implements GamingCore {
  private readonly resolver: RuntimeResolver;

  constructor(
    private readonly controllerCore: ControllerCore,
    _controllerRepository: ControllerRepository,
    runtimes: readonly GameRuntimeAdapter[],
  ) {
    this.resolver = new RuntimeResolver(runtimes);
  }

  async discoverControllers(): Promise<ControllerDevice[]> {
    return this.controllerCore.discover();
  }

  async launch(game: Game, context: LaunchContext = {}): Promise<GameSession> {
    const runtime = await this.resolver.resolve(game);
    return runtime.launch(game, context);
  }

  async execute(action: GamingAction): Promise<GamingActionResult> {
    switch (action.type) {
      case 'gaming.controllers.discover':
        return { controllers: await this.discoverControllers() };
      case 'gaming.game.launch':
        return { session: await this.launch(action.game, action.context) };
    }
  }
}
