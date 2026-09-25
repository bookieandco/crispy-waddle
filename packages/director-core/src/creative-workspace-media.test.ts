import { describe, expect, it } from 'vitest';
import { buildCreativeWorkspaceLibrary, type CapturedProjectMediaRecord } from './creative-workspace-media';
import type { GeneratedAssetRecord } from './generated-asset-resolver';

const generated:GeneratedAssetRecord={
  id:'gen:video:1',
  projectId:'project-1',
  generationJobId:'job-1',
  providerId:'provider-1',
  mediaType:'video',
  uri:'asset://generated.mp4',
  sha256:'sha-gen',
  modelId:'video-model',
  prompt:'papercraft panda walking',
  createdAt:'2026-09-25T10:05:00Z',
  provenance:{
    projectId:'project-1',
    storyboardBoardIds:['board-1'],
    storyboardVersion:3,
    generationStageId:'stage-generation',
    generationStageVersion:2,
    generationJobId:'job-1',
  },
};

const captured:CapturedProjectMediaRecord={
  id:'captured:video:1',
  projectId:'project-1',
  mediaType:'video',
  uri:'asset://camera.mov',
  sha256:'sha-camera',
  createdAt:'2026-09-25T10:00:00Z',
  origin:'captured',
  provenanceRefs:['camera-card:A','ingest:receipt-1'],
};

describe('creative workspace media library',()=> {
  it('shows captured and generated media in one project view without erasing origin or provenance',()=> {
    const library=buildCreativeWorkspaceLibrary({
      projectId:'project-1',
      generatedAssets:[generated],
      capturedMedia:[captured],
    });

    expect(library.allAssets.map(asset=>asset.id)).toEqual(['gen:video:1','captured:video:1']);
    expect(library.generatedHistory[0]).toMatchObject({
      id:'gen:video:1',
      origin:'generated',
      generationJobId:'job-1',
      providerId:'provider-1',
    });
    expect(library.generatedHistory[0]?.provenanceRefs).toEqual(expect.arrayContaining([
      'generation-job:job-1',
      'provider:provider-1',
      'generation-stage:stage-generation:v2',
      'storyboard-version:3',
      'storyboard-board:board-1',
    ]));
    expect(library.capturedMedia[0]).toMatchObject({
      id:'captured:video:1',
      origin:'captured',
    });
    expect(library.mediaCounts.video).toBe(2);
  });

  it('rejects cross-project assets instead of leaking them into the workspace',()=> {
    expect(()=>buildCreativeWorkspaceLibrary({
      projectId:'project-2',
      generatedAssets:[generated],
      capturedMedia:[],
    })).toThrow('DIRECTOR_WORKSPACE_GENERATED_PROJECT_MISMATCH');
  });

  it('fails on duplicate IDs across captured and generated stores',()=> {
    expect(()=>buildCreativeWorkspaceLibrary({
      projectId:'project-1',
      generatedAssets:[generated],
      capturedMedia:[{...captured,id:'gen:video:1'}],
    })).toThrow('DIRECTOR_WORKSPACE_ASSET_ID_CONFLICT:gen:video:1');
  });
});
