import type {GamingRecordStore} from './gaming-durable.js';
import {GameBoyCartridgeVault} from './gameboy-cartridge-vault.js';
import type {RomSource,GameBoyWasmModuleFactory} from './gameboy-wasm-bridge.js';
import {GameBoyWasmEmulatorFactory} from './gameboy-wasm-bridge.js';
import {GameBoyRuntimeHostAdapter} from './gameboy-runtime-host.js';
import {GameBoyRuntimeAdapter} from './gameboy-runtime.js';
import {GameBoyManagedRuntimeDriver} from './gameboy-session-driver.js';

/** ROM bytes come only from the durable user-imported vault, never from a remote URL. */
export class LocalGameBoyRomSource implements RomSource{
  constructor(private readonly vault:GameBoyCartridgeVault){}
  async read(uri:string):Promise<Uint8Array>{
    const match=/^gameboy-local:\/\/(gb-[a-f0-9]{24})$/.exec(uri);
    if(!match)throw new Error('Local Game Boy ROM source must be a previously imported cartridge');
    const cartridge=await this.vault.read(match[1]!);
    if(!cartridge)throw new Error('Game Boy cartridge is unavailable on this device');
    return cartridge.bytes.slice();
  }
}

/**
 * Binds GameBoyWasmModuleFactory to canonical managed session driver.
 * The host must be supplied an audited actual WASM module factory by deployment.
 */
export function createLocalGameBoyManagedRuntime(storage:GamingRecordStore,modules:GameBoyWasmModuleFactory){
  const vault=new GameBoyCartridgeVault(storage);
  const roms=new LocalGameBoyRomSource(vault);
  const host=new GameBoyRuntimeHostAdapter(new GameBoyWasmEmulatorFactory(modules,roms));
  const runtime=new GameBoyRuntimeAdapter(host);
  const driver=new GameBoyManagedRuntimeDriver(runtime,host);
  return{host,runtime,driver,roms,vault};
}
