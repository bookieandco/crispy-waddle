import {describe,it,expect} from 'vitest';
import {detectAskImageIntent} from './ask-image-production.js';
describe('JLLM image dispatch',()=>{
  it('recognizes original image production without misleading backend submission',()=>{
    expect(detectAskImageIntent('Generate a dog portrait 9:16')).toMatchObject({
      aspectRatio:'9:16',operation:'text-to-image',providerPolicy:{localOnly:true,allowPaidWithoutApproval:false}});
    expect(detectAskImageIntent('Edit a pet photo',['asset-pet'])).toMatchObject({operation:'image-to-image'});
  });
  it('leaves video creation to the existing Ask Director video jobs',()=>{
    expect(detectAskImageIntent('Create a 15 second dog video')).toBeUndefined();
    expect(detectAskImageIntent('Produce a movie poster and animate it into a video')).toBeUndefined();
    expect(detectAskImageIntent('Explain what images are')).toBeUndefined();
  });
});
