from __future__ import annotations
import argparse,json
from pathlib import Path

def main()->None:
 p=argparse.ArgumentParser(description="Validate post-inference hidden identity truth");p.add_argument("truth");p.add_argument("--minimum",type=int,default=50);args=p.parse_args();rows=json.loads(Path(args.truth).read_text(encoding="utf-8"));ids=[x.get("trackId") for x in rows];ok=len(rows)>=args.minimum and len(set(ids))==len(ids) and all(x.get("revealedAfterInference") is True and x.get("playerId") for x in rows);print(json.dumps({"passed":ok,"tracks":len(rows)}));raise SystemExit(0 if ok else 2)
if __name__=="__main__":main()
