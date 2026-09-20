"""Final governed media assembly runtime."""
from hashlib import sha256
from typing import Any,Protocol
class RenderBackend(Protocol):
 def render(self,request:dict[str,Any])->dict[str,Any]: ...
IDS=("sourceAssetId","compositeAssetId","voiceSyncArtifactId","animationAssetId","physicsAssetId")
def run_render(backend:RenderBackend,body:dict[str,Any])->dict[str,Any]:
 for k in IDS:
  if not isinstance(body.get(k),str) or not body[k]:raise ValueError(f"{k} is required")
 start,end=body.get("frameStart"),body.get("frameEnd")
 if not isinstance(start,int) or not isinstance(end,int) or start<0 or end<start:raise ValueError("invalid frame range")
 raw=backend.render(body);e=raw.get("evidenceIds",[])
 if raw.get("frameStart")!=start or raw.get("frameEnd")!=end:raise ValueError("backend changed governed frame range")
 if not isinstance(e,list) or not all(isinstance(x,str) for x in e):raise ValueError("invalid render evidence")
 digest=sha256((":".join(body[k] for k in IDS)+f":{start}:{end}").encode()).hexdigest()[:20]
 return {"artifactId":f"render:{digest}","mediaAssetId":raw["mediaAssetId"],**{k:body[k] for k in IDS},"continuityRef":body.get("continuityRef"),"frameStart":start,"frameEnd":end,"evidenceIds":[*e,"render-lineage:complete"]}
