"""Concrete runtime adapters for visual lip sync and timing engines."""
from typing import Any, Callable

def _bounded(raw:dict[str,Any], provider:str)->dict[str,Any]:
 confidence=raw.get("averageConfidence")
 if not isinstance(confidence,(int,float)) or not 0<=confidence<=1: raise ValueError(f"{provider} returned invalid confidence")
 artifact=raw.get("artifactId")
 if not isinstance(artifact,str) or not artifact: raise ValueError(f"{provider} returned invalid artifact")
 evidence=raw.get("syncEvidenceIds",[])
 if not isinstance(evidence,list) or not all(isinstance(x,str) for x in evidence): raise ValueError(f"{provider} returned invalid evidence")
 return {"artifactId":artifact,"averageConfidence":float(confidence),"syncEvidenceIds":[*evidence,f"runtime:{provider}"]}

class MuseTalkEngine:
 name="musetalk"
 def __init__(self,resolve_asset:Callable[[str],str],runtime:Callable[...,dict[str,Any]]):self.resolve_asset,self.runtime=resolve_asset,runtime
 def synchronize(self,r:dict[str,Any])->dict[str,Any]:
  return _bounded(self.runtime(video=self.resolve_asset(r["videoAssetId"]),audio=self.resolve_asset(r["audioAssetId"]),tracks=r["tracks"],character_track_id=r.get("characterTrackId")),"musetalk")

class Wav2LipEngine:
 name="wav2lip"
 def __init__(self,resolve_asset:Callable[[str],str],runtime:Callable[...,dict[str,Any]]):self.resolve_asset,self.runtime=resolve_asset,runtime
 def synchronize(self,r:dict[str,Any])->dict[str,Any]:
  return _bounded(self.runtime(video=self.resolve_asset(r["videoAssetId"]),audio=self.resolve_asset(r["audioAssetId"]),tracks=r["tracks"]),"wav2lip")

class RhubarbEngine:
 name="rhubarb"
 def __init__(self,resolve_asset:Callable[[str],str],runtime:Callable[...,dict[str,Any]]):self.resolve_asset,self.runtime=resolve_asset,runtime
 def synchronize(self,r:dict[str,Any])->dict[str,Any]:
  if r["mode"] not in ("phoneme-driven","viseme-driven"):raise ValueError("rhubarb accepts timing modes only")
  return _bounded(self.runtime(audio=self.resolve_asset(r["audioAssetId"]),mode=r["mode"],tracks=r["tracks"]),"rhubarb")
