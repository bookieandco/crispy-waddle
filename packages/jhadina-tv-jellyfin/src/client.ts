import type { JellyfinApiTransport, JellyfinConnectionConfig } from './types';

export function createJellyfinTransport(config: JellyfinConnectionConfig): JellyfinApiTransport {
  const baseUrl = config.serverUrl.replace(/\/+$/, '');
  const clientName = config.clientName ?? 'JhadinaTV';
  const clientVersion = config.clientVersion ?? '0.1.0';
  const deviceId = config.deviceId ?? 'jhadina-tv';

  const authorization = [
    `MediaBrowser Client=\"${clientName}\"`,
    `Device=\"${deviceId}\"`,
    `DeviceId=\"${deviceId}\"`,
    `Version=\"${clientVersion}\"`,
    `Token=\"${config.accessToken}\"`,
  ].join(', ');

  async function request<T>(method: 'GET' | 'POST', path: string, query?: Record<string, string | number | boolean | undefined>, body?: unknown): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Jellyfin API request failed: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>) => request<T>('GET', path, query),
    post: <T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>) => request<T>('POST', path, query, body),
  };
}
