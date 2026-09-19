"""Bounded secondary-motion runtime for character animation."""
from hashlib import sha256
from typing import Any,Protocol
MATERIALS={"cloth","hair","fur","puppet-fabric","accessory"}
class PhysicsBackend(Protocol):
 def simulate(self,request:dict[str,Any])->dict[str,Any]: ...
def run_simulation(backend:PhysicsBackend,body:dict[str,Any])->dict[str,Any]:
 for k in ("characterAssetId","rigAssetId","animationAssetId","layers"):
  if not body.get(k):raise ValueError(f"{k} is required")
 start,end=body.get("frameStart"),body.get("frameEnd")
 if not isinstance(start,int) or not isinstance(end,int) or start<0 or end<start:raise ValueError("invalid frame range")
 for layer in body["layers"]:
  if layer.get("material") not in MATERIALS or not layer.get("id") or not layer.get("attachment"):raise ValueError("invalid physics layer")
  for k in ("stiffness","damping"):
   v=layer.get(k)
   if not isinstance(v,(int,float)) or not 0<=v<=1:raise ValueError(f"{k} must be between 0 and 1")
 raw=backend.simulate(body)
 if raw.get("frameStart")!=start or raw.get("frameEnd")!=end:raise ValueError("backend changed governed frame range")
 evidence=raw.get("evidenceIds",[])
 if not isinstance(evidence,list) or not all(isinstance(x,str) for x in evidence):raise ValueError("invalid physics evidence")
 digest=sha256(f'{body["rigAssetId"]}:{body["animationAssetId"]}:{start}:{end}:{body["layers"]}'.encode()).hexdigest()[:20]
 return {"artifactId":f"physics:{digest}","simulatedAnimationAssetId":raw["simulatedAnimationAssetId"],"rigAssetId":body["rigAssetId"],"animationAssetId":body["animationAssetId"],"continuityRef":body.get("continuityRef"),"frameStart":start,"frameEnd":end,"evidenceIds":[*evidence,*[f"physics-material:{x['id']}:{x['material']}" for x in body["layers"]]]}
