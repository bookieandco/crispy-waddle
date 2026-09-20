from __future__ import annotations
from typing import Any

def roster_candidates(roster:list[dict[str,Any]],team:str|None,jersey:str|None)->list[dict[str,Any]]:
 return [p for p in roster if (team is None or p.get("team")==team) and (jersey is None or str(p.get("jerseyNumber",""))==jersey)]

def candidate_receipt(track_id:str,team:dict[str,Any],jersey:dict[str,Any],roster:list[dict[str,Any]])->dict[str,Any]:
 team_name=team.get("team") if team.get("status")=="RESOLVED" else None
 jersey_no=jersey.get("candidates",[{}])[0].get("number") if jersey.get("status")=="RESOLVED" else None
 candidates=roster_candidates(roster,team_name,jersey_no)
 status="RESOLVED_CANDIDATE" if team_name and jersey_no and len(candidates)==1 else "AMBIGUOUS" if candidates else "UNKNOWN"
 return {"trackId":track_id,"teamEvidence":team,"jerseyEvidence":jersey,"candidatePlayerIds":[str(x.get("playerId")) for x in candidates],"status":status,"identityResolved":False}
