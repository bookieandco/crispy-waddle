from __future__ import annotations
import re
from typing import Any
import easyocr

class EasyOCRJerseyProvider:
 def __init__(self,gpu:bool=False)->None:
  self.reader=easyocr.Reader(["en"],gpu=gpu,verbose=False)
 def read(self,image_path:str)->tuple[str|None,float]:
  rows=self.reader.readtext(image_path,allowlist="0123456789",detail=1,paragraph=False)
  candidates=[]
  for _,text,confidence in rows:
   value=re.sub(r"\D","",str(text))
   if 1<=len(value)<=2 and 0<=int(value)<=99:candidates.append((value,float(confidence)))
  if not candidates:return None,0.0
  return max(candidates,key=lambda x:x[1])
