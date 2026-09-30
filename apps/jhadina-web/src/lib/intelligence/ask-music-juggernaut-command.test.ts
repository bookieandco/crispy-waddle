import {describe,expect,it} from 'vitest';
import type {MusicJuggernautRepository} from '../music/music-juggernaut-repository';
import {handleAskMusicJuggernautCommand,inspectAskMusicJuggernautIntent} from './ask-music-juggernaut-command';

class Repo implements MusicJuggernautRepository{
  project:Record<string,unknown>|null=null;
  async getProject(){return this.project;}
  async upsertProject(input:{artistKey:string;name:string;mode:'SEARCH'|'ATTACK';metadata?:Record<string,unknown>}){this.project={id:'p1',artist_key:input.artistKey,name:input.name,mode:input.mode};return this.project;}
  async listSongs(){return [{id:'s1',song_key:'song-1',title:'Song One',release_status:'released',campaign_state:'EXPLORING',artist_conviction:0.9,rights_state:'clear',sections:[],evidence_refs:['song:e1']}];}
  async listExperiments(){return [{id:'db-exp',experiment_key:'exp-1',song_id:'s1',hypothesis:'test',content_family:'performance',platform:'tiktok',spend_minor:0,currency:'USD',sample_target:100,success_signal:'song action lift',failure_signal:'no lift',status:'running',evidence_refs:['exp:e1']}];}
  async listObservations(){return [{id:'o1',experiment_id:'db-exp',exposures:1000,views:700,shares:10,saves:20,comments:10,profile_visits:30,song_actions:50,direct_fan_captures:5,bot_risk:0,attribution_confidence:0.9,observed_at:'2026-09-30T00:00:00Z',evidence_refs:['obs:e1']}];}
  async listCityDemand(){return [{id:'c1',city_name:'Los Angeles',listeners:1000,direct_fans:50,show_interest:50,prior_attendees:20,repeat_fans:15,evidence_refs:['city:e1']}];}
  async listRights(){return [{id:'r1',sample_status:'none',third_party_usage_status:'none',master_ownership_known:true,publishing_known:true,evidence_refs:['rights:e1']}];}
  async listLearning(){return [];}
  async upsertSong(){return {};} async upsertExperiment(){return {};} async recordObservation(){return {};} async upsertCityDemand(){return {};} async upsertRights(){return {};} async upsertLearning(){return {};}
}

describe('Ask Music Juggernaut',()=>{
  it('does not steal direct marketing execution from Presence',()=>{
    expect(inspectAskMusicJuggernautIntent('promote my new song')).toBeNull();
  });
  it('recognizes catalog and live-demand questions',()=>{
    expect(inspectAskMusicJuggernautIntent('which song should I push next')?.operation).toBe('catalog_priority');
    expect(inspectAskMusicJuggernautIntent('where should I perform my music next')?.operation).toBe('live_market');
    expect(inspectAskMusicJuggernautIntent('continue the music juggernaut')?.operation).toBe('run_tick');
  });
  it('self-initializes internal planning state without external authority',async()=>{
    const repo=new Repo();
    const result=await handleAskMusicJuggernautCommand({userId:'u1',activeTask:'audit my music juggernaut'}, {repository:repo});
    expect(result?.workPlan.authority).toBe('INTERNAL_PLANNING_ONLY');
    expect(repo.project).not.toBeNull();
    expect(result?.proposal.recommendation).toContain('mode=');
  });
});
