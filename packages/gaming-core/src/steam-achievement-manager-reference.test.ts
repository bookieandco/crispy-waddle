import {describe,expect,it} from 'vitest';
import {STEAM_ACHIEVEMENT_MANAGER_REFERENCE,authorizeSteamAchievementAction} from './steam-achievement-manager-reference.js';

describe('Steam Achievement Manager reference',()=>{
  it('stays outside the PlayStation experimental execution plane',()=>{
    expect(STEAM_ACHIEVEMENT_MANAGER_REFERENCE.scope).toBe('steam-pc-utility');
    expect(STEAM_ACHIEVEMENT_MANAGER_REFERENCE.repository).toBe('gibbed/SteamAchievementManager');
    expect(STEAM_ACHIEVEMENT_MANAGER_REFERENCE.automaticMutationAllowed).toBe(false);
  });

  it('requires explicit approval before achievement or stat mutation',()=>{
    expect(authorizeSteamAchievementAction('achievement-write',false)).toEqual({allowed:false,reason:'explicit-approval-required'});
    expect(authorizeSteamAchievementAction('stat-write',true)).toEqual({allowed:true,reason:'authorized'});
    expect(authorizeSteamAchievementAction('achievement-read',false)).toEqual({allowed:true,reason:'authorized'});
  });
});
