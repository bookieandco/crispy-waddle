import {describe,expect,it} from 'vitest'
import {analyzeSyntheticVolumeEvidence} from '../synthetic-volume-diagnostics'

const base=Date.parse('2026-10-03T04:00:00Z')
const trade=(id:string,seconds:number,side:'BUY'|'SELL',quoteUsd:number,fundingGroupId?:string)=>({
  evidenceId:'e:'+id,walletId:'wallet:'+id,side,quoteUsd,fundingGroupId,
  observedAt:new Date(base+seconds*1000).toISOString(),
})

describe('synthetic volume diagnostics',()=>{
  it('derives diagnostics without inventing a wash-trading label',()=>{
    const result=analyzeSyntheticVolumeEvidence({
      trades:[
        trade('1',0,'BUY',100,'funder:a'),
        trade('2',10,'SELL',99,'funder:a'),
        trade('3',20,'BUY',100,'funder:a'),
        trade('4',30,'SELL',100,'funder:b'),
      ],
      totalVolumeUsd:100000,
      totalFeesUsd:25,
      liquidityUsd:5000,
    })
    expect(result.feeToVolumeRatio).toBe(.00025)
    expect(result.volumeToLiquidityRatio).toBe(20)
    expect(result.timingRegularity).toBe(1)
    expect(result.commonFundingGroupShare).toBe(.75)
    expect(result.mirroredTradeShare).toBe(1)
    expect(result.flags).toEqual([])
    expect(result.canLabelWashTrading).toBe(false)
    expect(result.canAuthorizeTrade).toBe(false)
  })

  it('only raises ratio/rhythm flags when calibrated thresholds are supplied',()=>{
    const result=analyzeSyntheticVolumeEvidence({
      trades:[
        trade('1',0,'BUY',100,'funder:a'),
        trade('2',10,'SELL',99,'funder:a'),
        trade('3',20,'BUY',100,'funder:a'),
        trade('4',30,'SELL',100,'funder:a'),
      ],
      totalVolumeUsd:100000,
      totalFeesUsd:25,
      liquidityUsd:5000,
      thresholds:{
        minFeeToVolumeRatio:.001,
        maxVolumeToLiquidityRatio:10,
        maxRepeatedBuySizeShare:.8,
        maxTimingRegularity:.9,
        maxCommonFundingGroupShare:.8,
        maxMirroredTradeShare:.8,
      },
    })
    expect(result.flags).toEqual(expect.arrayContaining([
      'fee-to-volume-below-calibrated-floor',
      'volume-to-liquidity-above-calibrated-ceiling',
      'repeated-buy-size-concentration',
      'transaction-timing-too-regular',
      'common-funding-group-concentration',
      'mirrored-buy-sell-pattern',
    ]))
  })

  it('fails closed on malformed observations and thresholds',()=>{
    expect(()=>analyzeSyntheticVolumeEvidence({trades:[]})).toThrow('trades_required')
    expect(()=>analyzeSyntheticVolumeEvidence({
      trades:[trade('1',0,'BUY',100)],
      thresholds:{minFeeToVolumeRatio:2},
    })).toThrow('threshold_invalid')
  })
})
