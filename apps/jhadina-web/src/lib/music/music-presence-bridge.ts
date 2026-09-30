import {
  buildPresenceCampaign,
  type CampaignMechanic,
  type GrowthId,
  type MusicCreativeBrief,
  type PresenceSurface,
  type SellableOffer,
} from '@jhadina/growth-core';
import {createGrowthPresenceRepository,type GrowthPresenceRepository,type StoredPresenceCampaign} from '../growth/presence-repository';

export async function stageMusicCreativePresence(input:{
  userId:string;
  brandId?:string;
  song:{id:string;title:string;evidenceRefs:readonly string[]};
  brief:MusicCreativeBrief;
  destinationUrl?:string;
  repository?:GrowthPresenceRepository;
}):Promise<StoredPresenceCampaign>{
  const repository=input.repository??createGrowthPresenceRepository();
  const brandId=(input.brandId?.trim()||'brand:atwood-bookie') as GrowthId;
  const evidence=[...new Set([...input.song.evidenceRefs,...input.brief.evidenceRefs])];
  if(!evidence.length)evidence.push('music-song:'+input.song.id);
  const campaignId=('music-presence:'+safe(input.song.id)+':'+safe(input.brief.id)) as GrowthId;
  const offerId=('music-offer:'+safe(input.song.id)) as GrowthId;
  const conceptId=('music-concept:'+safe(input.brief.id)) as GrowthId;
  const offer:SellableOffer={
    id:offerId,
    brandId,
    name:input.song.title,
    kind:'music',
    objective:'stream',
    destinationUrl:input.destinationUrl,
    evidenceRefs:Object.freeze(evidence),
  };
  const campaign=buildPresenceCampaign({
    id:campaignId,
    brandId,
    concept:{
      id:conceptId,
      name:input.brief.family+' — '+input.song.title,
      mechanic:mechanic(input.brief.family),
      thesis:input.brief.capturePlan,
      hook:input.brief.hook,
      evidenceRefs:Object.freeze(evidence),
      targetQuestions:Object.freeze([
        'Which audience/context makes this '+input.brief.family.replaceAll('_',' ')+' worth watching?',
        'Does this creative transfer attention into meaningful music behavior?',
        'What should we preserve if this becomes a relative outlier?',
      ]),
    },
    offers:[offer],
    durableSurfaces:surfaces(input.brief.family),
    createdAt:new Date().toISOString(),
  });
  return repository.saveCampaign({userId:input.userId,campaign,offers:[offer],status:'draft'});
}

function mechanic(family:MusicCreativeBrief['family']):CampaignMechanic{
  if(family==='meme')return 'meme';
  if(family==='story'||family==='human_process')return 'story';
  if(family==='community')return 'community_prompt';
  if(family==='weird_experiment')return 'experiment';
  if(family==='mini_music_video')return 'launch';
  return 'demonstration';
}

function surfaces(family:MusicCreativeBrief['family']):PresenceSurface[]{
  if(family==='performance_platform')return ['social:youtube','social:instagram','social:tiktok','web:owned'];
  if(family==='story'||family==='human_process')return ['social:instagram','social:youtube','email','web:owned'];
  if(family==='community')return ['social:instagram','social:tiktok','community:reddit','email'];
  return ['social:tiktok','social:instagram','social:youtube','web:owned'];
}

function safe(value:string):string{return value.replace(/[^a-zA-Z0-9:_-]+/g,'-').slice(0,180);}
