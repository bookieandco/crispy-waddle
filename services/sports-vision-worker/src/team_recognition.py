from __future__ import annotations
from collections import defaultdict
from typing import Any
import cv2,numpy as np
from sklearn.cluster import KMeans

def _jersey_feature(frame:np.ndarray,xyxy:list[float])->list[float]|None:
 h,w=frame.shape[:2];x1,y1,x2,y2=[int(v) for v in xyxy];x1=max(0,min(w,x1));x2=max(0,min(w,x2));y1=max(0,min(h,y1));y2=max(0,min(h,y2))
 crop=frame[y1:y1+max(1,(y2-y1)//2),x1:x2]
 if crop.size==0:return None
 hsv=cv2.cvtColor(crop,cv2.COLOR_BGR2HSV);pixels=hsv.reshape(-1,3)
 if len(pixels)<10:return None
 med=np.median(pixels,axis=0);return [float(v) for v in med]

def infer_two_team_clusters(frame:np.ndarray,tracks:list[dict[str,Any]])->list[dict[str,Any]]:
 rows=[];features=[]
 for t in tracks:
  f=_jersey_feature(frame,t["xyxy"])
  if f is not None:rows.append(t);features.append(f)
 if len(features)<4:return [{**t,"teamCluster":None,"teamEvidence":"INSUFFICIENT"} for t in tracks]
 labels=KMeans(n_clusters=2,random_state=0,n_init=10).fit_predict(np.asarray(features))
 by_track={r["trackId"]:int(label) for r,label in zip(rows,labels)}
 return [{**t,"teamCluster":by_track.get(t["trackId"]),"teamEvidence":"JERSEY_COLOR_CLUSTER" if t["trackId"] in by_track else "INSUFFICIENT"} for t in tracks]
