from __future__ import annotations
from pathlib import Path
from typing import Any
import cv2

def save_jersey_crops(frame,tracks:list[dict[str,Any]],frame_index:int,out_dir:str)->list[dict[str,Any]]:
 root=Path(out_dir);root.mkdir(parents=True,exist_ok=True);h,w=frame.shape[:2];out=[]
 for t in tracks:
  x1,y1,x2,y2=[int(v) for v in t["xyxy"]];bw=max(1,x2-x1);bh=max(1,y2-y1)
  # Central upper torso only; OCR is a later evidence source, never identity truth.
  a=max(0,x1+int(.15*bw));b=min(w,x2-int(.15*bw));c=max(0,y1+int(.08*bh));d=min(h,y1+int(.62*bh));crop=frame[c:d,a:b]
  if crop.size==0:continue
  name=f"{frame_index:06d}_{t['trackId']}.jpg";path=root/name;cv2.imwrite(str(path),crop);out.append({"trackId":t["trackId"],"frameIndex":frame_index,"path":str(path)})
 return out
