import { describe,expect,it } from 'vitest'
import { parseSamAwardProviders } from './sam-award-client'

describe('SAM Contract Awards parser',()=>{
  it('extracts stable provider identity and winning-contract fingerprint fields',()=>{
    const parsed=parseSamAwardProviders({
      awardSummary:[{
        contractId:{piid:'P-1',modificationNumber:'0'},
        coreData:{
          federalOrganization:{contractingInformation:{
            contractingDepartment:{name:'GENERAL SERVICES ADMINISTRATION'},
            contractingOffice:{name:'CLOUD OFFICE'},
          }},
          productOrServiceInformation:{
            productOrService:{code:'D302'},
            principalNaics:[{code:'541512'}],
          },
          competitionInformation:{typeOfSetAside:{code:'SBA',name:'TOTAL SMALL BUSINESS SET-ASIDE'}},
        },
        awardDetails:{
          totalContractDollars:{totalActionObligation:'250000.00'},
          preferenceProgramsInformation:{contractingOfficerBusinessSizeDetermination:[{name:'SMALL BUSINESS'}]},
          awardeeData:{
            awardeeHeader:{legalBusinessName:'WINNER SYSTEMS LLC'},
            awardeeUEIInformation:{uniqueEntityId:'UEI123456789',cageCode:'1AB23'},
            awardeeLocation:{state:{code:'VA'}},
          },
        },
      }],
    })
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      providerName:'WINNER SYSTEMS LLC',
      uei:'UEI123456789',
      cage:'1AB23',
      state:'VA',
      naicsCodes:['541512'],
      pscCodes:['D302'],
      awardAmount:250000,
      awardId:'P-1:0',
    })
  })
})
