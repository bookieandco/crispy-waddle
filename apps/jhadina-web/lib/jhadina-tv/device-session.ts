import type { TVDevice } from './types'

export interface TVDeviceSession {
  deviceId: string
  connectedAt: string
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
}

const sessions = new Map<string, TVDeviceSession>()

export function markConnected(device: TVDevice): TVDeviceSession {
  const session: TVDeviceSession = {
    deviceId: device.id,
    connectedAt: new Date().toISOString(),
    connectionStatus: 'connected',
  }
  sessions.set(device.id, session)
  return session
}

export function markDisconnected(deviceId: string): void {
  sessions.set(deviceId, {
    deviceId,
    connectedAt: sessions.get(deviceId)?.connectedAt ?? new Date().toISOString(),
    connectionStatus: 'disconnected',
  })
}

export function getDeviceSession(deviceId: string): TVDeviceSession | undefined {
  return sessions.get(deviceId)
}
