import { NextResponse } from "next/server"
import { JanetGitHubCodebaseProvider } from "../../../../src/lib/services/JanetGitHubCodebaseProvider"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const objective = url.searchParams.get("objective") || undefined
  const owner = process.env.JANET_CODEBASE_OWNER || "bookieandco"
  const repo = process.env.JANET_CODEBASE_REPO || "crispy-waddle"
  const ref = process.env.JANET_CODEBASE_REF || "main"

  try {
    const provider = new JanetGitHubCodebaseProvider({ owner, repo, ref, token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN })
    const context = await provider.getContext({ userId: "system", objective })
    return NextResponse.json({ ok: true, context })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Codebase context unavailable" }, { status: 502 })
  }
}
