"""Sandboxed character replacement compositor."""
from hashlib import sha256
from typing import Any, Protocol
class CompositeEngine(Protocol):
 def composite(self,request:dict[str,Any])->dict[str,Any]: ...
REQUIRED=("sourceAssetId","replacementAssetId","trackingArtifactId","approvedTrackIds")
def run_composite(engine:CompositeEngine,body:dict[str,Any])->dict[str,Any]:
 for key in REQUIRED:
  if key not in body or body[key] in ("",None,[]): raise ValueError(f"{key} is required")
 if not isinstance(body["approvedTrackIds"],list) or not all(isinstance(x,str) for x in body["approvedTrackIds"]): raise ValueError("approvedTrackIds must be strings")
 raw=engine.composite(body)
 if not isinstance(raw.get("artifactId"),str): raise ValueError("compositor returned invalid artifact")
 evidence=raw.get("compositeEvidenceIds",[])
 if not isinstance(evidence,list) or not all(isinstance(x,str) for x in evidence): raise ValueError("compositor returned invalid evidence")
 return {"artifactId":raw["artifactId"],"trackingArtifactId":body["trackingArtifactId"],"compositeEvidenceIds":evidence,"continuityRef":body.get("continuityRef")}
