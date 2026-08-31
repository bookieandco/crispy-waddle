import { NextResponse } from 'next/server';
import { createRemoteRuntime } from '@jhadina/capability-registry';
import { listRemoteCapabilityAvailability } from '@jhadina/capability-registry/remote-capability-availability';
import { RemoteDevelopmentPolicy } from '@jhadina/capability-registry/remote-development-policy';

const runtime = createRemoteRuntime(
  {
    homeAssistant: process.env.HOME_ASSISTANT_TOKEN
      ? { authToken: process.env.HOME_ASSISTANT_TOKEN }
      : undefined,
  },
  new RemoteDevelopmentPolicy(),
);

export async function GET(request: Request) {
  const deviceId = new URL(request.url).searchParams.get('deviceId');
  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }

  if (!runtime.devices.list().some(device => device.deviceId === deviceId)) {
    return NextResponse.json({ error: 'unknown device' }, { status: 404 });
  }

  const availability = new Map(
    listRemoteCapabilityAvailability(runtime.capabilities, runtime.transports, deviceId)
      .map(item => [item.name, item.available]),
  );

  return NextResponse.json({
    deviceId,
    capabilities: runtime.capabilities.list().map(({ name, description, risk, version }) => ({
      name,
      description,
      risk,
      version,
      available: availability.get(name) ?? false,
    })),
  });
}
