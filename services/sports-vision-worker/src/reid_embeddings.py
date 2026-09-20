from __future__ import annotations
import hashlib
from pathlib import Path
from typing import Any
import cv2,numpy as np,torch
from torchvision.models import resnet50,ResNet50_Weights

class PlayerReIDEmbedder:
 def __init__(self,device:str|None=None)->None:
  self.device=device or ("cuda" if torch.cuda.is_available() else "cpu")
  weights=ResNet50_Weights.DEFAULT;model=resnet50(weights=weights);model.fc=torch.nn.Identity();self.model=model.eval().to(self.device);self.transform=weights.transforms();self.model_id="torchvision/resnet50-imagenet-feature-v1"
 def embed(self,image_path:str)->dict[str,Any]:
  from PIL import Image
  image=Image.open(image_path).convert("RGB");tensor=self.transform(image).unsqueeze(0).to(self.device)
  with torch.no_grad():v=self.model(tensor).squeeze(0).cpu().numpy().astype(np.float32)
  v/=max(float(np.linalg.norm(v)),1e-12);sha=hashlib.sha256(Path(image_path).read_bytes()).hexdigest()
  return {"modelId":self.model_id,"imageSha256":sha,"embedding":v.tolist()}

def cosine_similarity(a:list[float],b:list[float])->float:
 x=np.asarray(a,dtype=np.float32);y=np.asarray(b,dtype=np.float32);return float(np.dot(x,y)/(max(float(np.linalg.norm(x)),1e-12)*max(float(np.linalg.norm(y)),1e-12)))
