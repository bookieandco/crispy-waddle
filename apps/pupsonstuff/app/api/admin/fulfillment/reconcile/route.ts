import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminSession } from '@/lib/admin-auth';
import { reconcileFulfillment } from '@/lib/fulfillment-bridge';

export async function POST(request: NextRequest) {
  if (!isAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, ...(await reconcileFulfillment()) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Reconciliation failed.' },
      { status: 409 }
    );
  }
}
