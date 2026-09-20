export type Ps5ExperimentalCategory=
  |'linux-research'
  |'emulation'
  |'payload-catalog'
  |'home-integration'
  |'controller-library';

export type Ps5ExperimentalSafetyClass=
  |'metadata-only'
  |'observation'
  |'emulator-runtime'
  |'restricted-execution';

export interface Ps5ExperimentalReference {
  id:string;
  repository:string;
  category:Ps5ExperimentalCategory;
  safetyClass:Ps5ExperimentalSafetyClass;
  description:string;
  capabilities:readonly string[];
  prohibitedAutomaticActions:readonly string[];
}

export const PS5_EXPERIMENTAL_REFERENCES:readonly Ps5ExperimentalReference[]=Object.freeze([
  {
    id:'ps5-linux-loader',
    repository:'ps5-linux/ps5-linux-loader',
    category:'linux-research',
    safetyClass:'restricted-execution',
    description:'Research reference for Linux boot and PS5 hypervisor/kernel research.',
    capabilities:['linux-boot-research','platform-research'],
    prohibitedAutomaticActions:['exploit-execution','payload-execution','privilege-escalation'],
  },
  {
    id:'kyty',
    repository:'InoriRus/Kyty',
    category:'emulation',
    safetyClass:'emulator-runtime',
    description:'Open-source PS4/PS5 emulator research reference.',
    capabilities:['emulator-runtime','compatibility-research'],
    prohibitedAutomaticActions:['console-exploit-execution'],
  },
  {
    id:'ps5-payloads-mirror',
    repository:'itsPLK/ps5-payloads-mirror',
    category:'payload-catalog',
    safetyClass:'metadata-only',
    description:'Catalog/reference source for PS5 homebrew and payload ecosystem metadata.',
    capabilities:['catalog-index','version-awareness'],
    prohibitedAutomaticActions:['download-payload','execute-payload','auto-load-payload'],
  },
  {
    id:'ps5-websrv',
    repository:'ps5-payload-dev/websrv',
    category:'payload-catalog',
    safetyClass:'restricted-execution',
    description:'Homebrew web-server reference for already-modified systems.',
    capabilities:['homebrew-service-metadata'],
    prohibitedAutomaticActions:['deploy-homebrew','execute-payload','exploit-execution'],
  },
  {
    id:'ps5-mqtt',
    repository:'FunkeyFlo/ps5-mqtt',
    category:'home-integration',
    safetyClass:'observation',
    description:'PS5 state and smart-home integration reference.',
    capabilities:['presence','power-state','home-automation-integration'],
    prohibitedAutomaticActions:['credential-export','silent-account-control'],
  },
]);

export class Ps5ExperimentalReferenceCatalog {
  private readonly byId=new Map(PS5_EXPERIMENTAL_REFERENCES.map(reference=>[reference.id,reference]));

  get(id:string):Ps5ExperimentalReference|undefined{return this.byId.get(id);}
  list(category?:Ps5ExperimentalCategory):readonly Ps5ExperimentalReference[]{
    return PS5_EXPERIMENTAL_REFERENCES.filter(reference=>!category||reference.category===category);
  }
  canAutomaticallyExecute(id:string):boolean{
    const reference=this.byId.get(id);
    return reference?.safetyClass==='emulator-runtime';
  }
}
