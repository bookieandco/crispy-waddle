/**
 * Illustrative PROFIT-POLICY.PAPER.01 for MEME-VENTURE.
 *
 * This is a read-only treasury-sale study, NOT a deployer, launch bot, selling
 * engine or profitability forecast. No wallet, RPC, balances or real fills.
 *
 * A token creator may not present hidden sales, fee sweeps or liquidity removal
 * as "profit-taking". Every hypothetical treasury slice must have an original
 * allocation, advance public disclosure and conservative sale/price-impact caps.
 */
import { simulateMemePool } from './meme-venture.js'

export const MEME_PAPER_TREASURY_LIMITS = Object.freeze({
  maxTotalFractionOfCreatorAllocation: 0.05,
  maxSaleFractionOfTotalSupply: 0.0025,
  maxPriceImpactBpsPerSale: 150,
  minDaysBetweenSales: 1,
  maxSales: 7,
  maxHorizonDays: 30,
})

export type MemeTreasuryPaperInput = {
  totalSupplyTokens: number
  creatorAllocationTokens: number
  poolReserveTokens: number
  poolReserveSol: number
  hypotheticalSolPriceUsd: number
  ammFeeBps: number
  assumedNetworkCostSolPerSale: number
  assumedCostBasisUsdPerToken: number
  estimatedBusinessOverheadUsd: number
  assumedTaxReservePercent: number
  schedulePubliclyDisclosed: boolean
  liquidityWithdrawalsForbidden: boolean
  inventedVolumeForbidden: boolean
  ownerAuthorizedPaperStudy: boolean
  plannedSales: readonly { day: number; tokens: number }[]
}

export type MemeTreasuryPaperSale = {
  day: number
  tokensSold: number
  simulatedGrossSol: number
  assumedTransactionCostSol: number
  simulatedNetSol: number
  simulatedNetUsdBeforeTaxReserve: number
  estimatedPriceImpactBps: number
  hypotheticalPoolSolAfter: number
  hypotheticalPoolTokensAfter: number
}

export type MemeTreasuryPaperResult = {
  mode: 'PAPER_ONLY'
  status: 'BLOCKED' | 'SIMULATED'
  refusals: string[]
  schedule: MemeTreasuryPaperSale[]
  hypotheticalTotalSoldTokens: number
  hypotheticalTotalNetProceedsUsdBeforeTaxReserve: number
  hypotheticalNetAfterTaxReserveUsd: number
  hypotheticalProfitBeforeTaxUsd: number
  hypotheticalRemainingTreasuryTokens: number
  hypothetical: true
  actualRevenueUsd: 0
  actualProfitUsd: 0
  anyExecutionAuthorized: false
  walletSigningAuthorized: false
  liquidityWithdrawalAuthorized: false
  hiddenSalesAuthorized: false
  automatedSalesAuthorized: false
  investmentReturnGuaranteed: false
}

function positiveFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(name + ' must be finite and positive')
}
function nonNegativeFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(name + ' must be finite and nonnegative')
}
const round = (v: number) => Math.round((v + Number.EPSILON) * 1e8) / 1e8

export function simulateDisclosedTreasuryProfitTaking(input: MemeTreasuryPaperInput): MemeTreasuryPaperResult {
  positiveFinite(input.totalSupplyTokens, 'totalSupplyTokens')
  positiveFinite(input.creatorAllocationTokens, 'creatorAllocationTokens')
  positiveFinite(input.poolReserveSol, 'poolReserveSol')
  positiveFinite(input.poolReserveTokens, 'poolReserveTokens')
  positiveFinite(input.hypotheticalSolPriceUsd, 'hypotheticalSolPriceUsd')
  nonNegativeFinite(input.ammFeeBps, 'ammFeeBps')
  nonNegativeFinite(input.assumedNetworkCostSolPerSale, 'assumedNetworkCostSolPerSale')
  nonNegativeFinite(input.assumedCostBasisUsdPerToken, 'assumedCostBasisUsdPerToken')
  nonNegativeFinite(input.estimatedBusinessOverheadUsd, 'estimatedBusinessOverheadUsd')
  nonNegativeFinite(input.assumedTaxReservePercent, 'assumedTaxReservePercent')
  if (input.creatorAllocationTokens > input.totalSupplyTokens) throw Error('Creator allocation exceeds total supply')
  if (!Number.isInteger(input.ammFeeBps) || input.ammFeeBps > 1000) throw Error('Invalid AMM fee')
  if (input.assumedTaxReservePercent > 100) throw Error('Invalid assumed tax reserve')
  if (!Array.isArray(input.plannedSales) || !input.plannedSales.length ||
      input.plannedSales.length > MEME_PAPER_TREASURY_LIMITS.maxSales) {
    throw Error('Planned sales must have 1-7 tranches')
  }

  const refusals: string[] = []
  if (!input.schedulePubliclyDisclosed) refusals.push('Public treasury sale schedule and allocation disclosures absent')
  if (!input.liquidityWithdrawalsForbidden) refusals.push('Liquidity withdrawals not explicitly prohibited')
  if (!input.inventedVolumeForbidden) refusals.push('Artificial volume and fabricated demand not explicitly prohibited')
  if (!input.ownerAuthorizedPaperStudy) refusals.push('Owner has not authorized this paper study')

  let totalScheduled = 0
  let lastDay = -1
  for (const sale of input.plannedSales) {
    positiveFinite(sale.tokens, 'scheduled tokens')
    if (!Number.isSafeInteger(sale.day) || sale.day < 1 ||
        sale.day > MEME_PAPER_TREASURY_LIMITS.maxHorizonDays ||
        sale.day - lastDay < MEME_PAPER_TREASURY_LIMITS.minDaysBetweenSales) {
      throw Error('Sales must occur on strictly increasing days within 30 days')
    }
    lastDay = sale.day
    totalScheduled += sale.tokens
    if (sale.tokens > input.totalSupplyTokens * MEME_PAPER_TREASURY_LIMITS.maxSaleFractionOfTotalSupply) {
      refusals.push('A planned slice exceeds 0.25% of total supply')
    }
  }
  if (totalScheduled > input.creatorAllocationTokens * MEME_PAPER_TREASURY_LIMITS.maxTotalFractionOfCreatorAllocation) {
    refusals.push('Scheduled sales exceed 5% of disclosed creator allocation')
  }
  if (totalScheduled > input.creatorAllocationTokens) refusals.push('Cannot sell more than creator allocation')

  const blocked = (more: string[] = []): MemeTreasuryPaperResult => ({
    mode: 'PAPER_ONLY',
    status: 'BLOCKED',
    refusals: [...new Set([...refusals, ...more])],
    schedule: [],
    hypotheticalTotalSoldTokens: 0,
    hypotheticalTotalNetProceedsUsdBeforeTaxReserve: 0,
    hypotheticalNetAfterTaxReserveUsd: 0,
    hypotheticalProfitBeforeTaxUsd: 0,
    hypotheticalRemainingTreasuryTokens: input.creatorAllocationTokens,
    hypothetical: true,
    actualRevenueUsd: 0,
    actualProfitUsd: 0,
    anyExecutionAuthorized: false,
    walletSigningAuthorized: false,
    liquidityWithdrawalAuthorized: false,
    hiddenSalesAuthorized: false,
    automatedSalesAuthorized: false,
    investmentReturnGuaranteed: false,
  })
  if (refusals.length) return blocked()

  let poolReserveSol = input.poolReserveSol
  let poolReserveTokens = input.poolReserveTokens
  let proceedsUsd = 0
  const receipts: MemeTreasuryPaperSale[] = []
  for (const sale of input.plannedSales) {
    const previousSpot = poolReserveSol / poolReserveTokens
    const paper = simulateMemePool({
      initialReserveSol: poolReserveSol,
      initialReserveTokens: poolReserveTokens,
      feeBps: input.ammFeeBps,
      paperTrades: [{ side: 'sell', amount: sale.tokens }],
    })
    const event = paper.receipts[0]
    const afterSpot = paper.spotPriceSolPerToken
    const priceImpactBps = (1 - afterSpot / previousSpot) * 10000
    if (!Number.isFinite(priceImpactBps) || priceImpactBps < 0 ||
        priceImpactBps > MEME_PAPER_TREASURY_LIMITS.maxPriceImpactBpsPerSale) {
      return blocked(['A slice exceeds the illustrative 150 bps price-impact ceiling'])
    }
    const netSol = event.amountOut - input.assumedNetworkCostSolPerSale
    if (netSol <= 0) return blocked(['Estimated transaction costs exceed paper proceeds'])
    const grossUsd = netSol * input.hypotheticalSolPriceUsd
    if (!Number.isFinite(grossUsd)) throw Error('Hypothetical paper proceeds overflow')
    proceedsUsd += grossUsd
    receipts.push({
      day: sale.day,
      tokensSold: sale.tokens,
      simulatedGrossSol: round(event.amountOut),
      assumedTransactionCostSol: round(input.assumedNetworkCostSolPerSale),
      simulatedNetSol: round(netSol),
      simulatedNetUsdBeforeTaxReserve: round(grossUsd),
      estimatedPriceImpactBps: round(priceImpactBps),
      hypotheticalPoolSolAfter: round(paper.reserveSol),
      hypotheticalPoolTokensAfter: round(paper.reserveTokens),
    })
    poolReserveSol = paper.reserveSol
    poolReserveTokens = paper.reserveTokens
  }
  const basis = totalScheduled * input.assumedCostBasisUsdPerToken
  const illustrativeProfit = proceedsUsd - basis - input.estimatedBusinessOverheadUsd
  if (!Number.isFinite(illustrativeProfit)) throw Error('Hypothetical paper profit overflow')
  const afterReserve = proceedsUsd - Math.max(0, illustrativeProfit) * input.assumedTaxReservePercent / 100
  return {
    mode: 'PAPER_ONLY',
    status: 'SIMULATED',
    refusals: [],
    schedule: receipts,
    hypotheticalTotalSoldTokens: totalScheduled,
    hypotheticalTotalNetProceedsUsdBeforeTaxReserve: round(proceedsUsd),
    hypotheticalNetAfterTaxReserveUsd: round(afterReserve),
    hypotheticalProfitBeforeTaxUsd: round(illustrativeProfit),
    hypotheticalRemainingTreasuryTokens: input.creatorAllocationTokens - totalScheduled,
    hypothetical: true,
    actualRevenueUsd: 0,
    actualProfitUsd: 0,
    anyExecutionAuthorized: false,
    walletSigningAuthorized: false,
    liquidityWithdrawalAuthorized: false,
    hiddenSalesAuthorized: false,
    automatedSalesAuthorized: false,
    investmentReturnGuaranteed: false,
  }
}
