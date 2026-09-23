import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function repoFile(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8')
}

describe('GLOBAL-PROD.FINAL scheduler contract', () => {
  it('keeps sub-daily production schedules out of Vercel Hobby configuration', () => {
    const root = JSON.parse(repoFile('vercel.json')) as { crons?: unknown }
    const web = JSON.parse(repoFile('apps/jhadina-web/vercel.json')) as { crons?: unknown }

    expect(root.crons).toBeUndefined()
    expect(web.crons).toBeUndefined()
  })

  it('preserves every SHARK and SAM cadence in the GitHub production scheduler', () => {
    const workflow = repoFile('.github/workflows/jhadina-production-scheduler.yml')

    for (const schedule of [
      '0 * * * *',
      '30 * * * *',
      '5 */6 * * *',
      '20 */6 * * *',
      '35 */6 * * *',
      '50 */6 * * *',
    ]) {
      expect(workflow).toContain(`cron: "${schedule}"`)
    }

    for (const path of [
      '/api/internal/shark/launch-outcomes',
      '/api/internal/shark/historical-observations',
      '/api/internal/sam/scan?lookbackDays=2&maxPages=20',
      '/api/internal/sam/enrich?limit=5&maxDocuments=40&maxProviders=8',
      '/api/internal/sam/certify',
      '/api/internal/sam/bootstrap?historyDays=365&windowDays=7&maxWindows=4&maxPages=20',
    ]) {
      expect(workflow).toContain(path)
    }
  })

  it('uses GitHub OIDC instead of copying CRON_SECRET into Actions', () => {
    const workflow = repoFile('.github/workflows/jhadina-production-scheduler.yml')
    const auth = repoFile('apps/jhadina-web/src/lib/internal-scheduler-auth.ts')

    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain("core.getIDToken('jhadina-production-scheduler')")
    expect(workflow).not.toContain('secrets.CRON_SECRET')

    expect(auth).toContain('https://token.actions.githubusercontent.com/.well-known/jwks')
    expect(auth).toContain('bookieandco/crispy-waddle')
    expect(auth).toContain('refs/heads/main')
    expect(auth).toContain(
      'bookieandco/crispy-waddle/.github/workflows/jhadina-production-scheduler.yml@refs/heads/main',
    )
  })
})
