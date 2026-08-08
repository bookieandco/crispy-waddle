import type { MediaItem, TVDevice, TVDeviceAdapter, TVDeviceProtocol } from './types'

export interface TVConnectionResult {
  ok: boolean
  deviceId: string
  protocol: TVDeviceProtocol
  message: string
}

/** Coordinates device connection/playback while keeping protocol details inside adapters. */
export class TVConnectionController {
  constructor(private readonly adapters: TVDeviceAdapter[]) {}

  private adapterFor(device: TVDevice): TVDeviceAdapter {
    const adapter = this.adapters.find((candidate) => candidate.protocol === device.protocol)
    if (!adapter) throw new Error(`No TV adapter is available for ${device.protocol}`)
    return adapter
  }

  async connect(device: TVDevice): Promise<TVConnectionResult> {
    await this.adapterFor(device).connect(device.id)
    return { ok: true, deviceId: device.id, protocol: device.protocol, message: `${device.name} connected` }
  }

  async disconnect(device: TVDevice): Promise<TVConnectionResult> {
    await this.adapterFor(device).disconnect(device.id)
    return { ok: true, deviceId: device.id, protocol: device.protocol, message: `${device.name} disconnected` }
  }

  async cast(device: TVDevice, media: MediaItem): Promise<TVConnectionResult> {
    if (!device.capabilities.canPlayVideo) {
      throw new Error(`${device.name} does not advertise video playback capability`)
    }
    await this.adapterFor(device).play(device.id, media)
    return { ok: true, deviceId: device.id, protocol: device.protocol, message: `${media.title} sent to ${device.name}` }
  }
}
