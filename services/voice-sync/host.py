"""Minimal safe host for voice-sync worker."""
from typing import Any
def create_app(router):
 def handle(method:str,path:str,body:dict[str,Any]|None=None):
  if method=="GET" and path=="/health":return 200,{"status":"ok"}
  if method!="POST" or path!="/v1/synchronize":return 404,{"error":"not_found"}
  try:return 200,router.synchronize(body or {})
  except ValueError as exc:return 400,{"error":"invalid_voice_sync_request","message":str(exc)}
  except Exception:return 500,{"error":"voice_sync_failed"}
 return handle
