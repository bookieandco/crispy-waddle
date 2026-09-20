from __future__ import annotations
import hashlib,json
from pathlib import Path
from typing import Any

def canonical_hash(value:Any)->str:
 return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":")).encode()).hexdigest()

def append_receipt(path:str,receipt:dict[str,Any])->dict[str,Any]:
 p=Path(path);p.parent.mkdir(parents=True,exist_ok=True)
 previous=None
 if p.exists():
  lines=[x for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]
  if lines: previous=json.loads(lines[-1]).get("receiptHash")
 body=dict(receipt);body["previousReceiptHash"]=previous;body["receiptHash"]=canonical_hash(body)
 with p.open("a",encoding="utf-8") as f:f.write(json.dumps(body,sort_keys=True)+"\n")
 return body
