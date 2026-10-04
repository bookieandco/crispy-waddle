import {describe,expect,it} from 'vitest';
import {detectAskVideoCreationIntent} from './ask-video-production.js';
import {routeDirectorCreativeFactory} from './creative-factory-routing.js';

function route(prompt:string){
  const intent=detectAskVideoCreationIntent(prompt);
  if(!intent)throw new Error('TEST_INTENT_REQUIRED');
  return routeDirectorCreativeFactory(intent);
}

describe('Director creative factory routing',()=>{
  it('routes paid and UGC ads through the commercial creative lane',()=>{
    const result=route('Create a 30 second TikTok UGC ad for this product');
    expect(result.lane).toBe('commercial-ad');
    expect(result.videoFormat).toBe('short-form');
    expect(result.productionArchetype).toBe('ugc_ad');
    expect(result.downstreamOwner).toBe('GROWTH_SOCIAL');
    expect(result.publicationAuthority).toBe('NONE');
  });

  it('routes ordinary vertical social video without turning it into an ad',()=>{
    const result=route('Make a TikTok short about our behind the scenes process');
    expect(result.lane).toBe('social-short');
    expect(result.productionArchetype).toBe('social_short');
    expect(result.videoFormat).toBe('short-form');
  });

  it('routes faceless YouTube through Shotlist-owned channel intelligence and Director execution',()=>{
    const result=route('Create a faceless YouTube video about forgotten engineering disasters');
    expect(result.lane).toBe('faceless-owned-media');
    expect(result.productionArchetype).toBe('faceless_owned_media');
    expect(result.videoFormat).toBe('faceless');
    expect(result.downstreamOwner).toBe('SHOTLIST_OWNED_MEDIA');
    expect(result.reasons).toContain('SHOTLIST_OWNS_CHANNEL_RECIPE');
  });

  it('routes music videos to Music evidence without giving Music media execution authority',()=>{
    const result=route('Create a cinematic music video for this song');
    expect(result.lane).toBe('music-video');
    expect(result.productionArchetype).toBe('music_video');
    expect(result.downstreamOwner).toBe('MUSIC_JUGGERNAUT');
    expect(result.reasons).toContain('DIRECTOR_OWNS_MEDIA_EXECUTION');
  });

  it('routes short films and feature movies to narrative Director lanes',()=>{
    expect(route('Create a short film about a stranded astronaut').lane).toBe('narrative-short');
    const feature=route('Create a 60 minute feature movie about a stranded astronaut');
    expect(feature.lane).toBe('long-form-film');
    expect(feature.productionArchetype).toBe('film');
    expect(feature.videoFormat).toBe('long-form');
  });

  it('never grants execution or publication authority from routing',()=>{
    for(const prompt of [
      'Create a product commercial video',
      'Make a TikTok short about my studio',
      'Create a faceless YouTube video about ancient ships',
      'Create a music video for this song',
      'Create a feature film about a lost city',
    ]){
      const result=route(prompt);
      expect(result.executionAuthority).toBe('NONE');
      expect(result.publicationAuthority).toBe('NONE');
    }
  });
});
