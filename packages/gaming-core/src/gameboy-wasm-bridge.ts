import type { CanonicalGameInput } from './controller.js';
import type { GameBoyEmulatorFactory, GameBoyEmulatorInstance } from './gameboy-runtime-host.js';

export interface GameBoyWasmModule {
  loadRom(bytes: Uint8Array): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  setButton(button: 'a' | 'b' | 'up' | 'down' | 'left' | 'right' | 'start' | 'select', pressed: boolean): void;
}

export interface GameBoyWasmModuleFactory {
  create(): Promise<GameBoyWasmModule>;
}

export interface RomSource {
  read(uri: string): Promise<Uint8Array>;
}

export class GameBoyWasmEmulatorFactory implements GameBoyEmulatorFactory {
  constructor(private readonly modules: GameBoyWasmModuleFactory, private readonly roms: RomSource) {}

  async create(contentUri: string): Promise<GameBoyEmulatorInstance> {
    const module = await this.modules.create();
    const rom = await this.roms.read(contentUri);
    await module.loadRom(rom);
    return new GameBoyWasmEmulatorInstance(module);
  }
}

class GameBoyWasmEmulatorInstance implements GameBoyEmulatorInstance {
  constructor(private readonly module: GameBoyWasmModule) {}

  setInput(input: CanonicalGameInput): void {
    const buttons: Array<[CanonicalGameInput['buttons'] extends ReadonlySet<infer B> ? B : never, GameBoyWasmModule['setButton']]> = [];
    void buttons;
    this.module.setButton('a', input.buttons.has('a'));
    this.module.setButton('b', input.buttons.has('b'));
    this.module.setButton('up', input.buttons.has('dpad_up'));
    this.module.setButton('down', input.buttons.has('dpad_down'));
    this.module.setButton('left', input.buttons.has('dpad_left'));
    this.module.setButton('right', input.buttons.has('dpad_right'));
    this.module.setButton('start', input.buttons.has('start'));
    this.module.setButton('select', input.buttons.has('select'));
  }

  start(): Promise<void> { return this.module.start(); }
  pause(): Promise<void> { return this.module.pause(); }
  resume(): Promise<void> { return this.module.resume(); }
  stop(): Promise<void> { return this.module.stop(); }
}
