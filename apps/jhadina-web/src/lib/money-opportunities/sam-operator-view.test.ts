import { describe,expect,it } from 'vitest'
import { buildSamOperatorView } from './sam-operator-view'
describe('SAM operator view',()=>{
 it('never turns review actions into execution authority',()=>{
  const view=buildSamOperatorView({
    opportunity:{id:'sam:1',title:'Test'} as never,
    requirements:{} as never,shortlist:[],
    fulfillment:{opportunityId:'sam:1',structure:'direct_fulfillment',assignments:[],coveredRequirementIds:[],uncoveredRequirementIds:[],blockers:[],rationale:[],requiresHumanApproval:true,engagementAuthorized:false},
    freshness:[],status:'ready_for_human_review',blockers:[],executionAuthorized:false,
  })
  expect(view.allowedActions).toContain('prepare_outreach')
  expect(view.bidSubmissionAuthorized).toBe(false)
  expect(view.outboundSendAuthorized).toBe(false)
  expect(view.contractExecutionAuthorized).toBe(false)
 })
})
