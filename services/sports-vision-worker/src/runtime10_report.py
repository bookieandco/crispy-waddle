from __future__ import annotations
import argparse,hashlib,json
from pathlib import Path

def h(x:object)->str:return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def main()->None:
 p=argparse.ArgumentParser();p.add_argument("evidence");p.add_argument("--output",default="artifacts/runtime10/certification.json");args=p.parse_args();e=json.loads(Path(args.evidence).read_text(encoding="utf-8"));required=["runtime","clip","gameContext","candidateLedger","reid","fusion","hiddenTruth","repairs","fullGame","benchmark","networkInferenceExecuted"];missing=[k for k in required if k not in e];certified=not missing and all(bool(e[k]) for k in required if k!="benchmark") and bool(e.get("benchmark",{}).get("passed"));report={"schemaVersion":1,"modelId":"basketball-ec2xx/1","certified":certified,"missing":missing,"evidenceHash":h(e)};report["receiptHash"]=h(report);out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2),encoding="utf-8");print(json.dumps(report,indent=2));raise SystemExit(0 if certified else 3)
if __name__=="__main__":main()
