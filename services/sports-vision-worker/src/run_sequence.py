from __future__ import annotations
import argparse,json
from pathlib import Path
from roboflow_client import infer_image
from receipt_chain import append_receipt

def main()->None:
 p=argparse.ArgumentParser();p.add_argument("frames");p.add_argument("--ledger",default="artifacts/inference-ledger.jsonl");args=p.parse_args()
 root=Path(args.frames);images=sorted([x for x in root.iterdir() if x.suffix.lower() in {".jpg",".jpeg",".png",".webp"}])
 if not images:raise RuntimeError("No image frames found")
 counts={}
 for i,image in enumerate(images):
  r=infer_image(str(image));entry=append_receipt(args.ledger,{"frameIndex":i,**r})
  for pred in r["predictions"]:
   name=str(pred.get("class","unknown"));counts[name]=counts.get(name,0)+1
  print(json.dumps({"frame":i,"image":image.name,"predictions":r["predictionCount"],"receiptHash":entry["receiptHash"]}))
 print(json.dumps({"frames":len(images),"classes":counts},sort_keys=True))
if __name__=="__main__":main()
