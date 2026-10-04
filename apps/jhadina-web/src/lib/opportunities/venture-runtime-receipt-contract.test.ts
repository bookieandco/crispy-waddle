import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { VENTURE_RUNTIME_RECEIPT_KINDS } from './venture-runtime-repository'

describe('Venture runtime receipt persistence contract', () => {
  it('keeps the durable SQL kind constraint aligned with runtime receipt kinds', () => {
    const migration = readFileSync(
      fileURLToPath(new URL(
        '../../../../../supabase/migrations/20261004070000_venture_runtime_receipt_kind_reconciliation.sql',
        import.meta.url,
      )),
      'utf8',
    )

    for (const kind of VENTURE_RUNTIME_RECEIPT_KINDS) {
      expect(migration).toContain(`'${kind}'`)
    }
  })
})
