/* Capability evidence only: does NOT install or start an emulator. */
(function(root){
'use strict';
async function inspect(){
 const navigatorObject=root.navigator||{};
 const secure=Boolean(root.isSecureContext);
 const isolated=Boolean(root.crossOriginIsolated);
 const wasm=typeof root.WebAssembly==='object' && typeof root.WebAssembly.instantiate==='function';
 const webgpu=typeof navigatorObject.gpu?.requestAdapter==='function';
 const touch=Number(navigatorObject.maxTouchPoints||0)>0||('ontouchstart' in root);
 const gamepads=typeof navigatorObject.getGamepads==='function';
 let adapter=false,adapterError='';
 if(webgpu){
  try{adapter=Boolean(await navigatorObject.gpu.requestAdapter({powerPreference:'low-power'}))}
  catch(error){adapterError=String(error?.message||error)}
 }
 // We cannot claim full Jgenesis support from a generic graphics capability probe.
 return Object.freeze({secureContext:secure,crossOriginIsolated:isolated,webAssembly:wasm,
  webGPUAPI:webgpu,webGPUAdapter:adapter,webGPUError:adapterError,
  touchAvailable:touch,gamepadAPI:gamepads,emulatorInstalled:false,
  readyToPlay:false});
}
function summary(result){
 return [
  'Secure HTTPS: '+(result.secureContext?'yes':'no'),
  'Cross-origin isolation: '+(result.crossOriginIsolated?'yes':'no (Sega route headers/host need verification)'),
  'WebAssembly: '+(result.webAssembly?'yes':'no'),
  'WebGPU adapter: '+(result.webGPUAdapter?'detected':'not available/verified'),
  'Touch: '+(result.touchAvailable?'detected':'not detected'),
  'Gamepad API: '+(result.gamepadAPI?'available':'unavailable'),
  'Sega emulator installed: no',
  'Play certification: pending source, WebAssembly binary, iPhone and save tests'
 ].join('\n');
}
root.JhadinaSegaDevice=Object.freeze({inspect,summary});
})(globalThis);
