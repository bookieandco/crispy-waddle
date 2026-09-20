from __future__ import annotations
from collections import defaultdict
from typing import Any

class TemporalJerseyAggregator:
 def __init__(self)->None:self._votes:dict[str,dict[str,float]]=defaultdict(lambda:defaultdict(float))
 def observe(self,track_id:str,value:str|None,confidence:float,quality:float)->None:
  if value and value.isdigit() and 0<=int(value)<=99 and confidence>=.35:self._votes[track_id][value]+=confidence*max(0.0,min(1.0,quality))
 def result(self,track_id:str)->dict[str,Any]:
  ranked=sorted(self._votes[track_id].items(),key=lambda x:x[1],reverse=True)
  if not ranked:return {"status":"UNKNOWN","candidates":[]}
  top=ranked[0];second=ranked[1] if len(ranked)>1 else None
  status="RESOLVED" if top[1]>=1.5 and (second is None or top[1]>=1.5*second[1]) else "AMBIGUOUS"
  return {"status":status,"candidates":[{"number":n,"score":s} for n,s in ranked]}
