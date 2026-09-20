import {describe,expect,it} from 'vitest';
import {G26_DEVICE_ACCEPTANCE_MATRIX,evaluateDeviceAcceptance} from './gaming-device-acceptance.js';

describe('G26 device acceptance matrix',()=>{
  it('contains phone/X5, DualSense, Homebase/TV, browser, Sunshine, PS5 and Xbox routes',()=>{
    expect(G26_DEVICE_ACCEPTANCE_MATRIX.map(item=>item.id)).toEqual(expect.arrayContaining([
      'phone-local','iphone-x5','dualsense-usb','dualsense-bluetooth','homebase-tv','browser','pc-sunshine','ps5-dualsense','ps5-x5','xbox-streaming',
    ]));
  });

  it('does not call a matrix case accepted without actual hardware evidence',()=>{
    const testCase=G26_DEVICE_ACCEPTANCE_MATRIX.find(item=>item.id==='iphone-x5')!;
    const result=evaluateDeviceAcceptance(testCase,{caseId:'iphone-x5',hardwareObserved:false,requirementsPassed:testCase.requirements,artifactRefs:[]});
    expect(result).toEqual({passed:false,missingRequirements:[],hardwareEvidenceMissing:true});
  });
});
