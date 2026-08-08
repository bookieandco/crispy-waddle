import { mockTVDevices } from './mock-devices'
import type { TVDevice } from './types'

export interface DevicePickerItem {
  device: TVDevice
  label: string
  status: 'ready' | 'connected' | 'unavailable'
  transportLabel: string
}

export function buildDevicePickerModel(devices: TVDevice[] = mockTVDevices): DevicePickerItem[] {
  return devices.map((device) => ({
    device,
    label: device.name,
    status: device.connected ? 'connected' : 'ready',
    transportLabel:
      device.protocol === 'bluetooth'
        ? 'Bluetooth control'
        : device.protocol === 'google-cast'
          ? 'Google Cast'
          : device.protocol === 'airplay'
            ? 'AirPlay'
            : device.protocol === 'dlna'
              ? 'DLNA'
              : 'TV adapter',
  }))
}
