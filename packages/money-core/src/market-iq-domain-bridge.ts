import {
  createCryptoObservation,
  createForexObservation,
  createPreciousMetalObservation,
  createSportsObservation,
  createStockObservation,
  type DomainObservationInput,
  type MarketObservation,
} from '@jhadina/market-intelligence-core'

export type MoneyMarketIqDomain = 'SPORTS' | 'STOCK' | 'CRYPTO' | 'FOREX' | 'PRECIOUS_METAL'

export type MoneyMarketIqDomainObservation = Readonly<{
  domain: MoneyMarketIqDomain
  observation: MarketObservation
  authority: 'INTELLIGENCE_ONLY'
  financialAuthority: 'NONE'
  canAuthorizeCapital: false
  canExecute: false
}>

function wrap(domain: MoneyMarketIqDomain, observation: MarketObservation): MoneyMarketIqDomainObservation {
  return Object.freeze({
    domain,
    observation,
    authority: 'INTELLIGENCE_ONLY',
    financialAuthority: 'NONE',
    canAuthorizeCapital: false,
    canExecute: false,
  })
}

export const buildSportsMarketIqObservation = (input: DomainObservationInput): MoneyMarketIqDomainObservation =>
  wrap('SPORTS', createSportsObservation(input))

export const buildStockMarketIqObservation = (input: DomainObservationInput): MoneyMarketIqDomainObservation =>
  wrap('STOCK', createStockObservation(input))

export const buildCryptoMarketIqObservation = (input: DomainObservationInput): MoneyMarketIqDomainObservation =>
  wrap('CRYPTO', createCryptoObservation(input))

export const buildForexMarketIqObservation = (input: DomainObservationInput): MoneyMarketIqDomainObservation =>
  wrap('FOREX', createForexObservation(input))

export const buildPreciousMetalMarketIqObservation = (input: DomainObservationInput): MoneyMarketIqDomainObservation =>
  wrap('PRECIOUS_METAL', createPreciousMetalObservation(input))
