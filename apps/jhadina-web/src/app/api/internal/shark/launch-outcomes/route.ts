import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** SHARK outcome evaluation is fail-closed until its provider package is restored. */
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: 'shark_launch_outcomes_unavailable', reason: 'SHARK provider package is not deployed in this workspace' },
    { status: 503 },
  )
}

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'shark_launch_outcomes_unavailable', reason: 'SHARK provider package is not deployed in this workspace' },
    { status: 503 },
  )
}
