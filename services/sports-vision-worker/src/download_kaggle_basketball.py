from __future__ import annotations
import argparse,hashlib,json,os
from pathlib import Path
import kagglehub

def main()->None:
 p=argparse.ArgumentParser(description="Download a Kaggle dataset with token-only environment auth")
 p.add_argument("--dataset",default="wyattowalsh/basketball")
 p.add_argument("--receipt",default="artifacts/kaggle/basketball-dataset.json")
 args=p.parse_args()
 if not os.environ.get("KAGGLE_API_TOKEN"):
  raise RuntimeError("KAGGLE_API_TOKEN is required; keep it in the runtime secret store, never source control")
 path=Path(kagglehub.dataset_download(args.dataset))
 files=[x for x in path.rglob("*") if x.is_file()]
 receipt={"dataset":args.dataset,"path":str(path),"fileCount":len(files),"auth":"KAGGLE_API_TOKEN","tokenPersisted":False}
 receipt["manifestSha256"]=hashlib.sha256("\n".join(sorted(str(x.relative_to(path)) for x in files)).encode()).hexdigest()
 out=Path(args.receipt);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(receipt,indent=2),encoding="utf-8")
 print(json.dumps(receipt,indent=2))

if __name__=="__main__":main()
