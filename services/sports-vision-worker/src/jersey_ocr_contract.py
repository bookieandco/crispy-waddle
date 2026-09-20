from __future__ import annotations
from typing import Protocol

class JerseyOCRProvider(Protocol):
 def read(self,image_path:str)->tuple[str|None,float]:...

class UnconfiguredJerseyOCR:
 def read(self,image_path:str)->tuple[str|None,float]:
  raise RuntimeError("A real jersey OCR provider/model is required; certification forbids fabricated OCR evidence")
