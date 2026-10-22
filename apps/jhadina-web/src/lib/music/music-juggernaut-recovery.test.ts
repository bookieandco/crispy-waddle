import {describe, expect, it} from 'vitest';
import {buildMusicJuggernautRecovery, type MusicRecoveryEvidence} from './music-juggernaut-recovery';

const empty = (): MusicRecoveryEvidence => ({
  project:{id:'p',artist_key:'atwood-bookie'},
  songs:[],experiments:[],observations:[],rights:[],learning:[],
  platformAccounts:[],catalogReleases:[],royaltySnapshots:[],
  socialAccounts:[],musicSocialLineage:null,
  directorApprovedForMusic:null,verifiedProviderReadbacks:null,
  independentPhoneAcceptance:null,
});
const state = (result: ReturnType<typeof buildMusicJuggernautRecovery>, seq: string) =>
  result.stages.find(s => s.id.endsWith(seq))!.state;

describe('MUSIC-JUGGERNAUT.RECOVER.01-.08 — fail-closed recovery assessment', () => {
  it('distinguishes catalog inventory from commissioned production', () => {
    const e = empty();
    e.songs = Array.from({length:83},(_,n)=>({
      id:'song'+n,song_key:'catalog:'+n,title:'Song '+n,sections:[],rights_state:'review_required',
    }));
    e.catalogReleases = Array.from({length:22},(_,n)=>({id:'release'+n}));
    e.experiments = [{id:'e1',song_id:'song1',platform:'cross-platform-staging',status:'planned'}];
    const r = buildMusicJuggernautRecovery(e);
    expect(r.counts.songs).toBe(83);
    expect(r.counts.attributableExperiments).toBe(0);
    expect(state(r,'.01')).toBe('data_ready');
    expect(state(r,'.02')).toBe('blocked');
    expect(state(r,'.04')).toBe('unverified');
    expect(state(r,'.05')).toBe('unverified');
    expect(state(r,'.08')).toBe('unverified');
    expect(r.complete).toBe(false);
    expect(r.liveCampaignCertified).toBe(false);
    expect(r.externalActionsStarted).toBe(false);
  });

  it('requires evidence-backed song sections and rights, not catalog links', () => {
    const e = empty();
    e.songs = [{id:'s',song_key:'catalog:single',title:'Single',rights_state:'clear',
      sections:[{startMs:100,endMs:500,functions:['melody']}]}];
    e.catalogReleases = [{id:'release'}];
    e.platformAccounts = [{platform:'apple_music',verification_state:'verified',link_kind:'artist'}];
    e.rights = [{asset_key:'catalog:single',master_ownership_known:true,publishing_known:true,
      sample_status:'cleared',third_party_usage_status:'none',evidence_refs:['owner:clearance']}];
    const r = buildMusicJuggernautRecovery(e);
    expect(state(r,'.02')).toBe('data_ready');
    expect(state(r,'.03')).toBe('blocked');
    expect(r.liveCampaignCertified).toBe(false);
  });

  it('does not admit bot-heavy or staging observations, or cross-experiment learning', () => {
    const e = empty();
    e.songs = [{id:'s',song_key:'song',title:'Song',sections:[]}];
    e.socialAccounts = [{id:'a',status:'connected',platform:'instagram'}];
    e.experiments = [
      {id:'e',experiment_key:'actual',song_id:'s',platform:'instagram',status:'running'},
      {id:'draft',experiment_key:'staging',song_id:'s',platform:'cross-platform-staging',status:'planned'},
    ];
    e.observations = [{experiment_id:'e',exposures:500,attribution_confidence:0.99,
      bot_risk:0.9,evidence_refs:['provider:unreliable']}];
    e.learning = [{status:'validated',confidence:0.99,evidence_refs:['mock'],
      reusable_signals:{experimentId:'actual'}}];
    expect(state(buildMusicJuggernautRecovery(e),'.06')).toBe('blocked');
    e.observations = [{experiment_id:'e',exposures:500,bot_risk:0.05,
      attribution_confidence:0.9,evidence_refs:['provider:real']}];
    expect(state(buildMusicJuggernautRecovery(e),'.06')).toBe('data_ready');
    e.learning = [{status:'validated',confidence:0.99,evidence_refs:['other'],
      reusable_signals:{experimentId:'unrelated'}}];
    expect(state(buildMusicJuggernautRecovery(e),'.06')).toBe('blocked');
  });

  it('rejects synthetic final receipts as phone acceptance or provider readback', () => {
    const e = empty();
    e.catalogReleases = [{id:'release'}];
    e.platformAccounts = [{id:'catalog',platform:'youtube',verification_state:'verified'}];
    e.verifiedProviderReadbacks = [{status:'published',evidence_refs:['self-report']}];
    e.independentPhoneAcceptance = [{status:'passed',device:'iphone',
      external_provider_readback_verified:false,evidence_refs:['mock']}];
    e.musicSocialLineage = [{id:'lineage',user_id:'owner',project_id:'p',evidence_refs:['exp']}];
    expect(state(buildMusicJuggernautRecovery(e),'.05')).toBe('blocked');
    expect(state(buildMusicJuggernautRecovery(e),'.08')).toBe('blocked');
    expect(buildMusicJuggernautRecovery(e).liveCampaignCertified).toBe(false);
  });

  it('reports unknown privately gated sources as unverified instead of empty', () => {
    const e = empty();
    e.socialAccounts = null;
    expect(state(buildMusicJuggernautRecovery(e),'.03')).toBe('unverified');
  });
});
