import {describe,expect,it} from 'vitest';
import {Ps5ExperimentalReferenceCatalog} from './ps5-experimental-catalog.js';
import {authorizePs5ExperimentalAction} from './ps5-experimental-policy.js';

describe('PS5 experimental policy',()=>{
  const catalog=new Ps5ExperimentalReferenceCatalog();

  it('requires experimental mode and explicit approval for allowed research actions',()=>{
    const reference=catalog.get('kyty')!;
    expect(authorizePs5ExperimentalAction({experimentalModeEnabled:false,explicitUserApproval:true,action:'emulator-launch',reference}).reason).toBe('experimental-mode-disabled');
    expect(authorizePs5ExperimentalAction({experimentalModeEnabled:true,explicitUserApproval:false,action:'emulator-launch',reference}).reason).toBe('explicit-approval-required');
    expect(authorizePs5ExperimentalAction({experimentalModeEnabled:true,explicitUserApproval:true,action:'emulator-launch',reference})).toEqual({allowed:true,reason:'authorized'});
  });

  it('never authorizes exploit or arbitrary payload execution through this lane',()=>{
    const reference=catalog.get('ps5-linux-loader')!;
    for(const action of ['payload-execute','exploit-run','privilege-escalate','auto-load-payload'] as const){
      expect(authorizePs5ExperimentalAction({experimentalModeEnabled:true,explicitUserApproval:true,action,reference})).toEqual({allowed:false,reason:'restricted-action'});
    }
  });

  it('does not let a metadata source masquerade as an executable runtime',()=>{
    const reference=catalog.get('ps5-payloads-mirror')!;
    expect(authorizePs5ExperimentalAction({experimentalModeEnabled:true,explicitUserApproval:true,action:'emulator-launch',reference})).toEqual({allowed:false,reason:'reference-safety-class-mismatch'});
  });
});
