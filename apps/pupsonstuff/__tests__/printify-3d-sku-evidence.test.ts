import {describe, expect, it, vi} from 'vitest';
import type {
  PrintifyBlueprint,PrintifyPrintProviderSimple,
  PrintifyVariantsResponse,PrintifyBlueprintSizeGuide,
} from '../lib/printify';
import {
  buildPrintifySkuEvidence,parseExactPrintifyId,
} from '../lib/product3d/printify-sku-evidence';
import {parseProofArgs,obtainExactSkuEvidence} from '../scripts/printify-3d-sku-evidence';

const id={product:'tote' as const,blueprintId:72,printProviderId:4,variantId:611};
const blueprint:PrintifyBlueprint={
  id:72,title:'Synthetic Canvas Bag',description:null,brand:'fixture brand',
  model:'sample-model',images:[],
};
const providers:PrintifyPrintProviderSimple[]=[
  {id:4,title:'Test Print Provider',decoration_methods:['dtg']},
];
const variants:PrintifyVariantsResponse={id:72,title:'Synthetic Canvas Bag',variants:[{
  id:611,title:'Natural / One size',options:{color:'Natural',size:'One size'},
  placeholders:[{position:'front',decoration_method:'dtg',width:3153,height:3995}],
  decoration_methods:['dtg'],
}]};
const guide:PrintifyBlueprintSizeGuide={
  sizes:['One size'],
  types:[{name:'Width',units:'in',ranges:[{from:'14',to:'16'}]}],
};

describe('read-only Printify physical SKU evidence',()=>{
  it('parses only explicit positive exact IDs and known product families',()=>{
    expect(parseProofArgs(['--product','tote','--blueprint','72','--provider','4','--variant','611'])).toEqual(id);
    expect(()=>parseProofArgs(['--product','tote','--blueprint','72','--provider','4'])).toThrow();
    expect(()=>parseProofArgs(['--product','hoodie','--blueprint','72','--provider','4','--variant','611','--variant','612'])).toThrow();
    expect(()=>parseExactPrintifyId('1.1')).toThrow();
    expect(()=>parseExactPrintifyId('001')).toThrow();
    expect(()=>parseExactPrintifyId('-1')).toThrow();
  });
  it('preserves pixel print zones and size guide but NEVER turns them into physical dimensions',()=>{
    const r=buildPrintifySkuEvidence(id,blueprint,providers,variants,guide);
    expect(r.printAreasPx).toEqual([{position:'front',decorationMethod:'dtg',widthPx:3153,heightPx:3995}]);
    expect(r.sizeGuide.measures).toEqual([{name:'Width',units:'in',from:'14',to:'16'}]);
    expect(r.physicallyMeasuredWidthHeightDepthMm).toBe(null);
    expect(r.productionGeometryApproved).toBe(false);
    expect(r.storefrontApproved).toBe(false);
    expect(r.blockers).toContain('PHYSICAL_W_H_D_REQUIRED_FROM_MANUFACTURER_OR_SAMPLE');
  });
  it('fails closed on swapped provider or selected variant rather than guessing a match',()=>{
    expect(()=>buildPrintifySkuEvidence(id,blueprint,[],variants,guide)).toThrow('EXACT_PRINTIFY_PROVIDER_NOT_FOUND');
    expect(()=>buildPrintifySkuEvidence({...id,variantId:612},blueprint,providers,variants,guide)).toThrow('EXACT_PRINTIFY_VARIANT_NOT_FOUND');
    expect(()=>buildPrintifySkuEvidence({...id,blueprintId:999},blueprint,providers,variants,guide)).toThrow('PRINTIFY_BLUEPRINT_IDENTITY_NOT_VERIFIED');
  });
  it('fails closed if size guide is unavailable; zero sizes are not invented',()=>{
    const r=buildPrintifySkuEvidence(id,blueprint,providers,variants,{sizes:[],types:[]});
    expect(r.blockers).toContain('PRINTIFY_SIZE_GUIDE_FOR_VARIANT_UNAVAILABLE');
    expect(r.sizeGuide.measures).toEqual([]);
    expect(()=>buildPrintifySkuEvidence(id,blueprint,providers,variants,null as never)).toThrow('PRINTIFY_SIZE_GUIDE_NOT_AVAILABLE');
  });
  it('requires API credentials and does not call Printify anonymously',async()=>{
    vi.stubEnv('PRINTIFY_API_KEY','');
    await expect(obtainExactSkuEvidence(id)).rejects.toThrow('PRINTIFY_API_KEY_MISSING_NO_LIVE_CATALOG_ASSERTIONS');
    vi.unstubAllEnvs();
  });
});
