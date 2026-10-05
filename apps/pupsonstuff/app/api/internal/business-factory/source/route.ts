import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildPupsonBusinessFactoryProjection } from '@/lib/business-factory-projection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const secret = process.env.PUPSON_BUSINESS_FACTORY_TOKEN?.trim();
  const header = request.headers.get('authorization');
  if (!secret || !header?.startsWith('Bearer ')) return false;
  const supplied = header.slice('Bearer '.length).trim();
  if (!supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: NextRequest) {
  if (!process.env.PUPSON_BUSINESS_FACTORY_TOKEN?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Business Factory source projection is not configured.' },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    );
  }
  if (!authorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401, headers: { 'cache-control': 'no-store' } }
    );
  }

  const productId = request.nextUrl.searchParams.get('productId')?.trim() ?? '';
  const variantId = request.nextUrl.searchParams.get('variantId')?.trim() ?? '';
  if (!productId || !variantId) {
    return NextResponse.json(
      { success: false, error: 'productId and variantId are required.' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    );
  }

  try {
    const projection = await buildPupsonBusinessFactoryProjection({
      productId,
      variantId,
    });
    return NextResponse.json(
      { success: true, projection },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PUPSON_BUSINESS_FACTORY_PROJECTION_FAILED';
    const status = /NOT_FOUND/.test(message) ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status, headers: { 'cache-control': 'no-store' } }
    );
  }
}
