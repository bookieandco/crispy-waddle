from __future__ import annotations
import argparse,json
from pathlib import Path
import cv2
from roboflow_client import infer_image
from normalize_predictions import normalize_predictions
from tracking import PlayerTracker
from team_recognition import infer_two_team_clusters
from jersey_crop import save_jersey_crops
from player_crop import save_player_crops
from receipt_chain import append_receipt

def main()->None:
 p=argparse.ArgumentParser(description="Roboflow -> ByteTrack -> team evidence -> OCR/ReID crops");p.add_argument("frames");p.add_argument("--artifacts",default="artifacts/identity-trial");args=p.parse_args()
 root=Path(args.frames);artifact=Path(args.artifacts);artifact.mkdir(parents=True,exist_ok=True);tracker=PlayerTracker();summary={"frames":0,"detections":0,"tracks":set(),"teamEvidence":0,"jerseyCrops":0,"playerCrops":0}
 images=sorted(x for x in root.iterdir() if x.suffix.lower() in {".jpg",".jpeg",".png",".webp"})
 for fi,image in enumerate(images):
  frame=cv2.imread(str(image))
  if frame is None:continue
  receipt=infer_image(str(image));obs=normalize_predictions(receipt,fi);players=[o for o in obs if o["class"].lower() in {"person","player"}]
  tracks=tracker.update(players);teams=infer_two_team_clusters(frame,tracks);jerseys=save_jersey_crops(frame,teams,fi,str(artifact/"jersey"));player_crops=save_player_crops(frame,teams,fi,str(artifact/"players"))
  entry=append_receipt(str(artifact/"identity-ledger.jsonl"),{"frameIndex":fi,"imageSha256":receipt["image"]["sha256"],"inferenceResponseSha256":receipt["rawResponseSha256"],"tracks":teams,"jerseyCrops":jerseys,"playerCrops":player_crops})
  summary["frames"]+=1;summary["detections"]+=len(obs);summary["tracks"].update(t["trackId"] for t in tracks);summary["teamEvidence"]+=sum(t.get("teamCluster") is not None for t in teams);summary["jerseyCrops"]+=len(jerseys);summary["playerCrops"]+=len(player_crops)
  print(json.dumps({"frame":fi,"tracks":len(tracks),"jerseyCrops":len(jerseys),"playerCrops":len(player_crops),"receiptHash":entry["receiptHash"]}))
 out={**summary,"tracks":len(summary["tracks"])};(artifact/"summary.json").write_text(json.dumps(out,indent=2),encoding="utf-8");print(json.dumps(out))
if __name__=="__main__":main()
