import { NextResponse } from 'next/server';
import { createRemoteRuntime } from '@jhadina/capability-registry';

const runtime = createRemoteRuntime(
  {
    homeAssistant: process.env.HOME_ASSISTANT_TOKEN
      ? { authToken: process.env.HOME_ASSISTANT_TOKEN }
      : undefined,
  },
  {
    authorize: async () => true,
  },
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ status: 'rejected', requestId: '', reason: 'invalid-request' }, { status: 400 });
    }
    const result = await runtime.executor.execute({
      requestId: typeof body.requestId === 'string' ? body.requestId : '',
      deviceId: typeof body.deviceId === 'string' ? body.deviceId : '',
      capability: typeof body.capability === 'string' ? body.capability : '',
      payload: body.payload,
    });
    return NextResponse.json(result, { status: result.status === 'accepted' ? 200 : 403 });
  } catch {
    return NextResponse.json({ status: 'rejected', requestId: '', reason: 'invalid-json' }, { status: 400 });
  }
}
