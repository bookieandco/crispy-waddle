import { NextResponse } from 'next/server';
import { CapabilityRegistry, registerRemoteCapabilities } from '@jhadina/capability-registry';

const registry = new CapabilityRegistry();
registerRemoteCapabilities(registry);

export async function GET() {
  return NextResponse.json({
    capabilities: registry.list().map(({ name, description, risk, version }) => ({
      name,
      description,
      risk,
      version,
    })),
  });
}
