import type {AskVideoCreationIntent} from './ask-video-production.js';
import {
  DIRECTOR_VIDEO_PROFILES,
  type DirectorVideoFormat,
} from './video-production-profile.js';
import {
  directorProductionArchetypeProfile,
  type DirectorProductionArchetype,
} from './production-archetypes.js';

export type DirectorCreativeFactoryLane =
  | 'commercial-ad'
  | 'social-short'
  | 'faceless-owned-media'
  | 'music-video'
  | 'narrative-short'
  | 'long-form-film'
  | 'general-video';

export type DirectorCreativeFactoryOwner =
  | 'DIRECTOR'
  | 'GROWTH_SOCIAL'
  | 'SHOTLIST_OWNED_MEDIA'
  | 'MUSIC_JUGGERNAUT';

export interface DirectorCreativeFactoryRoute {
  lane: DirectorCreativeFactoryLane;
  videoFormat: DirectorVideoFormat;
  videoProfileId: string;
  productionArchetype: DirectorProductionArchetype;
  downstreamOwner: DirectorCreativeFactoryOwner;
  requiredCapabilities: readonly string[];
  reasons: readonly string[];
  authority: 'DIRECTOR_CREATIVE_FACTORY_ROUTE';
  executionAuthority: 'NONE';
  publicationAuthority: 'NONE';
}

const MUSIC_VIDEO = /\b(music[- ]?video|visualizer|performance\s+video)\b/i;
const COMMERCIAL = /\b(ugc\s+ad|paid\s+ad|advert(?:isement|ising)?|commercial|product\s+demo|testimonial|sponsored\s+video)\b/i;
const SHORT_FILM = /\b(short\s+film|short\s+movie)\b/i;

function routeShape(
  lane:DirectorCreativeFactoryLane,
  format:DirectorVideoFormat,
  productionArchetype:DirectorProductionArchetype,
  downstreamOwner:DirectorCreativeFactoryOwner,
  reasons:readonly string[],
):DirectorCreativeFactoryRoute{
  const videoProfile=DIRECTOR_VIDEO_PROFILES[format];
  const archetypeProfile=directorProductionArchetypeProfile(productionArchetype);
  return Object.freeze({
    lane,
    videoFormat:format,
    videoProfileId:videoProfile.id,
    productionArchetype,
    downstreamOwner,
    requiredCapabilities:Object.freeze([
      ...new Set([
        ...videoProfile.requiredCapabilities,
        ...archetypeProfile.requiredCapabilities,
      ]),
    ]),
    reasons:Object.freeze([...reasons]),
    authority:'DIRECTOR_CREATIVE_FACTORY_ROUTE',
    executionAuthority:'NONE',
    publicationAuthority:'NONE',
  });
}

export function routeDirectorCreativeFactory(
  intent:AskVideoCreationIntent,
):DirectorCreativeFactoryRoute{
  const prompt=intent.prompt.trim();

  if(MUSIC_VIDEO.test(prompt)){
    const format:DirectorVideoFormat=intent.mode==='short'?'short-form':'hybrid';
    return routeShape(
      'music-video',
      format,
      'music_video',
      'MUSIC_JUGGERNAUT',
      ['MUSIC_VIDEO_INTENT','DIRECTOR_OWNS_MEDIA_EXECUTION','MUSIC_JUGGERNAUT_OWNS_MUSIC_EVIDENCE'],
    );
  }

  if(COMMERCIAL.test(prompt)){
    return routeShape(
      'commercial-ad',
      'short-form',
      'ugc_ad',
      'GROWTH_SOCIAL',
      ['COMMERCIAL_CREATIVE_INTENT','DIRECTOR_OWNS_MEDIA_EXECUTION','GROWTH_SOCIAL_OWNS_DISTRIBUTION_EVIDENCE'],
    );
  }

  if(intent.mode==='faceless'){
    return routeShape(
      'faceless-owned-media',
      'faceless',
      'faceless_owned_media',
      'SHOTLIST_OWNED_MEDIA',
      ['FACELESS_INTENT','SHOTLIST_OWNS_CHANNEL_RECIPE','DIRECTOR_OWNS_MEDIA_EXECUTION'],
    );
  }

  if(SHORT_FILM.test(prompt)){
    return routeShape(
      'narrative-short',
      'hybrid',
      'short_film',
      'DIRECTOR',
      ['SHORT_FILM_INTENT','DIRECTOR_CONTINUITY_AND_REHEARSAL_REQUIRED'],
    );
  }

  if(intent.mode==='short'){
    return routeShape(
      'social-short',
      'short-form',
      'social_short',
      'GROWTH_SOCIAL',
      ['SHORT_VERTICAL_INTENT','DIRECTOR_OWNS_MEDIA_EXECUTION','PUBLICATION_AUTHORITY_NOT_GRANTED'],
    );
  }

  if(intent.mode==='long-form'){
    return routeShape(
      'long-form-film',
      'long-form',
      'film',
      'DIRECTOR',
      ['LONG_FORM_INTENT','DIRECTOR_CONTINUITY_AND_REHEARSAL_REQUIRED'],
    );
  }

  return routeShape(
    'general-video',
    'hybrid',
    'explainer',
    'DIRECTOR',
    ['GENERAL_VIDEO_INTENT','DIRECTOR_OWNS_MEDIA_EXECUTION'],
  );
}
