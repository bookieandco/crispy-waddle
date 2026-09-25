"""GPU-ready mask-guided compositor engine.

Concrete frame decode/GPU kernels/encode are injected. This keeps media runtime
replaceable while enforcing the Director replacement recipe and evidence.
"""
from hashlib import sha256
from typing import Any, Protocol

class MediaBackend(Protocol):
 def load_masks(self,tracking_artifact_id:str,track_ids:list[str])->list[Any]: ...
 def composite(
  self,
  source_asset_id:str,
  replacement_asset_id:str,
  masks:list[Any],
  *,
  preserve_motion:bool,
  preserve_facial_motion:bool,
  preserve_lighting:bool,
  preserve_orientation:bool,
  environment_mode:str,
  environment_reference_asset_id:str|None,
  motion_reference_asset_id:str,
  edge_blend:bool,
  color_match:bool,
 )->dict[str,Any]: ...
 def persist(self,frames:Any,artifact_id:str)->str: ...

class GpuCompositeEngine:
 def __init__(self,backend:MediaBackend): self.backend=backend

 def composite(self,request:dict[str,Any])->dict[str,Any]:
  masks=self.backend.load_masks(request["trackingArtifactId"],request["approvedTrackIds"])
  if not masks: raise ValueError("approved tracks have no segmentation masks")
  preserve_motion=request.get("preserveMotion",True)
  preserve_facial=request.get("preserveFacialMotion",True)
  preserve_lighting=request.get("preserveLighting",True)
  preserve_orientation=request.get("preserveOrientation",True)
  environment_mode=request.get("environmentMode","preserve-source")
  motion_reference=request.get("motionReferenceAssetId") or request["sourceAssetId"]
  environment_reference=request.get("environmentReferenceAssetId")
  result=self.backend.composite(
   request["sourceAssetId"],
   request["replacementAssetId"],
   masks,
   preserve_motion=preserve_motion,
   preserve_facial_motion=preserve_facial,
   preserve_lighting=preserve_lighting,
   preserve_orientation=preserve_orientation,
   environment_mode=environment_mode,
   environment_reference_asset_id=environment_reference,
   motion_reference_asset_id=motion_reference,
   edge_blend=True,
   color_match=True,
  )
  required=["temporalConsistency","edgeQuality"]
  if preserve_lighting: required.append("lightingMatch")
  if preserve_motion: required.append("motionMatch")
  if preserve_facial: required.append("facialMotionMatch")
  if preserve_orientation: required.append("orientationMatch")
  if environment_mode!="regenerate": required.append("backgroundMatch")
  for metric in required:
   score=result.get(metric)
   if not isinstance(score,(int,float)) or not 0<=score<=1: raise ValueError(f"invalid compositor metric: {metric}")

  lineage=":".join([
   request["sourceAssetId"],
   request["replacementAssetId"],
   request["trackingArtifactId"],
   ",".join(request["approvedTrackIds"]),
   motion_reference,
   environment_mode,
   environment_reference or "",
  ])
  digest=sha256(lineage.encode()).hexdigest()[:20]
  artifact_id=f"composite:{digest}"
  persisted=self.backend.persist(result["frames"],artifact_id)
  if persisted!=artifact_id: raise ValueError("persisted composite identity mismatch")
  evidence=[
   f'composite:temporal:{result["temporalConsistency"]:.4f}',
   f'composite:edge:{result["edgeQuality"]:.4f}',
   "composite:edge-blend:true",
   "composite:color-match:true",
   f"composite:motion-lock:{str(preserve_motion).lower()}",
   f"composite:facial-motion-lock:{str(preserve_facial).lower()}",
   f"composite:orientation-lock:{str(preserve_orientation).lower()}",
   f"composite:environment-mode:{environment_mode}",
   f"composite:motion-reference:{motion_reference}",
  ]
  optional_metrics=[
   ("lightingMatch","lighting"),
   ("motionMatch","motion"),
   ("facialMotionMatch","facial-motion"),
   ("orientationMatch","orientation"),
   ("backgroundMatch","background"),
  ]
  for metric,label in optional_metrics:
   if metric in result: evidence.append(f'composite:{label}:{result[metric]:.4f}')
  if environment_reference: evidence.append(f"composite:environment-reference:{environment_reference}")
  return {"artifactId":artifact_id,"compositeEvidenceIds":evidence}
