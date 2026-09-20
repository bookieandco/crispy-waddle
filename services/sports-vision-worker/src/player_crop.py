from __future__ import annotations
from pathlib import Path
from typing import Any
import cv2

def save_player_crops(frame,tracks:list[dict[str,Any]],frame_index:int,out_dir:str)->list[dict[str,Any]]:
 root=Path(out_dir);root.mkdir(parents=True,exist_ok=True);h,w=frame.shape[:2];out=[]
 for t in tracks:
  x1,y1,x2,y2=[int(v) for v in t["xyxy"]];x1=max(0,min(w,x1));x2=max(0,min(w,x2));y1=max(0,min(h,y1));y2=max(0,min(h,y2));crop=frame[y1:y2,x1:x2]
  if crop.size==0:continue
  name=f"{frame_index:06d}_{t['trackId']}.jpg";path=root/name;cv2.imwrite(str(path),crop);out.append({"trackId":t["trackId"],"frameIndex":frame_index,"path":str(path)})
 return out
