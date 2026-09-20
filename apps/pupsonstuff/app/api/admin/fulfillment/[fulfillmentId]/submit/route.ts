import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminSession } from '@/lib/admin-auth';
import { submitFulfillment } from '@/lib/fulfillment-bridge';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ fulfillmentId: string }> }
) {
  if (!isAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  try {
    const { fulfillmentId } = await context.params;
    const result = await submitFulfillment(fulfillmentId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fulfillment failed.' },
      { status: 409 }
    );
  }
}
