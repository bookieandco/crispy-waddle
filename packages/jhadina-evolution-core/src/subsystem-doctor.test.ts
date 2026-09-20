import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { SubsystemDoctor, verifyBuilder210Acceptance } from './subsystem-doctor.js';

describe('SubsystemDoctor BUILDER.2.10 acceptance',()=>{
  it('diagnoses a harmless fixture failure, plans the smallest governed repair, and requires full verification',()=>{
    const doctor=new SubsystemDoctor();
    const hypothesis=doctor.diagnose('fixture',[{source:'test',subsystemId:'fixture',passed:false,summary:'fixture expectation mismatch'},{source:'ci',subsystemId:'fixture',passed:false,summary:'fixture expectation mismatch'}]);
    const plan=doctor.plan({hypothesis,allowedPaths:['/fixtures/builder-doctor'],targetedTests:['test:fixture'],regressionTests:['test:dependent'],securityChecks:['protected-paths','static-analysis'],risk:'low',requiresApproval:false});
    const result=verifyBuilder210Acceptance({hypothesis,plan,targetedPassed:true,regressionsPassed:true,protectedPathsPassed:true});
    assert.equal(hypothesis.confirmed,true);
    assert.deepEqual(plan.execution.testCommands,['test:fixture','test:dependent']);
    assert.equal(plan.rollbackRequired,true);
    assert.equal(result.receiptReady,true);
  });

  it('fails closed when root cause is not confirmed',()=>{
    const doctor=new SubsystemDoctor();
    const hypothesis=doctor.diagnose('fixture',[{source:'test',subsystemId:'fixture',passed:false,summary:'single signal'}]);
    assert.throws(()=>doctor.plan({hypothesis,allowedPaths:['/fixtures/builder-doctor'],targetedTests:[],regressionTests:[],securityChecks:[],risk:'low',requiresApproval:false}),/confirmed root-cause/);
  });

  it('does not produce a receipt when regression verification fails',()=>{
    const doctor=new SubsystemDoctor();
    const hypothesis=doctor.diagnose('fixture',[{source:'test',subsystemId:'fixture',passed:false,summary:'x'},{source:'ci',subsystemId:'fixture',passed:false,summary:'x'}]);
    const plan=doctor.plan({hypothesis,allowedPaths:['/fixtures/builder-doctor'],targetedTests:['test:fixture'],regressionTests:['test:dependent'],securityChecks:[],risk:'low',requiresApproval:false});
    assert.equal(verifyBuilder210Acceptance({hypothesis,plan,targetedPassed:true,regressionsPassed:false,protectedPathsPassed:true}).receiptReady,false);
  });
});
