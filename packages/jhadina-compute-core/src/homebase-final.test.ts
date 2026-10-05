import {describe,expect,it} from 'vitest';
import {createHomebaseRuntimeContract,validateHomebaseRuntimeContract} from './homebase-runtime.js';
import {HomebaseServiceRegistry} from './homebase-service-registry.js';
import {defaultHomebaseStorage,validateHomebaseStorage} from './homebase-storage.js';
import {routeHomebaseJob} from './homebase-router.js';
import {buildRunpodWorkerDispatch,runpodServerlessRunUrl} from './runpod-worker-adapter.js';
import {createHomebaseWorkerFleet,validateWorkerFleet} from './homebase-worker-fleet.js';
import {validateHomebaseResultEnvelope} from './homebase-result-envelope.js';
import {planHomebaseOfflineMode} from './homebase-offline.js';
import {HOMEBASE_SUBSYSTEMS,validateHomebaseSubsystemMigrations} from './homebase-subsystem-migration.js';
import {buildHomebaseFinalReport} from './homebase-final.js';
import {HomebaseComputeGateway} from './homebase-compute-gateway.js';

describe('JHADINA-HOMEBASE.1-.10',()=>{
  it('admits Homebase as canonical and RunPod as execution-only burst',()=>{
    const runtime=createHomebaseRuntimeContract('homebase-01');
    expect(validateHomebaseRuntimeContract(runtime)).toEqual([]);
    expect(runtime.cloudPolicy).toMatchObject({
      runpodRole:'RESEARCH_AND_BURST_ONLY',
      mayOwnCanonicalState:false,
      mayGrantDomainAuthority:false,
      sensitiveDataAllowed:false,
    });
  });

  it('requires exactly one local canonical service for each durable core role',()=>{
    const r=new HomebaseServiceRegistry();
    r.register({id:'postgres',role:'database',endpoint:'postgres://local',health:'ready',canonical:true,local:true,dependencies:[]});
    r.register({id:'objects',role:'object-storage',endpoint:'http://127.0.0.1:9000',health:'ready',canonical:true,local:true,dependencies:[]});
    r.register({id:'queue',role:'queue',endpoint:'nats://127.0.0.1:4222',health:'ready',canonical:true,local:true,dependencies:['postgres']});
    r.register({id:'backup',role:'backup',endpoint:'file:///srv/jhadina-backups',health:'ready',canonical:true,local:true,dependencies:['postgres','objects']});
    r.register({id:'api',role:'api',endpoint:'http://127.0.0.1:3000',health:'ready',canonical:false,local:true,dependencies:['postgres','objects','queue']});
    expect(r.validate()).toEqual([]);
    expect(r.startupOrder().indexOf('postgres')).toBeLessThan(r.startupOrder().indexOf('api'));
  });

  it('requires separate encrypted canonical backup storage',()=>{
    expect(validateHomebaseStorage(defaultHomebaseStorage())).toEqual([]);
    expect(validateHomebaseStorage({...defaultHomebaseStorage(),backupRoot:'/srv/jhadina'})).toContain('HOMEBASE_BACKUP_TARGET_MUST_BE_SEPARATE');
  });

  it('routes public research to RunPod but sensitive work to Homebase',()=>{
    const state={homebaseReady:true,localGpuReady:false,runpodReachable:true,offline:false};
    expect(routeHomebaseJob({
      id:'research-1',subsystem:'overage',jobClass:'research',sensitive:false,cloudBurstAllowed:true,
      requiresGpu:false,estimatedDurationMinutes:20,
    },state).target).toBe('RUNPOD_CPU');
    expect(routeHomebaseJob({
      id:'private-1',subsystem:'money',jobClass:'research',sensitive:true,cloudBurstAllowed:true,
      requiresGpu:false,estimatedDurationMinutes:5,
    },state).target).toBe('HOMEBASE_LOCAL');
  });

  it('builds execution-only RunPod dispatches with secret references rather than secret values',()=>{
    const job={
      id:'research-2',subsystem:'opportunity',jobClass:'research' as const,sensitive:false,
      cloudBurstAllowed:true,requiresGpu:false,estimatedDurationMinutes:20,
    };
    const dispatch=buildRunpodWorkerDispatch(job,'RUNPOD_CPU',{query:'county surplus'},{podProxyUrl:'https://abc-8080.proxy.runpod.net'});
    expect(dispatch.authority).toBe('EXECUTION_ONLY');
    expect(dispatch.apiKeyRef).toBe('secret:RUNPOD_API_KEY');
    expect(dispatch).not.toHaveProperty('apiKey');
    expect(runpodServerlessRunUrl('endpoint_123')).toBe('https://api.runpod.ai/v2/endpoint_123/run');
  });

  it('defines disposable RunPod research/GPU fleets with no canonical writes',()=>{
    const fleet=createHomebaseWorkerFleet();
    expect(validateWorkerFleet(fleet)).toEqual([]);
    expect(fleet.filter(x=>x.provider==='runpod').every(x=>x.disposable&&!x.canonicalWriteAllowed)).toBe(true);
  });

  it('accepts worker results only as evidence requiring Homebase commit',()=>{
    expect(validateHomebaseResultEnvelope({
      schema:'jhadina.homebase-result.v1',
      jobId:'j1',subsystemOwner:'overage',executionProvider:'RUNPOD',status:'SUCCEEDED',
      producedAt:'2026-10-04T00:00:00Z',outputRefs:['object:1'],
      evidence:[{observedAt:'2026-10-04T00:00:00Z',sha256:'a'.repeat(64),ref:'source:1'}],
      authority:'EVIDENCE_ONLY',canonicalCommitRequired:true,idempotencyKey:'idem-1',
    })).toEqual([]);
  });

  it('keeps Homebase writable offline when canonical local services are healthy',()=>{
    expect(planHomebaseOfflineMode({
      internetAvailable:false,canonicalDatabaseReady:true,objectStorageReady:true,queueReady:true,
    })).toEqual({
      mode:'LOCAL_ONLY',acceptLocalJobs:true,acceptCloudJobs:false,canonicalWrites:true,reason:'INTERNET_UNAVAILABLE',
    });
  });

  it('migrates every declared subsystem to Homebase authority',()=>{
    expect(validateHomebaseSubsystemMigrations(HOMEBASE_SUBSYSTEMS)).toEqual([]);
    expect(HOMEBASE_SUBSYSTEMS.find(x=>x.subsystem==='overage')?.mode).toBe('LOCAL_WITH_RUNPOD_RESEARCH');
    expect(HOMEBASE_SUBSYSTEMS.every(x=>x.canonicalState==='HOMEBASE'&&!x.cloudAuthority)).toBe(true);
  });

  it('exposes canonical compute admission without fabricating live Homebase readiness',async()=>{
    const gateway=new HomebaseComputeGateway('homebase',{
      async readiness(){return {ready:false,reasons:['HOMEBASE_PHYSICAL_HARDWARE_EVIDENCE_REQUIRED']};},
      async submit(){throw new Error('should not submit while unavailable');},
    },()=> '2026-10-05T03:00:00.000Z');
    await expect(gateway.handle({method:'GET',path:'/health'})).resolves.toMatchObject({
      status:503,
      body:{
        productionReady:false,
        authority:'CANONICAL_COMPUTE_SUBMISSION',
        trustDomain:'homebase',
        reasons:['HOMEBASE_PHYSICAL_HARDWARE_EVIDENCE_REQUIRED'],
      },
    });
  });

  it('closes source architecture while keeping physical/live evidence honest',()=>{
    const report=buildHomebaseFinalReport({
      runtime:createHomebaseRuntimeContract('homebase-01'),
      storage:defaultHomebaseStorage(),
      workers:createHomebaseWorkerFleet(),
      subsystems:HOMEBASE_SUBSYSTEMS,
      serviceRegistryVerified:true,
      routerVerified:true,
      runpodAdapterVerified:true,
      resultProtocolVerified:true,
      offlineFallbackVerified:true,
      physicalHomebaseObserved:false,
      runpodLiveReceiptObserved:false,
      backupRestoreObserved:false,
    });
    expect(report.sourceComplete).toBe(true);
    expect(report.liveReady).toBe(false);
    expect(report.blockers).toEqual(expect.arrayContaining([
      'HOMEBASE_PHYSICAL_HARDWARE_EVIDENCE_REQUIRED',
      'HOMEBASE_RUNPOD_LIVE_RECEIPT_REQUIRED',
      'HOMEBASE_BACKUP_RESTORE_RECEIPT_REQUIRED',
    ]));
  });
});
