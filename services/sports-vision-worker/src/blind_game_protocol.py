from __future__ import annotations
import json
from pathlib import Path

def initialize(path:str,game_id:str,video_sha256:str)->dict:
 state={"gameId":game_id,"videoSha256":video_sha256,"groundTruthLocked":True,"officialDataQuarantined":True,"manualIdentityEdits":0,"complete":False};Path(path).write_text(json.dumps(state,indent=2),encoding="utf-8");return state
def complete(path:str,tracks:int,resolved:int,ambiguous:int,unknown:int,inference_receipts:int,ledger_hash:str)->dict:
 p=Path(path);state=json.loads(p.read_text(encoding="utf-8"));state.update({"complete":True,"tracks":tracks,"resolved":resolved,"ambiguous":ambiguous,"unknown":unknown,"inferenceReceiptCount":inference_receipts,"identityLedgerHash":ledger_hash});p.write_text(json.dumps(state,indent=2),encoding="utf-8");return state
