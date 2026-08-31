import { NextResponse } from 'next/server';
import { createRemoteRuntime } from '@jhadina/capability-registry';
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
  return NextResponse.json({
    devices: runtime.devices.list().map(({ deviceId, entityId }) => ({ deviceId, entityId })),
  });
}
