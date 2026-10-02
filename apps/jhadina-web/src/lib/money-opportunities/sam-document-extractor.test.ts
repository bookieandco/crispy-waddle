import { describe, expect, it } from 'vitest'
import { extractSamAttachmentText } from './sam-document-extractor'

const extensionlessSamUrl='https://sam.gov/api/prod/opps/v3/opportunities/resources/files/example/download'

describe('extractSamAttachmentText',()=>{
  it('sniffs extensionless PDF resources returned as application/octet-stream',()=>{
    const body=[
      '%PDF-1.7',
      '1 0 obj',
      'BT',
      '(Statement of Work requires delivery of tested supplies, quality records, monthly reporting, and contract-period support.) Tj',
      'ET',
      'endobj',
      '%%EOF',
    ].join('\n')
    const result=extractSamAttachmentText({
      bytes:new TextEncoder().encode(body),
      contentType:'application/octet-stream',
      sourceKind:'attachment',
      url:extensionlessSamUrl,
    })
    expect(result.status).toBe('parsed')
    expect(result.parser).toBe('pdf-text-operators')
    expect(result.text).toContain('Statement of Work requires delivery')
  })

  it('sniffs extensionless OOXML Word resources returned as application/octet-stream',()=>{
    const bytes=Buffer.from(
      'UEsDBBQAAAAIACIWQl27yCRlpQAAAOcAAAARAAAAd29yZC9kb2N1bWVudC54bWxFjsEOgjAQRH9l07ugN0MAb/6AGs/YLtJYunW7CPy9LR68vEl2ZjNTn5bRwQc5WvKNOhR7Beg1Geufjbpdz7ujOrX1XBnS04heIOV9rOZGLSrfH2TWrCGDM6S9SCe4hamHO/ELGN+TZYxg0NnUtmZHMAoaiFMIziav8wZG8jK4NT0EYkkjoCcGGRD6yTnQyeZOCwRkS6aoy9yXyRvDxt+m8j+6/QJQSwECFAMUAAAACAAiFkJdu8gkZaUAAADnAAAAEQAAAAAAAAAAAAAAgAEAAAAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAEAAQA/AAAA1AAAAAAA',
      'base64',
    )
    const result=extractSamAttachmentText({
      bytes,
      contentType:'application/octet-stream',
      sourceKind:'attachment',
      url:extensionlessSamUrl,
    })
    expect(result.status).toBe('parsed')
    expect(result.parser).toBe('docx-zip')
    expect(result.text).toContain('Statement of Work requires delivery')
  })
})
