"""HTTP proxy backend for real Director GPU/model workers."""
from __future__ import annotations

import json
import os
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError
from typing import Any


class HttpBackend:
    name="director-http-backend"
    production_ready=True

    def __init__(self,dataset_url:str,lora_url:str,upscale_url:str,token:str|None=None,timeout_seconds:int=900):
        self.dataset_url=dataset_url
        self.lora_url=lora_url
        self.upscale_url=upscale_url
        self.token=token
        self.timeout_seconds=timeout_seconds

    @classmethod
    def from_env(cls)->"HttpBackend":
        values={
            "dataset_url":os.getenv("DIRECTOR_CHARACTER_DATASET_BACKEND_URL","").strip(),
            "lora_url":os.getenv("DIRECTOR_CHARACTER_LORA_BACKEND_URL","").strip(),
            "upscale_url":os.getenv("DIRECTOR_VIDEO_UPSCALE_BACKEND_URL","").strip(),
        }
        missing=[name for name,value in values.items() if not value]
        if missing:
            raise ValueError("DIRECTOR_BACKENDS_NOT_CONFIGURED:"+",".join(missing))
        timeout=int(os.getenv("DIRECTOR_CHARACTER_TRAINING_BACKEND_TIMEOUT_SECONDS","900"))
        if timeout<1 or timeout>7200:
            raise ValueError("DIRECTOR_BACKEND_TIMEOUT_INVALID")
        return cls(
            values["dataset_url"],
            values["lora_url"],
            values["upscale_url"],
            os.getenv("DIRECTOR_CHARACTER_TRAINING_BACKEND_TOKEN") or None,
            timeout,
        )

    def generate_dataset(self,request:dict[str,Any])->dict[str,Any]:
        return self._post(self.dataset_url,request)

    def train_lora(self,request:dict[str,Any])->dict[str,Any]:
        return self._post(self.lora_url,request)

    def upscale_video(self,request:dict[str,Any])->dict[str,Any]:
        return self._post(self.upscale_url,request)

    def _post(self,url:str,body:dict[str,Any])->dict[str,Any]:
        headers={"content-type":"application/json","user-agent":"jhadina-director-character-training/1"}
        if self.token:
            headers["authorization"]=f"Bearer {self.token}"
        req=urllib_request.Request(url,data=json.dumps(body).encode(),headers=headers,method="POST")
        try:
            with urllib_request.urlopen(req,timeout=self.timeout_seconds) as response:
                payload=response.read()
        except HTTPError as exc:
            raise RuntimeError(f"DIRECTOR_BACKEND_HTTP_{exc.code}") from exc
        except URLError as exc:
            raise RuntimeError("DIRECTOR_BACKEND_UNREACHABLE") from exc
        try:
            decoded=json.loads(payload)
        except Exception as exc:
            raise RuntimeError("DIRECTOR_BACKEND_INVALID_JSON") from exc
        if not isinstance(decoded,dict):
            raise RuntimeError("DIRECTOR_BACKEND_INVALID_RESPONSE")
        return decoded
