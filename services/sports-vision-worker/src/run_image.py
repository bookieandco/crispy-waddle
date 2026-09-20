from __future__ import annotations
import argparse,json
from pathlib import Path
from roboflow_client import infer_image
def main()->None:
 p=argparse.ArgumentParser(description="Run provenance-preserving basketball image inference")
 p.add_argument("image");p.add_argument("--output",default="artifacts/roboflow-inference.json");args=p.parse_args()
 receipt=infer_image(args.image);out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(receipt,indent=2),encoding="utf-8")
 print(json.dumps({k:receipt[k] for k in ("modelId","predictionCount","rawResponseSha256")},indent=2))
if __name__=="__main__": main()
