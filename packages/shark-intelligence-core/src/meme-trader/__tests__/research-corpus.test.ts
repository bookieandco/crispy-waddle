import {describe,expect,it} from 'vitest'
import {
  MAKE_IT_MAKE_SENSE_STAGES,
  SHARK_CHAT_CORPUS_AUTHORITY,
  SHARK_CHAT_RESEARCH_MODULES,
  canAdvanceResearchEvidence,
  summarizeSourceIndependence,
  type ResearchSourceObservation,
} from '../research-corpus'

describe('SHARK chat research corpus',()=>{
  it('keeps module ids unique and cannot grant financial authority',()=>{
    const ids=SHARK_CHAT_RESEARCH_MODULES.map(item=>item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(SHARK_CHAT_RESEARCH_MODULES.length).toBeGreaterThanOrEqual(60)
    for(const item of SHARK_CHAT_RESEARCH_MODULES){
      expect(item.authority.financialExecution).toBe('NONE')
      expect(item.authority.capitalAccess).toBe('NONE')
      expect(item.authority.protectedFunds).toBe('NONE')
      expect(item.authority.walletSigning).toBe('NONE')
    }
    expect(SHARK_CHAT_CORPUS_AUTHORITY.role).toBe('RESEARCH_ONLY')
  })

  it('preserves the major transcript-audit research families',()=>{
    const ids=new Set(SHARK_CHAT_RESEARCH_MODULES.map(item=>item.id))
    for(const required of [
      'AXIOM_COMMUNITY_DIP_SCALP_V1',
      'MEME_MANIPULATION_PLAYBOOK_V1',
      'CHART_ONCHAIN_FUSION_V1',
      'REGIME_ADAPTIVE_RETRACE_V1',
      'SOURCE_DEDUP_PROVENANCE_V1',
      'MACRO_EASY_MODE_REGIME_V1',
      'CALLER_ENSEMBLE_AUTOBOT_V1',
      'ATTENTION_CAPITAL_ENGINE_V1',
      'MONEY_STRATEGY_FACTORY_V1',
      'SHARK_STRATEGY_FACTORY_1',
    ])expect(ids.has(required)).toBe(true)
  })

  it('does not let duplicate or derivative copies inflate independent evidence',()=>{
    const observations:ResearchSourceObservation[]=[
      {
        observationId:'pump-sniper:video-a',sourceFamilyId:'pump-sniper-marketing-script',sourceVersionId:'v3.2-a',
        independentGroup:'pump-sniper-origin',relationship:'COMMON_ORIGIN',claimIds:['pump-sniper:latency'],
        promotionalPressure:['affiliate-link','free-trial'],authority:'EVIDENCE_ONLY',canAuthorizeTrade:false,
      },
      {
        observationId:'pump-sniper:video-b',sourceFamilyId:'pump-sniper-marketing-script',sourceVersionId:'v3.2-b',
        independentGroup:'pump-sniper-origin',relationship:'TRANSCRIPT_VARIANT',claimIds:['pump-sniper:latency'],
        promotionalPressure:['affiliate-link','free-trial'],authority:'EVIDENCE_ONLY',canAuthorizeTrade:false,
      },
      {
        observationId:'pump-sniper:affiliate-rewrite',sourceFamilyId:'pump-sniper-marketing-script',sourceVersionId:'affiliate-1',
        independentGroup:'pump-sniper-origin',relationship:'AFFILIATE_DERIVATIVE',claimIds:['pump-sniper:latency'],
        promotionalPressure:['affiliate-link'],authority:'EVIDENCE_ONLY',canAuthorizeTrade:false,
      },
    ]
    expect(summarizeSourceIndependence(observations)).toEqual({rawSourceCount:3,independentEvidenceCount:1})
  })

  it('counts truly independent corroboration separately',()=>{
    const observations:ResearchSourceObservation[]=[
      {
        observationId:'source-a',sourceFamilyId:'family-a',sourceVersionId:'1',independentGroup:'origin-a',
        relationship:'COMMON_ORIGIN',claimIds:['claim-1'],promotionalPressure:[],authority:'EVIDENCE_ONLY',canAuthorizeTrade:false,
      },
      {
        observationId:'source-b',sourceFamilyId:'family-b',sourceVersionId:'1',independentGroup:'origin-b',
        relationship:'INDEPENDENT_CORROBORATION',claimIds:['claim-1'],promotionalPressure:[],authority:'EVIDENCE_ONLY',canAuthorizeTrade:false,
      },
    ]
    expect(summarizeSourceIndependence(observations)).toEqual({rawSourceCount:2,independentEvidenceCount:2})
  })

  it('keeps paper and shadow evidence states distinct',()=>{
    expect(canAdvanceResearchEvidence('UNVERIFIED_SOURCE_CLAIM','MULTIPLE_INDEPENDENT_SOURCES')).toBe(true)
    expect(canAdvanceResearchEvidence('PRIMARY_DATA_SUPPORTED','REPRODUCED_IN_PAPER')).toBe(true)
    expect(canAdvanceResearchEvidence('REPRODUCED_IN_PAPER','REPRODUCED_IN_SHADOW')).toBe(true)
    expect(canAdvanceResearchEvidence('REPRODUCED_IN_SHADOW','REPRODUCED_IN_PAPER')).toBe(false)
    expect(canAdvanceResearchEvidence('STATISTICALLY_VALIDATED','STATISTICALLY_VALIDATED')).toBe(false)
  })

  it('runs MAKE IT MAKE SENSE at hypothesis, trade and performance stages',()=>{
    expect(MAKE_IT_MAKE_SENSE_STAGES.map(item=>item.stage)).toEqual(['HYPOTHESIS','TRADE','PERFORMANCE'])
  })
})
