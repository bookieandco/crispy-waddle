"""Concrete SAM2 runtime seam.

Model and asset I/O are injected so this module can run on GPU hosts without
giving the inference layer Jhadina credentials or policy authority.
"""
from hashlib import sha256
from typing import Any, Callable
from worker import Sam2Request

class Sam2RuntimeEngine:
    def __init__(self, resolve_asset:Callable[[str],str], predictor_factory:Callable[[],Any], persist_mask:Callable[[str,int,str,Any],str]):
        self._resolve_asset=resolve_asset
        self._predictor_factory=predictor_factory
        self._persist_mask=persist_mask
        self._predictor=None

    def _model(self):
        if self._predictor is None:
            self._predictor=self._predictor_factory()
        return self._predictor

    def track_video(self, request:Sam2Request)->dict[str,Any]:
        source_path=self._resolve_asset(request.source_asset_id)
        result=self._model().track_video(source_path=source_path,frame_start=request.frame_start,frame_end=request.frame_end,classes=list(request.classes),seed_annotations=list(request.seed_annotations))
        tracks=result.get("tracks",[])
        refs=[]
        for item in result.get("masks",[]):
            refs.append(self._persist_mask(request.source_asset_id,int(item["frame"]),str(item["instanceId"]),item["mask"]))
        digest=sha256(f"{request.source_asset_id}:{request.frame_start}:{request.frame_end}:{','.join(request.classes)}".encode()).hexdigest()[:20]
        return {"artifactId":f"sam2:{digest}","tracks":tracks,"segmentationRefs":refs,"keypointRefs":list(result.get("keypointRefs",[]))}
