"""Sandboxed character replacement compositor."""
from typing import Any, Protocol

class CompositeEngine(Protocol):
 def composite(self,request:dict[str,Any])->dict[str,Any]: ...

REQUIRED=("sourceAssetId","replacementAssetId","trackingArtifactId","approvedTrackIds")
ENVIRONMENT_MODES={"preserve-source","reference-frame","regenerate"}
ASPECT_POLICIES={"strict-match","fit-crop"}

def _dimensions(value:Any,name:str)->dict[str,int]|None:
 if value is None:return None
 if not isinstance(value,dict):raise ValueError(f"{name} must be an object")
 width,height=value.get("width"),value.get("height")
 if not isinstance(width,int) or not isinstance(height,int) or width<=0 or height<=0:
  raise ValueError(f"{name} are invalid")
 return {"width":width,"height":height}

def _ratio_matches(a:dict[str,int],b:dict[str,int],tolerance:float=.02)->bool:
 return abs((a["width"]/a["height"])-(b["width"]/b["height"]))<=tolerance

def normalize_request(body:dict[str,Any])->dict[str,Any]:
 for key in REQUIRED:
  if key not in body or body[key] in ("",None,[]): raise ValueError(f"{key} is required")
 if not isinstance(body["approvedTrackIds"],list) or not all(isinstance(x,str) and x for x in body["approvedTrackIds"]):
  raise ValueError("approvedTrackIds must be non-empty strings")

 normalized=dict(body)
 normalized["preserveMotion"]=body.get("preserveMotion",True)
 normalized["preserveFacialMotion"]=body.get("preserveFacialMotion",True)
 normalized["preserveLighting"]=body.get("preserveLighting",True)
 normalized["preserveOrientation"]=body.get("preserveOrientation",True)
 for key in ("preserveMotion","preserveFacialMotion","preserveLighting","preserveOrientation"):
  if not isinstance(normalized[key],bool): raise ValueError(f"{key} must be boolean")

 normalized["motionReferenceAssetId"]=body.get("motionReferenceAssetId") or body["sourceAssetId"]
 if not isinstance(normalized["motionReferenceAssetId"],str) or not normalized["motionReferenceAssetId"]:
  raise ValueError("motionReferenceAssetId is required")
 if normalized["preserveMotion"] and normalized["motionReferenceAssetId"]!=body["sourceAssetId"]:
  raise ValueError("source motion lock must use sourceAssetId")

 normalized["environmentMode"]=body.get("environmentMode","preserve-source")
 if normalized["environmentMode"] not in ENVIRONMENT_MODES: raise ValueError("invalid environmentMode")
 env_ref=body.get("environmentReferenceAssetId")
 if normalized["environmentMode"]=="reference-frame":
  if not isinstance(env_ref,str) or not env_ref: raise ValueError("environmentReferenceAssetId is required for reference-frame mode")
 elif env_ref is not None:
  raise ValueError("environmentReferenceAssetId is only valid for reference-frame mode")
 normalized["environmentReferenceAssetId"]=env_ref

 normalized["aspectRatioPolicy"]=body.get("aspectRatioPolicy","strict-match")
 if normalized["aspectRatioPolicy"] not in ASPECT_POLICIES: raise ValueError("invalid aspectRatioPolicy")
 source_dims=_dimensions(body.get("sourceDimensions"),"sourceDimensions")
 replacement_dims=_dimensions(body.get("replacementDimensions"),"replacementDimensions")
 if (source_dims is None)!=(replacement_dims is None):
  raise ValueError("sourceDimensions and replacementDimensions must be supplied together")
 if normalized["aspectRatioPolicy"]=="strict-match" and source_dims and replacement_dims and not _ratio_matches(source_dims,replacement_dims):
  raise ValueError("replacement aspect ratio must match source video")
 normalized["sourceDimensions"]=source_dims
 normalized["replacementDimensions"]=replacement_dims
 return normalized

def run_composite(engine:CompositeEngine,body:dict[str,Any])->dict[str,Any]:
 request=normalize_request(body)
 raw=engine.composite(request)
 if not isinstance(raw.get("artifactId"),str) or not raw["artifactId"]: raise ValueError("compositor returned invalid artifact")
 evidence=raw.get("compositeEvidenceIds",[])
 if not isinstance(evidence,list) or not evidence or not all(isinstance(x,str) and x for x in evidence):
  raise ValueError("compositor returned invalid evidence")
 return {
  "artifactId":raw["artifactId"],
  "trackingArtifactId":request["trackingArtifactId"],
  "compositeEvidenceIds":evidence,
  "continuityRef":request.get("continuityRef"),
  "motionReferenceAssetId":request["motionReferenceAssetId"],
  "environmentMode":request["environmentMode"],
  "environmentReferenceAssetId":request.get("environmentReferenceAssetId"),
 }
