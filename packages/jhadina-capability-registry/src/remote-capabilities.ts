import type { CapabilityDefinition } from './index.js';

export const REMOTE_CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  ['remote.power','Power control','write'], ['remote.volume.up','Increase volume','write'], ['remote.volume.down','Decrease volume','write'],
  ['remote.channel.up','Next channel','write'], ['remote.channel.down','Previous channel','write'],
  ['remote.navigation.up','Navigate up','write'], ['remote.navigation.down','Navigate down','write'], ['remote.navigation.left','Navigate left','write'], ['remote.navigation.right','Navigate right','write'], ['remote.navigation.select','Select navigation item','write'], ['remote.navigation.back','Navigate back','write'], ['remote.navigation.home','Navigate home','write'],
  ['remote.media.play','Play media','write'], ['remote.media.pause','Pause media','write'], ['remote.media.stop','Stop media','write'], ['remote.media.previous','Previous media','write'], ['remote.media.next','Next media','write'], ['remote.media.rewind','Rewind media','write'], ['remote.media.fast_forward','Fast-forward media','write'],
  ['remote.input.select','Select input','write'], ['remote.menu.open','Open menu','write'], ['remote.settings.open','Open settings','write'], ['remote.keyboard.input','Send keyboard input','write'], ['remote.pointer.move','Move pointer','write'], ['remote.scene.execute','Execute remote scene','external'],
].map(([name, description, risk]) => ({ name, description, risk: risk as CapabilityDefinition['risk'], version: 1 }));

export function registerRemoteCapabilities(registry: { register(definition: CapabilityDefinition): void }): void {
  for (const definition of REMOTE_CAPABILITY_DEFINITIONS) registry.register(definition);
}
