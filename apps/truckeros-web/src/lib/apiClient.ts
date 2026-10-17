/**
 * Tiny fetch wrapper for the app's own /api/* routes. Every route responds
 * with { success: true, data } or { success: false, error }; this unwraps
 * that and throws on failure so call sites can just `await`.
 */

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
}

async function unwrap<T>(response: Response): Promise<T> {
  const json = (await response.json()) as ApiEnvelope<T>
  if (!json.success) {
    throw new Error(json.error ?? `Request failed (${response.status})`)
  }
  return json.data as T
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url)
  return unwrap<T>(response)
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return unwrap<T>(response)
}
