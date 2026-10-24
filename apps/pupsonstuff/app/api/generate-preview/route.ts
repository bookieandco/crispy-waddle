import { NextResponse } from 'next/server';

/** Retired: this older endpoint accepted unconsented photos, returned raw
 * base64 without private persistence, and could spend provider credits with
 * no owner-scoped job ledger. The canonical path is /api/creative/jobs.
 */
export async function POST() {
  return NextResponse.json({
    success:false,
    error:'This legacy image route is retired. Use the consented creative-job workflow.',
  }, {
    status:410,
    headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},
  });
}
