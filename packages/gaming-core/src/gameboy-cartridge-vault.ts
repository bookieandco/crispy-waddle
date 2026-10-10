import type {GamingRecordStore} from './gaming-durable.js';
import {DurableGameLibrary} from './gaming-durable.js';

/** Only content explicitly supplied by a local file-picker may be imported. */
export interface GameBoyCartridge{
  gameId:string;fileName:string;sha256:string;bytes:Uint8Array;importedAtMs:number;
}
export interface GameBoySaveState{
  gameId:string;sha256:string;bytes:Uint8Array;createdAtMs:number;
}
const sizeLimit=8*1024*1024;
const cartKey=(id:string)=>'rom:'+encodeURIComponent(id);
const stateKey=(id:string)=>'gbstate:'+encodeURIComponent(id);
async function digest(bytes:Uint8Array):Promise<string>{
  if(!globalThis.crypto?.subtle)throw new Error('WebCrypto SHA-256 is required');
  const binary=bytes.slice().buffer;
  const hash=await globalThis.crypto.subtle.digest('SHA-256',binary);
  return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
}
function checkBytes(bytes:Uint8Array):void{
  if(bytes.byteLength<0x150||bytes.byteLength>sizeLimit)throw new Error('Game Boy cartridge size is outside the allowed bounds');
}
export class GameBoyCartridgeVault{
  constructor(private readonly store:GamingRecordStore){}
  async importLocalFile(file:Blob&{name:string},nowMs=Date.now()):Promise<GameBoyCartridge>{
    const name=file.name.trim();
    if(!/\.gbc?$/i.test(name))throw new Error('Select a local .gb or .gbc cartridge');
    if(!Number.isFinite(nowMs))throw new Error('Invalid import timestamp');
    const bytes=new Uint8Array(await file.arrayBuffer());
    checkBytes(bytes);
    const sha256=await digest(bytes);
    const gameId='gb-'+sha256.slice(0,24);
    const prior=await this.store.read<GameBoyCartridge>(cartKey(gameId));
    if(prior){
      if(prior.payload.sha256!==sha256)throw new Error('Cartridge id collision');
      return prior.payload;
    }
    const cart:GameBoyCartridge={gameId,fileName:name,sha256,bytes,importedAtMs:nowMs};
    await this.store.write(cartKey(gameId),cart,0);
    await new DurableGameLibrary(this.store).save({
      id:gameId,title:name.replace(/\.gbc?$/i,''),platform:'gameboy',
      contentUri:'gameboy-local://'+gameId,installed:true,tags:['user-provided'],
      metadata:{sha256,originalName:name},
    });
    return cart;
  }
  async read(gameId:string):Promise<GameBoyCartridge|undefined>{
    const cart=(await this.store.read<GameBoyCartridge>(cartKey(gameId)))?.payload;
    if(!cart)return undefined;
    checkBytes(cart.bytes);
    if(await digest(cart.bytes)!==cart.sha256)throw new Error('Cartridge integrity mismatch');
    return cart;
  }
}

export class GameBoySaveVault{
  constructor(private readonly store:GamingRecordStore){}
  async latest(gameId:string):Promise<{revision:number;state:GameBoySaveState}|undefined>{
    const record=await this.store.read<GameBoySaveState>(stateKey(gameId));
    if(!record)return undefined;
    if(await digest(record.payload.bytes)!==record.payload.sha256)throw new Error('Game Boy save integrity mismatch');
    return{revision:record.revision,state:record.payload};
  }
  async save(gameId:string,bytes:Uint8Array,expectedRevision:number,nowMs=Date.now()):Promise<number>{
    if(!gameId.trim()||!bytes.byteLength||bytes.byteLength>sizeLimit||!Number.isFinite(nowMs))
      throw new Error('Invalid Game Boy save state');
    const sha256=await digest(bytes);
    const stored=await this.store.write(stateKey(gameId),{
      gameId,sha256,bytes:bytes.slice(),createdAtMs:nowMs,
    } satisfies GameBoySaveState,expectedRevision);
    return stored.revision;
  }
}
