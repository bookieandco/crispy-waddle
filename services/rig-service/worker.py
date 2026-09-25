"""Approved-tracking to rig/animation runtime."""
from hashlib import sha256
import json
from typing import Any,Protocol
ALLOWED={"body","head","face","hands"}
class RigBackend(Protocol):
 def animate(self,request:dict[str,Any])->dict[str,Any]: ...
def run_animation(backend:RigBackend,body:dict[str,Any])->dict[str,Any]:
 for k in ("characterAssetId","trackingArtifactId","approvedTrackIds","channels"):
  if not body.get(k):raise ValueError(f"{k} is required")
 if any(c not in ALLOWED for c in body["channels"]):raise ValueError("unsupported rig channel")
 raw=backend.animate(body);start,end=raw.get("frameStart"),raw.get("frameEnd")
 if not isinstance(start,int) or not isinstance(end,int) or start<0 or end<start:raise ValueError("invalid animation frame range")
 evidence=raw.get("evidenceIds",[])
 if not isinstance(evidence,list) or not all(isinstance(x,str) for x in evidence):raise ValueError("invalid rig evidence")
 identity={
  "characterAssetId":body["characterAssetId"],
  "trackingArtifactId":body["trackingArtifactId"],
  "approvedTrackIds":body["approvedTrackIds"],
  "channels":body["channels"],
  "animationPlan":body.get("animationPlan"),
  "performancePlan":body.get("performancePlan"),
  "motionEffectsPlan":body.get("motionEffectsPlan"),
  "locomotionPlan":body.get("locomotionPlan"),
  "rigScopePlan":body.get("rigScopePlan"),
  "continuityRef":body.get("continuityRef"),
 }
 digest=sha256(json.dumps(identity,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()[:20]
 return {"artifactId":f"rig-animation:{digest}","rigAssetId":raw["rigAssetId"],"animationAssetId":raw["animationAssetId"],"trackingArtifactId":body["trackingArtifactId"],"continuityRef":body.get("continuityRef"),"frameStart":start,"frameEnd":end,"evidenceIds":[*evidence,f"rig-channels:{','.join(body['channels'])}"]}
