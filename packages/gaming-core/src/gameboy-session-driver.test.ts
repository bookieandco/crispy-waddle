import {describe,expect,it,vi} from 'vitest';
import {GameBoyManagedRuntimeDriver} from './gameboy-session-driver.js';
import type {GameBoyRuntimeAdapter} from './gameboy-runtime.js';

describe('GameBoyManagedRuntimeDriver',()=>{
  it('runs local emulator sessions through the unified managed-runtime contract',async()=>{
    const runtime={
      canLaunch:vi.fn(async()=>true),
      launch:vi.fn(async()=>({id:'gb-1',gameId:'g1',runtimeId:'gameboy-wasm',startedAt:'now'})),
    } as unknown as GameBoyRuntimeAdapter;
    const stop=vi.fn(async()=>{});
    const driver=new GameBoyManagedRuntimeDriver(runtime,{stop});
    const game={id:'g1',title:'Tetris',platform:'gameboy' as const,contentUri:'file:///roms/tetris.gb'};
    expect(await driver.canStart(game)).toBe(true);
    const handle=await driver.start(game,{});
    expect(handle).toMatchObject({runtimeSessionId:'gb-1',runtimeId:'gameboy-wasm',runtimeKind:'emulator'});
    await handle.stop();
    expect(stop).toHaveBeenCalledWith('gb-1');
  });
});
