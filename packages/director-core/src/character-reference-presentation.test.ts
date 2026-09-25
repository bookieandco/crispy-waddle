import {describe,expect,it} from 'vitest';
import {
  SOURCE_FLAT_GRAY_CHARACTER_REFERENCE_PROFILE,
  validateCharacterReferencePresentationProfile,
} from './character-reference-presentation';

describe('character reference presentation',()=>{
  it('stores the source gray/flat-light sheet guidance as a profile rather than a universal rule',()=>{
    expect(validateCharacterReferencePresentationProfile(SOURCE_FLAT_GRAY_CHARACTER_REFERENCE_PROFILE)).toEqual([]);
    expect(SOURCE_FLAT_GRAY_CHARACTER_REFERENCE_PROFILE.background).toEqual({
      kind:'neutral-gray',
      reflectancePercent:18,
    });
    expect(SOURCE_FLAT_GRAY_CHARACTER_REFERENCE_PROFILE.preferredViews).toEqual(['front','rear','close-up']);
    expect(SOURCE_FLAT_GRAY_CHARACTER_REFERENCE_PROFILE.includeFullBody).toBe(true);
  });

  it('rejects an undocumented custom presentation',()=>{
    expect(validateCharacterReferencePresentationProfile({
      id:'bad',
      background:{kind:'custom',description:''},
      lighting:'custom',
      preferredViews:['front'],
      includeFullBody:false,
      includeCloseUp:true,
      evidenceIds:['test'],
      authority:'DIRECTOR_CHARACTER_REFERENCE_PRESENTATION',
    })).toEqual(expect.arrayContaining([
      'DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_BACKGROUND_DESCRIPTION_REQUIRED',
      'DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_LIGHTING_DESCRIPTION_REQUIRED',
    ]));
  });
});
