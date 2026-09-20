from __future__ import annotations
from typing import Any

def weakest_component(metrics:dict[str,float])->dict[str,Any]:
 targets={"detectorRecall":.90,"teamAccuracy":.98,"jerseyAccuracy":.90,"reidAccuracy":.95,"identityPrecision":.98,"identityRecall":.90};gaps=[(k,targets[k]-float(metrics.get(k,0.0))) for k in targets];name,gap=max(gaps,key=lambda x:x[1]);return {"metric":name,"target":targets[name],"observed":float(metrics.get(name,0.0)),"gap":gap,"repairRequired":gap>0}
