export type DeviceCapability = 'tv-cast' | 'hdr' | '4k' | 'high-refresh' | 'rumble' | 'touch' | 'keyboard' | 'mouse' | 'audio' | 'network' | 'local-storage';

export interface DeviceState {
  capabilities: readonly DeviceCapability[];
  batteryPercent?: number;
  networkLatencyMs?: number;
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
  freeStorageMb?: number;
}

export interface RuntimeRequirements {
  requiredCapabilities?: readonly DeviceCapability[];
  networkRequired?: boolean;
  minFreeStorageMb?: number;
  maxLatencyMs?: number;
  allowCriticalThermal?: boolean;
}

export interface CapabilityDecision {
  allowed: boolean;
  reasons: readonly string[];
}

export function evaluateDevicePolicy(device: DeviceState, requirements: RuntimeRequirements = {}): CapabilityDecision {
  const reasons: string[] = [];
  for (const capability of requirements.requiredCapabilities ?? []) {
    if (!device.capabilities.includes(capability)) reasons.push(`missing capability: ${capability}`);
  }
  if (requirements.networkRequired && !device.capabilities.includes('network')) reasons.push('network required');
  if (requirements.minFreeStorageMb !== undefined && (device.freeStorageMb ?? 0) < requirements.minFreeStorageMb) reasons.push('insufficient free storage');
  if (requirements.maxLatencyMs !== undefined && (device.networkLatencyMs ?? Number.POSITIVE_INFINITY) > requirements.maxLatencyMs) reasons.push('network latency too high');
  if (!requirements.allowCriticalThermal && device.thermalState === 'critical') reasons.push('device thermal state is critical');
  return { allowed: reasons.length === 0, reasons };
}
