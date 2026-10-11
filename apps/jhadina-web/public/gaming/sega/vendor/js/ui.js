/* Jhadina adapter for PINNED GPLv3 Jgenesis browser frontend.
 * Upstream wasm_bindgen imports these exact exports; no external networking.
 */
function $ (id){return document.getElementById(id)}
export function showUi(){
 const host=$('runtimeStatus');
 if(host)host.textContent='Jgenesis renderer started · cartridge pending';
 window.dispatchEvent(new Event('jhadina-sega:runtime-ready'));
}
export function setFullscreen(_full){}
export function focusCanvas(){
 const canvas=document.querySelector('#jgenesis-wasm canvas');
 if(canvas){canvas.tabIndex=0;canvas.focus({preventScroll:true})}
}
export function showSmsGgConfig(){}
export function showGenesisConfig(){}
export function showSnesConfig(){}
export function showGbaConfig(){}
export function setCursorVisible(visible){
 document.querySelector('#jgenesis-wasm canvas')?.classList.toggle('cursor-hidden',!visible);
}
export function setRomTitle(title){
 const node=$('display');if(node)node.textContent=String(title).slice(0,90);
 window.dispatchEvent(new CustomEvent('jhadina-sega:rom-loaded',{detail:{title:String(title).slice(0,90)}}));
}
// Rust snapshot commands settle only after a frame-boundary serialize/decode.
export function genesisStateSaved(bytes){
 window.dispatchEvent(new CustomEvent('jhadina-sega:state-saved',{detail:{bytes}}));
}
export function genesisStateLoaded(){
 window.dispatchEvent(new Event('jhadina-sega:state-loaded'));
}
export function genesisStateFailed(reason){
 window.dispatchEvent(new CustomEvent('jhadina-sega:state-failed',{detail:{reason:String(reason)}}));
}
export function setSaveUiEnabled(_enabled){}
export function beforeInputConfigure(){}
export function afterInputConfigure(_name,_key){}
export function showWebGpuUnsupportedMessage(){
 const status=$('runtimeStatus');if(status)status.textContent='WebGPU unsupported · Play unavailable';
 window.dispatchEvent(new Event('jhadina-sega:runtime-error'));
}
export function localStorageGet(key){return localStorage.getItem('jhadina.sega.jgenesis.'+key)}
export function localStorageSet(key,value){localStorage.setItem('jhadina.sega.jgenesis.'+key,value)}
