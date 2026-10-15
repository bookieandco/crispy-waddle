import {describe,expect,it} from 'vitest';
import {
  compileWeeklySocialCampaignPacket,
  compileIdentityBoundWeeklySocialPacket,
  fingerprintWeeklySocialCampaignPacket,
  type WeeklySocialCampaign,
  type WeeklyDirectorProductionAction,
} from './index.js';

const profile={
  characterProfileRef:'character:atwood-bookie',
  voiceProfileRef:'brand-voice:atwood-bookie',
  evidenceRefs:['profile:owner-attested'],
};
const action:WeeklyDirectorProductionAction={
  id:'director:video1',campaignId:'campaign:single',
  brand:'atwood-bookie',kind:'director_production',profile,
  scheduledAt:'2026-10-19T17:00:00.000Z',
  requiredBy:'2026-10-19T16:00:00.000Z',
  evidenceRefs:['song:authorized','brief:version1'],
  socialContentProjectRef:'music:project',
  socialAssetRef:'asset:pending-review',
  directorProjectRef:'director:existing',
  productionBriefRef:'brief:version1',
};
const campaign:WeeklySocialCampaign={
  id:'campaign:single',brand:'atwood-bookie',name:'Review-only visual',
  objective:'Learn what creative connects',hypothesis:'Test one opening without publishing',
  profile,ownerIdeaRefs:['owner:idea1'],
  actionIds:[action.id],evidenceRefs:['song:authorized'],
};
const input={
  id:'weekly:single',ownerUserId:'owner1',
  weekStartsAt:'2026-10-18T00:00:00.000Z',
  weekEndsAt:'2026-10-25T00:00:00.000Z',
  createdAt:'2026-10-17T00:00:00.000Z',
  campaigns:[campaign],actions:[action],evidenceRefs:['song:authorized'],
};

describe('MUSIC-FINISH weekly packet source-only bridge',()=>{
  it('holds exact owner, creative and identity proposal fingerprints without execution rights',()=>{
    const packet=compileWeeklySocialCampaignPacket(input);
    expect(packet.authority).toBe('WEEKLY_CAMPAIGN_PROPOSAL_ONLY');
    expect(packet.externalActionAuthorized).toBe(false);
    expect(packet.fingerprint).toBe(fingerprintWeeklySocialCampaignPacket(packet));
    const bound=compileIdentityBoundWeeklySocialPacket({
      verifiedOwnerUserId:'owner1',packet,effectiveIdentities:[],
    });
    expect(bound.ownerUserId).toBe('owner1');
    expect(bound.requiresActionSecurityApproval).toBe(true);
    expect(bound.canExecute).toBe(false);
    expect(bound.canPublish).toBe(false);
    expect(bound.canSpend).toBe(false);
    expect(bound.canComment).toBe(false);
    expect(bound.packetFingerprint).toBe(packet.fingerprint);
  });
  it('rejects foreign owner, changed brief and unapproved dynamic action',()=>{
    const packet=compileWeeklySocialCampaignPacket(input);
    expect(()=>compileIdentityBoundWeeklySocialPacket({
      verifiedOwnerUserId:'owner2',packet,effectiveIdentities:[],
    })).toThrow('OWNER_MISMATCH');
    const altered={...packet,actions:[{...action,productionBriefRef:'brief:unexpected'}]};
    expect(()=>compileIdentityBoundWeeklySocialPacket({
      verifiedOwnerUserId:'owner1',packet:altered,effectiveIdentities:[],
    })).toThrow('PACKET_UNTRUSTED');
    expect(()=>compileWeeklySocialCampaignPacket({...input,actions:[action,{...action,id:'director:unreviewed'}]}))
      .toThrow('ACTION_SET_MISMATCH');
  });
});
