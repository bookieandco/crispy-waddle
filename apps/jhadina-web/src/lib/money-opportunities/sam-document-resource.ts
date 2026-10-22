// Governed SAM government-file boundary. API search URLs are references,
// not solicitation documents. Do not send API keys to metadata endpoints here.
export type SamDocumentLinkKind = 'file' | 'reference' | 'blocked'
export const SAM_MAX_DOCUMENT_BYTES = 10_000_000

export function classifySamDocumentLink(raw: string): SamDocumentLinkKind {
  let url: URL
  try { url = new URL(raw) } catch { return 'blocked' }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password ||
    !(host === 'sam.gov' || host.endsWith('.sam.gov') ||
      host.endsWith('.gsa.gov') || host.endsWith('.gov') || host.endsWith('.mil'))
  ) return 'blocked'
  const path = url.pathname.toLowerCase()
  if (path.includes('/opportunities/resources/files/') ||
      /\.(?:pdf|docx?|xlsx?|csv|zip|txt|xml|rtf|html?|json)$/.test(path)) return 'file'
  return 'reference'
}

export function isSamHtmlDocumentUrl(raw: string): boolean {
  try { return /\.html?$/.test(new URL(raw).pathname.toLowerCase()) }
  catch { return false }
}

/**
 * Stream with an absolute byte ceiling; Content-Length is only an early
 * rejection signal and not trusted as the actual response size.
 */
export async function readBoundedSamDocument(
  response: Response,
  input: { maxBytes?: number; url: string } ,
): Promise<Uint8Array> {
  const maximum = Math.min(SAM_MAX_DOCUMENT_BYTES, Math.max(1, input.maxBytes ?? SAM_MAX_DOCUMENT_BYTES))
  const declared = response.headers.get('content-length')
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) throw new Error('RESOURCE_INVALID_CONTENT_LENGTH')
    if (Number(declared) > maximum) throw new Error('RESOURCE_TOO_LARGE')
  }
  const chunks: Uint8Array[] = []
  let length = 0
  if (response.body) {
    const reader = response.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        if (length + value.byteLength > maximum) {
          await reader.cancel().catch(() => undefined)
          throw new Error('RESOURCE_TOO_LARGE')
        }
        chunks.push(value)
        length += value.byteLength
      }
    } finally { reader.releaseLock() }
  } else {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maximum) throw new Error('RESOURCE_TOO_LARGE')
    chunks.push(bytes)
    length = bytes.byteLength
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 256)))
    .trimStart().toLowerCase()
  const html = /^<(?:!doctype\s+html|html|head|body)\b/.test(head)
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if ((html || contentType.includes('text/html')) && !isSamHtmlDocumentUrl(input.url)) {
    throw new Error('RESOURCE_UNEXPECTED_HTML')
  }
  return bytes
}
