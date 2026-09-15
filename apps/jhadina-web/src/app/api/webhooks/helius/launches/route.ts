import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** SHARK launch ingestion is fail-closed until its provider package is restored. */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'shark_launch_ingestion_unavailable', reason: 'SHARK provider package is not deployed in this workspace' },
    { status: 503 },
  )
}
