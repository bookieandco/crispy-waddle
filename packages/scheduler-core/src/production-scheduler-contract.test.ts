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

  it('keeps SHARK on the OIDC Vercel scheduler and SAM on the dedicated privileged commissioning workflow', () => {
    const scheduler = repoFile('.github/workflows/jhadina-production-scheduler.yml')
    const sam = repoFile('.github/workflows/sam-live-commissioning.yml')

    for (const schedule of ['0 * * * *', '5 * * * *', '10 * * * *', '30 * * * *', '15 */4 * * *', '15 3 * * *', '25 3 * * *', '40 3 * * *', '10 4 * * *', '45 * * * *', '55 * * * *', '20 */4 * * *', '35 * * * *', '50 * * * *']) {
      expect(scheduler).toContain(`cron: "${schedule}"`)
    }
    expect(scheduler).toContain('/api/internal/shark/launch-outcomes')
    expect(scheduler).toContain('/api/internal/shark/historical-observations')
    expect(scheduler).toContain('/api/internal/opportunities/public/scan')
    expect(scheduler).toContain('/api/internal/opportunities/public/jurisdictions')
    expect(scheduler).toContain('/api/internal/opportunities/public/buyer-registries')
    expect(scheduler).toContain('/api/internal/opportunities/public/source-discovery')
    expect(scheduler).toContain('/api/internal/opportunities/public/adapter-shadow')
    expect(scheduler).toContain('/api/internal/opportunities/public/awards')
    expect(scheduler).toContain('/api/internal/opportunities/public/work-package-providers')
    expect(scheduler).toContain('/api/internal/opportunities/public/prime-coverage')
    expect(scheduler).toContain('local-gov-production-convergence')
    expect(scheduler).toContain('batches=50')
    expect(scheduler).toContain('mode=converge')
    expect(scheduler).toContain('contains_expected')
    expect(scheduler).toContain('/compare/${EXPECTED_SHA}...${deployed_sha}')
    expect(scheduler).toContain('/api/internal/opportunities/government/demand-radar')
    expect(scheduler).toContain('/api/internal/opportunities/venture/scout')
    expect(scheduler).toContain('/api/internal/opportunities/venture/supervisor')
    expect(scheduler).toContain('/api/internal/relationships/worker')

    for (const staleSamRoute of [
      '/api/internal/sam/scan',
      '/api/internal/sam/enrich',
      '/api/internal/sam/certify',
      '/api/internal/sam/bootstrap',
    ]) {
      expect(scheduler).not.toContain(staleSamRoute)
    }

    expect(sam).toContain('cron: "11 */6 * * *"')
    expect(sam).toContain('id-token: write')
    expect(sam).toContain("core.getIDToken('jhadina-sam-runtime')")
    expect(sam).toContain("core.getIDToken('jhadina-sam-upstream')")
    expect(sam).not.toContain('secrets.SUPABASE_SERVICE_ROLE_KEY')
    expect(sam).not.toContain('secrets.SAM_GOV_API_KEY')
    expect(sam).not.toContain('secrets.sam_key')
    expect(sam).toContain('/api/health')
    expect(sam).toContain('apps/jhadina-web/scripts/sam-live-commissioning.ts')
  })

  it('uses GitHub OIDC for Vercel workers instead of copying CRON_SECRET into Actions', () => {
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
