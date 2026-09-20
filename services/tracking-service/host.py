"""Minimal HTTP application surface for the sandboxed tracking worker."""
from typing import Any, Callable
from worker import ArtifactDeploymentProof, run_sam2

def create_app(engine,deployment_proof:ArtifactDeploymentProof)->Callable[[str,str,dict[str,Any]],tuple[int,dict[str,Any]]]:
    def handle(method:str,path:str,body:dict[str,Any])->tuple[int,dict[str,Any]]:
        if method=="GET" and path=="/health":
            return 200,{"status":"ok"}
        if method!="POST" or path!="/v1/track":
            return 404,{"error":"not_found"}
        try:
            return 200,run_sam2(engine,body,deployment_proof)
        except ValueError as exc:
            return 400,{"error":"invalid_tracking_request","message":str(exc)}
        except Exception:
            # Never leak model paths, credentials, stack traces, or host details.
            return 500,{"error":"tracking_failed"}
    return handle
