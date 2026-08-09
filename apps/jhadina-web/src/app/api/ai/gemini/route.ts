import { NextRequest, NextResponse } from "next/server"
import { generateWithGemini } from "@/lib/ai/GeminiAdapter"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      prompt?: unknown
      systemInstruction?: unknown
    }

    if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 })
    }

    const result = await generateWithGemini({
      prompt: body.prompt.trim(),
      systemInstruction:
        typeof body.systemInstruction === "string"
          ? body.systemInstruction
          : undefined,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Gemini API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gemini request failed" },
      { status: 500 }
    )
  }
}
