/**
 * Server-only Gemini adapter.
 *
 * Reads GEMINI_API_KEY at runtime and never exposes it to client code.
 * This adapter deliberately sits behind Jhadina's server boundary; UI code
 * should call an API route rather than importing this module.
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

export interface GeminiGenerateInput {
  prompt: string
  systemInstruction?: string
  temperature?: number
  maxOutputTokens?: number
}

export interface GeminiGenerateResult {
  text: string
  model: string
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured")
  }
  return key
}

export async function generateWithGemini(
  input: GeminiGenerateInput
): Promise<GeminiGenerateResult> {
  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(getApiKey())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(input.systemInstruction
        ? { systemInstruction: { parts: [{ text: input.systemInstruction }] } }
        : {}),
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        maxOutputTokens: input.maxOutputTokens ?? 1024,
      },
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 500)}`)
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim()

  if (!text) {
    throw new Error("Gemini returned no text")
  }

  return { text, model: "gemini-2.5-flash" }
}
