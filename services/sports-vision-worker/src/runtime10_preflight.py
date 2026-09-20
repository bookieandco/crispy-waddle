from __future__ import annotations
import argparse,hashlib,json,shutil,subprocess
from pathlib import Path

def main()->None:
 p=argparse.ArgumentParser();p.add_argument("video");args=p.parse_args();v=Path(args.video);probe=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration,size","-show_entries","stream=codec_name,width,height,avg_frame_rate","-of","json",str(v)],capture_output=True,text=True,check=True);result={"videoSha256":hashlib.sha256(v.read_bytes()).hexdigest(),"ffmpeg":shutil.which("ffmpeg") is not None,"ffprobe":json.loads(probe.stdout),"networkInferenceExecuted":False};print(json.dumps(result,indent=2))
if __name__=="__main__":main()
