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

export async function GET() {
  const availability = new Map(
    listRemoteCapabilityAvailability(runtime.capabilities, runtime.transports, 'tv-1')
      .map(item => [item.name, item.available]),
  );

  return NextResponse.json({
    capabilities: runtime.capabilities.list().map(({ name, description, risk, version }) => ({
      name,
      description,
      risk,
      version,
      available: availability.get(name) ?? false,
    })),
  });
}
