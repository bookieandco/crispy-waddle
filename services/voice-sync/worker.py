"""Provider-neutral voice/lip synchronization worker."""
from typing import Any, Protocol
class SyncEngine(Protocol):
 name:str
 def synchronize(self,request:dict[str,Any])->dict[str,Any]: ...
class VoiceSyncRouter:
 def __init__(self,engines:dict[str,SyncEngine]): self.engines=engines
 def select(self,mode:str)->SyncEngine:
  preferred={"lip-sync":("musetalk","wav2lip"),"phoneme-driven":("rhubarb",),"viseme-driven":("rhubarb","musetalk")}.get(mode,())
  for name in preferred:
   if name in self.engines:return self.engines[name]
  raise ValueError("no voice-sync engine available for mode")
 def synchronize(self,body:dict[str,Any])->dict[str,Any]:
  for k in ("videoAssetId","audioAssetId","mode","tracks"):
   if not body.get(k):raise ValueError(f"{k} is required")
  engine=self.select(body["mode"]);raw=engine.synchronize(body)
  confidence=raw.get("averageConfidence")
  if not isinstance(confidence,(int,float)) or not 0<=confidence<=1:raise ValueError("invalid sync confidence")
  evidence=raw.get("syncEvidenceIds",[])
  if not isinstance(evidence,list) or not all(isinstance(x,str) for x in evidence):raise ValueError("invalid sync evidence")
  return {"artifactId":raw["artifactId"],"videoAssetId":body["videoAssetId"],"audioAssetId":body["audioAssetId"],"averageConfidence":confidence,"syncEvidenceIds":[*evidence,f"sync-engine:{engine.name}",f"sync-mode:{body['mode']}"]}
