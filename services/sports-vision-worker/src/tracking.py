from __future__ import annotations
from typing import Any
import numpy as np
import supervision as sv

class PlayerTracker:
 def __init__(self)->None:self.tracker=sv.ByteTrack()
 def update(self,observations:list[dict[str,Any]])->list[dict[str,Any]]:
  if not observations:return []
  xyxy=np.array([[o["box"]["cx"]-o["box"]["width"]/2,o["box"]["cy"]-o["box"]["height"]/2,o["box"]["cx"]+o["box"]["width"]/2,o["box"]["cy"]+o["box"]["height"]/2] for o in observations],dtype=float)
  conf=np.array([o["confidence"] for o in observations],dtype=float)
  detections=sv.Detections(xyxy=xyxy,confidence=conf,class_id=np.zeros(len(observations),dtype=int))
  tracked=self.tracker.update_with_detections(detections)
  out=[]
  for i,box in enumerate(tracked.xyxy):
   tid=int(tracked.tracker_id[i]) if tracked.tracker_id is not None else -1
   out.append({"trackId":f"track-{tid}","xyxy":[float(v) for v in box],"confidence":float(tracked.confidence[i]) if tracked.confidence is not None else 0.0})
  return out
