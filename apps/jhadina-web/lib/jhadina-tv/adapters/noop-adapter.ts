import type { MediaItem, TVDevice, TVDeviceAdapter } from '../types'

/** Safe development adapter. It never claims a real TV connection. */
export class NoopTVAdapter implements TVDeviceAdapter {
  readonly protocol = 'native' as const

  async discover(): Promise<TVDevice[]> { return [] }
  async connect(_deviceId: string): Promise<void> { throw new Error('No real TV adapter is configured') }
  async disconnect(_deviceId: string): Promise<void> { return }
  async play(_deviceId: string, _media: MediaItem): Promise<void> { throw new Error('No real TV adapter is configured') }
  async pause(_deviceId: string): Promise<void> { throw new Error('No real TV adapter is configured') }
  async seek(_deviceId: string, _positionSeconds: number): Promise<void> { throw new Error('No real TV adapter is configured') }
  async setVolume(_deviceId: string, _volume: number): Promise<void> { throw new Error('No real TV adapter is configured') }
}
