import { describe,expect,it } from 'vitest'
import { projectSamCommandCenter } from './sam-command-center'

describe('SAM Federal Contracts projection',()=>{
  it('joins contract, requirements, providers, team and commercial readiness without authority',()=>{
    const result=projectSamCommandCenter({
      catalog:[{
        notice_id:'N1',solicitation_number:'SOL-1',title:'Refrigerated food delivery',
        agency:'Department of Defense',office:'DLA',posted_date:'2026-09-20',
        response_deadline:'2026-10-15',naics_codes:['424410'],classification_codes:['89'],
        set_aside:'Total Small Business',source_url:'https://sam.gov/opp/N1/view',version:2,last_seen_at:'2026-09-21T20:00:00Z',
      }],
      analyses:[{
        notice_id:'N1',
        requirements:[{id:'r-food',label:'Contractor shall provide refrigerated food.',sourceRef:'sam:notice:N1',confidence:.8}],
        subcontractability:{status:'conditional',hardBlockers:[],conditions:['Verify product origin.'],detectedRules:['limitations-on-subcontracting analysis required']},
        operating:{capture:{stage:'solicitation',captureValue:'medium',awardReadiness:'ready_for_pursuit',reasons:['Active procurement evidence supports near-term pursuit decisions.']}},
      }],
      providers:[
        {notice_id:'N1',requirement_id:'r-food',provider_key:'foodco',provider_name:'Food Co',country:'USA',uei:'UEI1',score:91,status:'candidate',sources:['sam_entity','usaspending']},
      ],
      pursuits:[{
        notice_id:'N1',status:'review_required',
        assignments:[{providerKey:'foodco',providerName:'Food Co',requirementIds:['r-food'],sourceTypes:['sam_entity','usaspending'],score:91,reviewRequired:true}],
        uncovered_requirement_ids:[],
        quote_targets:[{providerKey:'foodco',providerName:'Food Co',requirementIds:['r-food'],status:'quote_required'}],
        provider_bench:[{requirementId:'r-food',targetCandidateCount:5,candidateCount:1,corroboratedCount:1,qualifiedCount:1,status:'DISCOVERY_INCOMPLETE',blockers:['Qualified provider coverage 1/5 is below target and market constraint is not evidenced.']}],
        commercial:{status:'review_required',contractValue:500000,providerCost:null,estimatedGrossProfit:null,estimatedMarginPercent:null,blockers:['Evidence-backed provider quote costs have not been collected.'],assumptions:['No margin is inferred before a quote.']},
        blockers:[],
      }],
    })
    expect(result.summary.total).toBe(1)
    expect(result.summary.providers).toBe(1)
    expect(result.items[0].requirements[0].label).toContain('refrigerated food')
    expect(result.items[0].providers[0].sourceTypes).toEqual(['sam_entity','usaspending'])
    expect(result.items[0].assignments[0].providerName).toBe('Food Co')
    expect(result.items[0].commercial.contractValue).toBe(500000)
    expect(result.items[0].providerBench[0]).toMatchObject({requirementId:'r-food',targetCandidateCount:5,qualifiedCount:1,status:'DISCOVERY_INCOMPLETE'})
    expect(result.items[0].capture).toEqual({stage:'solicitation',captureValue:'medium',awardReadiness:'ready_for_pursuit',reasons:['Active procurement evidence supports near-term pursuit decisions.']})
    expect(result.items[0].commercial.providerCost).toBeNull()
    expect(result.items[0].authority).toEqual({
      humanApprovalRequired:true,
      outreachAuthorized:false,
      bidSubmissionAuthorized:false,
      contractExecutionAuthorized:false,
      paymentAuthorized:false,
    })
  })

  it('shows discovered notices even before enrichment finishes',()=>{
    const result=projectSamCommandCenter({
      catalog:[{notice_id:'N2',title:'Office supplies',source_url:'https://sam.gov/opp/N2/view',naics_codes:['424120'],classification_codes:[],version:1}],
      analyses:[],providers:[],pursuits:[],
    })
    expect(result.items[0].pursuitStatus).toBe('not_generated')
    expect(result.items[0].subcontractability.status).toBe('unknown')
    expect(result.items[0].capture.stage).toBe('unknown')
    expect(result.items[0].providers).toEqual([])
    expect(result.items[0].providerBench).toEqual([])
    expect(result.summary.reviewRequired).toBe(1)
  })
})
