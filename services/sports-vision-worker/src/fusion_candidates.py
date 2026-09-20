from __future__ import annotations
from typing import Any

def build_fusion_candidates(track:dict[str,Any],roster:list[dict[str,Any]],crosswalk:list[dict[str,Any]],jersey:dict[str,Any],reid:dict[str,Any],lineup:list[dict[str,Any]])->list[dict[str,Any]]:
 team=track.get("team");number=jersey.get("candidates",[{}])[0].get("number") if jersey.get("status")=="RESOLVED" else None
 players=[p for p in roster if (team is None or p.get("team")==team) and (number is None or str(p.get("jerseyNumber",""))==str(number))]
 out=[]
 for p in players:
  cw=next((x for x in crosswalk if str(x.get("realgmPlayerId"))==str(p.get("playerId"))),None);pid=str(cw.get("nbaPlayerId")) if cw else str(p.get("playerId"))
  reid_score=float(reid.get("score",0.0)) if str(reid.get("playerId",""))==pid else 0.0
  lineup_score=max([float(x.get("confidence",0.0)) for x in lineup if str(x.get("playerId"))==pid and x.get("active")],default=0.0)
  evidence=[str(x) for x in [track.get("evidenceId"),jersey.get("evidenceId"),reid.get("evidenceId"),cw.get("officialResponseHash") if cw else None] if x]
  out.append({"playerId":pid,"roster":True,"jerseyScore":1.0 if number is not None else 0.0,"reidScore":reid_score,"lineupScore":lineup_score,"teamScore":1.0 if team else 0.0,"evidenceIds":evidence})
 return out
