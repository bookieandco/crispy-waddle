export interface BitaxeTelemetry {
  resourceId: string;
  observedAt: string;
  reachable: boolean;
  hostname?: string;
  ipv4?: string;
  macAddress?: string;
  firmwareVersion?: string;
  boardVersion?: string;
  asicModel?: string;
  hashRateGh?: number;
  hashRate1mGh?: number;
  hashRate10mGh?: number;
  hashRate1hGh?: number;
  expectedHashRateGh?: number;
  powerWatts?: number;
  temperatureC?: number;
  vrTemperatureC?: number;
  fanRpm?: number;
  fanSpeedPercent?: number;
  frequencyMhz?: number;
  actualFrequencyMhz?: number;
  voltageMv?: number;
  currentMa?: number;
  sharesAccepted?: number;
  sharesRejected?: number;
  sharesPending?: number;
  uptimeSeconds?: number;
  poolUrl?: string;
  poolPort?: number;
  poolUser?: string;
  networkDifficulty?: number;
  blockHeight?: number;
  blockFound?: number | boolean;
  miningPaused?: boolean;
}

export interface BitaxeHttpClient {
  getJson<T>(url: string, signal?: AbortSignal): Promise<T>;
}

export interface BitaxeAdapterConfig {
  baseUrl: string;
  resourceId: string;
  timeoutMs?: number;
}

interface AxeOsSystemInfo {
  hostname?: string;
  ipv4?: string;
  macAddr?: string;
  axeOSVersion?: string;
  version?: string;
  boardVersion?: string;
  ASICModel?: string;
  hashRate?: number;
  hashRate_1m?: number;
  hashRate_10m?: number;
  hashRate_1h?: number;
  expectedHashrate?: number;
  power?: number;
  temp?: number;
  vrTemp?: number;
  fanrpm?: number;
  fanspeed?: number;
  frequency?: number;
  actualFrequency?: number;
  voltage?: number;
  current?: number;
  sharesAccepted?: number;
  sharesRejected?: number;
  sharesPending?: number;
  uptimeSeconds?: number;
  stratumURL?: string;
  stratumPort?: number;
  stratumUser?: string;
  networkDifficulty?: number;
  blockHeight?: number;
  blockFound?: number | boolean;
  miningPaused?: boolean;
}

function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('INVALID_BITAXE_URL');
  }
  url.username = '';
  url.password = '';
  return url.toString().replace(/\/$/, '');
}

/** Read-only AxeOS adapter. It performs exactly one GET and never calls control endpoints. */
export async function readBitaxeTelemetry(
  client: BitaxeHttpClient,
  config: BitaxeAdapterConfig,
  signal?: AbortSignal,
): Promise<BitaxeTelemetry> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const info = await client.getJson<AxeOsSystemInfo>(`${baseUrl}/api/system/info`, signal);

  return {
    resourceId: config.resourceId,
    observedAt: new Date().toISOString(),
    reachable: true,
    hostname: info.hostname,
    ipv4: info.ipv4,
    macAddress: info.macAddr,
    firmwareVersion: info.axeOSVersion ?? info.version,
    boardVersion: info.boardVersion,
    asicModel: info.ASICModel,
    hashRateGh: info.hashRate,
    hashRate1mGh: info.hashRate_1m,
    hashRate10mGh: info.hashRate_10m,
    hashRate1hGh: info.hashRate_1h,
    expectedHashRateGh: info.expectedHashrate,
    powerWatts: info.power,
    temperatureC: info.temp,
    vrTemperatureC: info.vrTemp,
    fanRpm: info.fanrpm,
    fanSpeedPercent: info.fanspeed,
    frequencyMhz: info.frequency,
    actualFrequencyMhz: info.actualFrequency,
    voltageMv: info.voltage,
    currentMa: info.current,
    sharesAccepted: info.sharesAccepted,
    sharesRejected: info.sharesRejected,
    sharesPending: info.sharesPending,
    uptimeSeconds: info.uptimeSeconds,
    poolUrl: info.stratumURL,
    poolPort: info.stratumPort,
    poolUser: info.stratumUser,
    networkDifficulty: info.networkDifficulty,
    blockHeight: info.blockHeight,
    blockFound: info.blockFound,
    miningPaused: info.miningPaused,
  };
}

export function createFetchBitaxeClient(fetchImpl: typeof fetch = fetch): BitaxeHttpClient {
  return {
    async getJson<T>(url, signal) {
      const response = await fetchImpl(url, { method: 'GET', signal });
      if (!response.ok) throw new Error(`BITAXE_HTTP_${response.status}`);
      return response.json() as Promise<T>;
    },
  };
}
