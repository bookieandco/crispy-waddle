import {describe,expect,it} from 'vitest';
import {GamingPermissionIsolation,GamingSupplyChainGate} from './gaming-supply-chain.js';

describe('G23 gaming supply-chain certification',()=>{
  it('requires provenance, license, digest and approval for executable artifacts',()=>{
    const gate=new GamingSupplyChainGate();
    expect(gate.verify({artifactId:'core',kind:'emulator-core',version:'1',digest:'sha256:abcdef',sourceRepository:'owner/repo',licenseId:'GPL-3.0',provenanceVerified:true,executable:true,explicitApproval:false}).reason).toBe('explicit-approval-required');
    expect(gate.verify({artifactId:'core',kind:'emulator-core',version:'1',digest:'sha256:abcdef',sourceRepository:'owner/repo',licenseId:'GPL-3.0',provenanceVerified:true,executable:true,explicitApproval:true}).allowed).toBe(true);
  });

  it('keeps Steam, PlayStation and Xbox grants isolated',()=>{
    const permissions=new GamingPermissionIsolation();
    permissions.grant('steam','achievement-write');
    expect(()=>permissions.assertNoInheritance('steam','playstation','achievement-write')).toThrow('does not authorize');
    expect(permissions.has('playstation','achievement-write')).toBe(false);
  });
});
