import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const configured = typeof process.env.KAGGLE_API_TOKEN === "string" && process.env.KAGGLE_API_TOKEN.length > 0
  return NextResponse.json(
    {
      service: "sports-kaggle",
      configured,
      credential: "KAGGLE_API_TOKEN",
      secretValueExposed: false,
    },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  )
}
