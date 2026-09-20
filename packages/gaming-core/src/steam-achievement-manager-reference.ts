export type SteamAchievementAction='achievement-read'|'achievement-write'|'stat-read'|'stat-write';

export interface SteamAchievementManagerReference {
  id:'steam-achievement-manager';
  repository:'gibbed/SteamAchievementManager';
  scope:'steam-pc-utility';
  requiresRunningSteamClient:true;
  requiresLoggedInSteamAccount:true;
  automaticMutationAllowed:false;
  actions:readonly SteamAchievementAction[];
}

export const STEAM_ACHIEVEMENT_MANAGER_REFERENCE:SteamAchievementManagerReference=Object.freeze({
  id:'steam-achievement-manager',
  repository:'gibbed/SteamAchievementManager',
  scope:'steam-pc-utility',
  requiresRunningSteamClient:true,
  requiresLoggedInSteamAccount:true,
  automaticMutationAllowed:false,
  actions:['achievement-read','achievement-write','stat-read','stat-write'],
});

export function authorizeSteamAchievementAction(
  action:SteamAchievementAction,
  explicitUserApproval:boolean,
):{allowed:boolean;reason:'authorized'|'explicit-approval-required'}{
  const mutating=action==='achievement-write'||action==='stat-write';
  if(mutating&&!explicitUserApproval)return{allowed:false,reason:'explicit-approval-required'};
  return{allowed:true,reason:'authorized'};
}
