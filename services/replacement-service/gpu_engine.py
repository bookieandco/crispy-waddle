"""GPU-ready mask-guided compositor engine.

Concrete frame decode/GPU kernels/encode are injected. This keeps media runtime
replaceable while enforcing the Director replacement recipe and evidence.
"""
from hashlib import sha256
from typing import Any, Protocol

class MediaBackend(Protocol):
 def load_masks(self,tracking_artifact_id:str,track_ids:list[str])->list[Any]: ...
 def composite(self,source_asset_id:str,replacement_asset_id:str,masks:list[Any],*,preserve_motion:bool,preserve_lighting:bool,edge_blend:bool,color_match:bool)->dict[str,Any]: ...
 def persist(self,frames:Any,artifact_id:str)->str: ...

class GpuCompositeEngine:
 def __init__(self,backend:MediaBackend): self.backend=backend
 def composite(self,request:dict[str,Any])->dict[str,Any]:
  masks=self.backend.load_masks(request["trackingArtifactId"],request["approvedTrackIds"])
  if not masks: raise ValueError("approved tracks have no segmentation masks")
  result=self.backend.composite(request["sourceAssetId"],request["replacementAssetId"],masks,preserve_motion=request.get("preserveMotion",True),preserve_lighting=request.get("preserveLighting",True),edge_blend=True,color_match=True)
  for metric in ("temporalConsistency","edgeQuality","lightingMatch"):
   score=result.get(metric)
   if not isinstance(score,(int,float)) or not 0<=score<=1: raise ValueError(f"invalid compositor metric: {metric}")
  digest=sha256(f'{request["sourceAssetId"]}:{request["replacementAssetId"]}:{request["trackingArtifactId"]}:{",".join(request["approvedTrackIds"])}'.encode()).hexdigest()[:20]
  artifact_id=f"composite:{digest}"
  persisted=self.backend.persist(result["frames"],artifact_id)
  if persisted!=artifact_id: raise ValueError("persisted composite identity mismatch")
  evidence=[f'composite:temporal:{result["temporalConsistency"]:.4f}',f'composite:edge:{result["edgeQuality"]:.4f}',f'composite:lighting:{result["lightingMatch"]:.4f}',"composite:edge-blend:true","composite:color-match:true"]
  return {"artifactId":artifact_id,"compositeEvidenceIds":evidence}
