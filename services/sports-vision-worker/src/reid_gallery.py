from __future__ import annotations
from collections import defaultdict
from typing import Any
from reid_embeddings import cosine_similarity

class ReIDGallery:
 def __init__(self,threshold:float=.82)->None:self.threshold=threshold;self._items:dict[str,list[dict[str,Any]]]=defaultdict(list)
 def add(self,track_id:str,embedding:list[float],team_cluster:int|None,jersey:str|None,evidence_id:str)->None:self._items[track_id].append({"embedding":embedding,"teamCluster":team_cluster,"jersey":jersey,"evidenceId":evidence_id})
 def match(self,embedding:list[float],team_cluster:int|None,jersey:str|None)->dict[str,Any]:
  ranked=[]
  for track_id,items in self._items.items():
   compatible=[x for x in items if (team_cluster is None or x["teamCluster"] is None or x["teamCluster"]==team_cluster) and (jersey is None or x["jersey"] is None or x["jersey"]==jersey)]
   if not compatible:continue
   score=max(cosine_similarity(embedding,x["embedding"]) for x in compatible);ranked.append({"trackId":track_id,"score":score})
  ranked.sort(key=lambda x:x["score"],reverse=True);top=ranked[0] if ranked else None;second=ranked[1] if len(ranked)>1 else None
  accepted=bool(top and top["score"]>=self.threshold and (second is None or top["score"]-second["score"]>=.04))
  return {"accepted":accepted,"match":top if accepted else None,"candidates":ranked[:5]}
