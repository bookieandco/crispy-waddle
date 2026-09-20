from __future__ import annotations
import argparse,json
from pathlib import Path
from easyocr_jersey import EasyOCRJerseyProvider
from temporal_jersey import TemporalJerseyAggregator
from reid_embeddings import PlayerReIDEmbedder
from reid_gallery import ReIDGallery
from receipt_chain import append_receipt

def _parts(path:Path)->tuple[int,str]:
 stem=path.stem;frame,track=stem.split("_",1);return int(frame),track

def main()->None:
 p=argparse.ArgumentParser(description="Run real jersey OCR and ReID over physical player crops");p.add_argument("artifact_dir");p.add_argument("--gpu",action="store_true");args=p.parse_args();root=Path(args.artifact_dir)
 ocr=EasyOCRJerseyProvider(gpu=args.gpu);agg=TemporalJerseyAggregator();embedder=PlayerReIDEmbedder();gallery=ReIDGallery();ledger=root/"jersey-reid-ledger.jsonl"
 jerseys=sorted((root/"jersey").glob("*.jpg"))
 for path in jerseys:
  frame,track=_parts(path);value,confidence=ocr.read(str(path));agg.observe(track,value,confidence,1.0);append_receipt(str(ledger),{"kind":"JERSEY_OCR","frameIndex":frame,"trackId":track,"value":value,"confidence":confidence,"provider":"easyocr-numeric"})
 player_paths=sorted((root/"players").glob("*.jpg"))
 for path in player_paths:
  frame,track=_parts(path);e=embedder.embed(str(path));j=agg.result(track);jersey=j["candidates"][0]["number"] if j["status"]=="RESOLVED" else None;match=gallery.match(e["embedding"],None,jersey);entry=append_receipt(str(ledger),{"kind":"REID","frameIndex":frame,"trackId":track,"modelId":e["modelId"],"imageSha256":e["imageSha256"],"jersey":j,"match":match});gallery.add(track,e["embedding"],None,jersey,entry["receiptHash"])
 summary={"jerseyTracks":len({ _parts(x)[1] for x in jerseys}),"playerCrops":len(player_paths),"ledger":str(ledger)};(root/"jersey-reid-summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8");print(json.dumps(summary))
if __name__=="__main__":main()
