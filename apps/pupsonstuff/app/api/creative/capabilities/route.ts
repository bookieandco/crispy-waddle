import { NextResponse } from 'next/server';
import { artStyles } from '@/types/boutique';
import { assertCreativeReady } from '@/lib/creative-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** No secret names/keys/URLs returned. This only informs the UI which
 * operations the server would admit BEFORE a customer selects photos. */
export async function GET() {
  const styles = artStyles
    .filter(style => {
      try { assertCreativeReady(style.id, 'keep'); return true; }
      catch { return false; }
    })
    .map(style => style.id);
  let backgroundRemoval = false;
  try {
    assertCreativeReady('ascii-art', 'auto');
    backgroundRemoval = true;
  } catch {
    backgroundRemoval = false;
  }
  return NextResponse.json({
    success:true,
    enabled:styles.length>0,
    styles,
    backgroundRemoval,
  }, {
    headers:{'Cache-Control':'private, no-store, max-age=0'},
  });
}
