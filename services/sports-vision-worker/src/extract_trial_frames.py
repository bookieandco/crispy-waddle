from __future__ import annotations
import argparse,hashlib,json,subprocess
from pathlib import Path

def main()->None:
 p=argparse.ArgumentParser();p.add_argument("video");p.add_argument("--out",default="artifacts/runtime10/frames");p.add_argument("--every-seconds",type=int,default=10);args=p.parse_args();video=Path(args.video);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(video),"-vf",f"fps=1/{args.every_seconds}",str(out/"frame_%06d.jpg")],check=True)
 frames=[]
 for i,x in enumerate(sorted(out.glob("*.jpg"))):frames.append({"frameIndex":i,"sourceSecond":i*args.every_seconds,"file":x.name,"sha256":hashlib.sha256(x.read_bytes()).hexdigest()})
 manifest={"videoSha256":hashlib.sha256(video.read_bytes()).hexdigest(),"samplingSeconds":args.every_seconds,"frameCount":len(frames),"frames":frames};m=out.parent/"frame-manifest.json";m.write_text(json.dumps(manifest,indent=2),encoding="utf-8");print(json.dumps({"frames":len(frames),"manifest":str(m)}))
if __name__=="__main__":main()
