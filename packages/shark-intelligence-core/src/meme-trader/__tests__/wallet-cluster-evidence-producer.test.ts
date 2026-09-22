import {describe,expect,it} from 'vitest'
import {
  collectTrackedWalletBuysFromHelius,
  deriveWalletClusterCalibrationObservations,
  type WalletResearchScoreEvidence,
} from '../wallet-cluster-evidence-producer'

const score=(walletId:string,scoreValue:number,availableAt:string,informationCutoff='2026-09-01T00:00:00Z'):WalletResearchScoreEvidence=>({
  scoreId:`score:${walletId}:${availableAt}`,
  chainId:'solana-mainnet',
  walletId,
  scoreModelId:'wallet-score-v1',
  score:scoreValue,
  informationCutoff,
  observedAt:availableAt,
  availableAt,
  evidenceIds:[`score-evidence:${walletId}`],
  authority:'RESEARCH_ONLY',
})

describe('wallet cluster evidence producer',()=>{
  it('extracts a tracked-wallet buy only from explicit quote spend plus one token receipt',()=>{
    const buys=collectTrackedWalletBuysFromHelius({
      event:{
        signature:'sig-1',timestamp:Date.parse('2026-09-01T00:00:00Z')/1000,
        tokenTransfers:[
          {mint:'USDC',fromUserAccount:'WalletA',toUserAccount:'Pool',tokenAmount:100},
          {mint:'TOKEN',fromUserAccount:'Pool',toUserAccount:'WalletA',tokenAmount:1000},
        ],
      },
      chainId:'solana-mainnet',
      trackedWalletIds:['WalletA','WalletB'],
      quoteAssets:[{mint:'USDC',usdValuePerUnit:1}],
      availableAt:'2026-09-01T00:00:01Z',
    })
    expect(buys).toHaveLength(1)
    expect(buys[0]).toMatchObject({walletId:'WalletA',tokenAddress:'TOKEN',amountUsd:100})
    expect(buys[0]?.evidenceIds).toContain('solana-signature:sig-1')
  })

  it('does not allocate one quote spend across an ambiguous multi-token receipt',()=>{
    const buys=collectTrackedWalletBuysFromHelius({
      event:{
        signature:'sig-2',timestamp:Date.parse('2026-09-01T00:00:00Z')/1000,
        tokenTransfers:[
          {mint:'USDC',fromUserAccount:'WalletA',toUserAccount:'Pool',tokenAmount:100},
          {mint:'TOKEN1',fromUserAccount:'Pool',toUserAccount:'WalletA',tokenAmount:10},
          {mint:'TOKEN2',fromUserAccount:'Pool',toUserAccount:'WalletA',tokenAmount:20},
        ],
      },
      chainId:'solana-mainnet',
      trackedWalletIds:['WalletA'],
      quoteAssets:[{mint:'USDC',usdValuePerUnit:1}],
      availableAt:'2026-09-01T00:00:01Z',
    })
    expect(buys).toEqual([])
  })

  it('derives rolling cluster observations only from scores that were PIT-available at the signal',()=>{
    const buys=[
      {evidenceId:'b1',signature:'s1',chainId:'solana-mainnet',tokenAddress:'TOKEN',walletId:'W1',observedAt:'2026-09-01T00:00:10Z',availableAt:'2026-09-01T00:00:11Z',amountUsd:100,evidenceIds:['b1'],source:'fixture'},
      {evidenceId:'b2',signature:'s2',chainId:'solana-mainnet',tokenAddress:'TOKEN',walletId:'W2',observedAt:'2026-09-01T00:01:00Z',availableAt:'2026-09-01T00:01:01Z',amountUsd:200,evidenceIds:['b2'],source:'fixture'},
      {evidenceId:'b3',signature:'s3',chainId:'solana-mainnet',tokenAddress:'TOKEN',walletId:'W3',observedAt:'2026-09-01T00:03:00Z',availableAt:'2026-09-01T00:03:01Z',amountUsd:300,evidenceIds:['b3'],source:'fixture'},
    ] as const
    const scores=[
      score('W1',2,'2026-09-01T00:00:05Z','2026-09-01T00:00:05Z'),
      score('W2',3,'2026-09-01T00:00:30Z','2026-09-01T00:00:30Z'),
      // W3's score uses information from after the cluster signal and must not count.
      score('W3',9,'2026-09-01T00:02:00Z','2026-09-01T00:04:00Z'),
    ]
    const rows=deriveWalletClusterCalibrationObservations({
      chainId:'solana-mainnet',
      tokenAddress:'TOKEN',
      tokenId:'launch:solana-mainnet:TOKEN',
      scoreModelId:'wallet-score-v1',
      buys,
      scores,
      outcome:{
        tokenId:'launch:solana-mainnet:TOKEN',
        outcome:'HEALTHY',
        observedAt:'2026-09-02T00:00:00Z',
        availableAt:'2026-09-02T00:00:01Z',
        evidenceIds:['outcome:e1'],
      },
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({distinctWallets:2,windowSeconds:50,aggregateWalletScore:5,totalUsd:300,outcome:'HEALTHY',scoreModelId:'wallet-score-v1'})
    expect(rows[1]).toMatchObject({distinctWallets:2,aggregateWalletScore:5})
    expect(rows[0]?.availableAt).toBe('2026-09-02T00:00:01Z')
  })

  it('maps bad/failed launch labels to adverse calibration without authorizing execution',()=>{
    const rows=deriveWalletClusterCalibrationObservations({
      chainId:'solana-mainnet',tokenAddress:'TOKEN',tokenId:'launch:solana-mainnet:TOKEN',scoreModelId:'wallet-score-v1',
      buys:[
        {evidenceId:'b1',signature:'s1',chainId:'solana-mainnet',tokenAddress:'TOKEN',walletId:'W1',observedAt:'2026-09-01T00:00:10Z',availableAt:'2026-09-01T00:00:11Z',evidenceIds:['b1'],source:'fixture'},
        {evidenceId:'b2',signature:'s2',chainId:'solana-mainnet',tokenAddress:'TOKEN',walletId:'W2',observedAt:'2026-09-01T00:01:00Z',availableAt:'2026-09-01T00:01:01Z',evidenceIds:['b2'],source:'fixture'},
      ],
      scores:[score('W1',2,'2026-09-01T00:00:05Z','2026-09-01T00:00:05Z'),score('W2',3,'2026-09-01T00:00:30Z','2026-09-01T00:00:30Z')],
      outcome:{tokenId:'launch:solana-mainnet:TOKEN',outcome:'RUG',observedAt:'2026-09-02T00:00:00Z',availableAt:'2026-09-02T00:00:01Z',evidenceIds:['rug:e1']},
    })
    expect(rows[0]?.outcome).toBe('ADVERSE')
    expect(rows[0]?.evidenceIds).toEqual(expect.arrayContaining(['b1','b2','rug:e1','score-evidence:W1','score-evidence:W2']))
  })

  it('refuses unlabeled outcomes instead of freezing an UNKNOWN calibration record',()=>{
    expect(()=>deriveWalletClusterCalibrationObservations({
      chainId:'solana-mainnet',tokenAddress:'TOKEN',tokenId:'launch:solana-mainnet:TOKEN',scoreModelId:'wallet-score-v1',
      buys:[],scores:[],
      outcome:{tokenId:'launch:solana-mainnet:TOKEN',outcome:'UNKNOWN',observedAt:'2026-09-02T00:00:00Z',availableAt:'2026-09-02T00:00:01Z',evidenceIds:['unknown:e1']},
    })).toThrow('outcome_unlabeled')
  })
})
