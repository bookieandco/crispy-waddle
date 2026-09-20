from __future__ import annotations
from typing import Any

def normalize_predictions(receipt:dict[str,Any],frame_index:int)->list[dict[str,Any]]:
 out=[]
 for i,p in enumerate(receipt.get("predictions",[])):
  confidence=float(p.get("confidence",0.0));w=float(p.get("width",0.0));h=float(p.get("height",0.0))
  if confidence<0 or confidence>1 or w<0 or h<0:continue
  out.append({"observationId":f"{receipt['rawResponseSha256']}:{i}","frameIndex":frame_index,"class":str(p.get("class","unknown")),"classId":p.get("class_id"),"confidence":confidence,"box":{"cx":float(p.get("x",0.0)),"cy":float(p.get("y",0.0)),"width":w,"height":h},"modelId":receipt["modelId"],"sourceImageSha256":receipt["image"]["sha256"],"inferenceResponseSha256":receipt["rawResponseSha256"]})
 return out
