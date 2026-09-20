import { adaptCommercialOpportunity } from './commercial.js'
import { adaptEmploymentOpportunity } from './employment.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const job = adaptEmploymentOpportunity({
  providerId: 'provider:placement-jobs',
  externalId: 'job-1',
  title: 'AI workflow contractor',
  sourceUrl: 'https://example.test/jobs/1',
  sourceName: 'Fixture jobs',
  kind: 'ai_job',
  confidence: 0.7,
})
assert(job.family === 'employment' && job.type === 'job', 'AI job must normalize to employment/job')
assert(job.status === 'discovered', 'Raw employment listing must remain discovered')
assert(job.verificationStatus === 'unverified', 'Raw employment listing must not manufacture verification')

const affiliate = adaptCommercialOpportunity({
  providerId: 'provider:growth-affiliate',
  externalId: 'offer-1',
  kind: 'affiliate',
  title: 'Affiliate fixture',
  sourceUrl: 'https://example.test/offers/1',
  sourceName: 'Fixture affiliate source',
  confidence: 0.6,
})
assert(affiliate.family === 'business' && affiliate.type === 'commercial', 'Affiliate candidate must normalize to business/commercial')
assert(affiliate.metadata?.opportunityKind === 'affiliate', 'Affiliate UI kind must survive normalization')

const pod = adaptCommercialOpportunity({
  providerId: 'provider:pupsonstuff-pod',
  externalId: 'product-1',
  kind: 'pod',
  title: 'POD fixture',
  sourceUrl: 'https://example.test/products/1',
  sourceName: 'POD fixture',
})
assert(pod.family === 'commerce', 'POD must normalize to commerce family')

const dropship = adaptCommercialOpportunity({
  providerId: 'provider:commerce-dropshipping',
  externalId: 'supplier-1',
  kind: 'dropshipping',
  title: 'Dropship fixture',
  sourceUrl: 'https://example.test/suppliers/1',
  sourceName: 'Supplier fixture',
})
assert(dropship.metadata?.commercialKind === 'dropshipping', 'Dropshipping source kind must remain explicit')
