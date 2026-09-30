import { describe, expect, it } from 'vitest';
import {
  preflightSpatialAction,
  validateCharacterCastRecord,
  validateProductionAssetPackage,
  validateProductIdentityBible,
} from '@jhadina/director-core';
import {
  BONEZ_CANON,
  BONEZ_CHARACTER_ID,
  BONEZ_PRODUCT_REFERENCE_ASSET_ID,
  BONEZ_PRODUCT_REFERENCE_SHA256,
  BONEZ_REFERENCE_ASSET_ID,
  BONEZ_REFERENCE_SHA256,
  bonezAssetPackages,
  bonezCastRecord,
  bonezCreativeDirectives,
  bonezProductBible,
  bonezWorldState,
} from './director-bonez-canon';

const NOW='2026-09-29T03:00:00.000Z';
const OWNER='00000000-0000-0000-0000-000000000001';

describe('Bonez canonical Director package',()=>{
  it('validates the cast and keeps the v2 visual reference as identity authority',()=>{
    const cast=bonezCastRecord(NOW,OWNER);
    expect(validateCharacterCastRecord(cast)).toEqual([]);
    expect(cast.characterId).toBe(BONEZ_CHARACTER_ID);
    expect(cast.canonicalAppearanceVariantId).toBe('appearance:bonez:canonical:v1');
    expect(cast.appearanceVariants[0]?.referenceAssetIds).toEqual([BONEZ_REFERENCE_ASSET_ID]);
    expect(cast.appearanceVariants[0]?.referenceSha256s).toEqual([BONEZ_REFERENCE_SHA256]);
    expect(cast.lockedTraits).toEqual(expect.arrayContaining([
      'reanimated corpse',
      'long black locs',
      'deep asymmetric facial decay',
      'time-transcending awareness',
    ]));
  });

  it('keeps confirmed canon separate from unconfirmed origin proposals',()=>{
    expect(BONEZ_CANON.confirmed).toContain('Bonez is a reanimated corpse.');
    expect(BONEZ_CANON.confirmed).toContain('Crip means Crypt; Bonez is chilling there by choice, not trapped.');
    expect(BONEZ_CANON.nonCanonOrUnconfirmed.join(' ')).toContain('podcaster/story addict');
  });

  it('validates every production asset package and separates character from product reference truth',()=>{
    const packages=bonezAssetPackages(NOW);
    expect(packages).toHaveLength(6);
    for(const pkg of packages) expect(validateProductionAssetPackage(pkg)).toEqual([]);
    const character=packages.find(pkg=>pkg.id==='assetpkg:bonez:v1')!;
    const product=packages.find(pkg=>pkg.id==='assetpkg:bonez-print:v1')!;
    expect(character.canonicalReferences[0]?.assetId).toBe(BONEZ_REFERENCE_ASSET_ID);
    expect(character.canonicalReferences[0]?.sha256).toBe(BONEZ_REFERENCE_SHA256);
    expect(product.canonicalReferences[0]?.assetId).toBe(BONEZ_PRODUCT_REFERENCE_ASSET_ID);
    expect(product.canonicalReferences[0]?.sha256).toBe(BONEZ_PRODUCT_REFERENCE_SHA256);
  });

  it('validates the limited Bonez Lair art-print product identity without turning merch into character canon',()=>{
    const bible=bonezProductBible();
    expect(validateProductIdentityBible(bible)).toEqual([]);
    expect(bible.referenceViews[0]?.assetId).toBe(BONEZ_PRODUCT_REFERENCE_ASSET_ID);
    expect(bible.labelAuthorities).toEqual([]);
    expect(BONEZ_CANON.confirmed.join(' ')).not.toContain('art print');
  });

  it('pins user canon and forbids known drift patterns',()=>{
    const directives=bonezCreativeDirectives(NOW);
    const keys=new Map(directives.map(directive=>[directive.key,directive]));
    expect(keys.get('generic-skeleton-swap')?.mode).toBe('forbid');
    expect(keys.get('clean-human-skin')?.mode).toBe('forbid');
    expect(keys.get('mandatory-coffee-or-cup')?.mode).toBe('forbid');
    expect(keys.get('fixed-intro')?.mode).toBe('forbid');
    expect(keys.get('crip-as-prison')?.mode).toBe('forbid');
    expect(keys.get('unconfirmed-origin')?.mode).toBe('forbid');
    expect(keys.get('movement')?.mode).toBe('allow');
  });

  it('preflights Bonez and his chair as co-located world entities',()=>{
    const world=bonezWorldState(NOW);
    const decision=preflightSpatialAction(world,{
      actorId:'world-entity:bonez',
      targetId:'world-entity:chair',
      affordance:'sit',
      requireCoLocated:true,
    });
    expect(decision.admissible).toBe(true);
    expect(decision.reasons).toEqual([]);
  });
});
