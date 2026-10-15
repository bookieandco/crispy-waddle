"""Public, strictly read-only research snapshots for the five-lab experiment.
Public catalog observations are not engagement, revenue, playback, or trade outcomes.
"""
import datetime as dt
import hashlib
import json
import math
import urllib.error
import urllib.parse
import urllib.request
import time
from domain_evidence import evidence
from grant_details import enrich_grants

SOURCES = {
 "capital": ("https://api.exchange.coinbase.com/products/BTC-USD/ticker", None),
 "social_music": ("https://itunes.apple.com/search?term=hip%20hop&media=music&entity=song&country=us&limit=10", None),
 "business": ("https://api.grants.gov/v1/api/search2", {"keyword":"business","oppStatuses":"posted","rows":10}),
 "tv_music": ("https://itunes.apple.com/search?term=Planet%20Earth&media=tvShow&country=us&limit=10", None),
 "tv_music_catalog": ("https://itunes.apple.com/search?term=jazz&media=music&entity=song&country=us&limit=10", None)
}
def digest(data):
    return hashlib.sha256(data).hexdigest()
def fetch_public_json(url, payload=None):
    # Exact provider allowlist: no dynamic user-supplied URL, credentials, or account API.
    if (url, payload) not in [(u,p) for u,p in SOURCES.values()]:
        raise ValueError("Source not in read-only allowlist")
    data = json.dumps(payload,separators=(',',':')).encode() if payload is not None else None
    request = urllib.request.Request(url,data=data,headers={
        "User-Agent":"Jhadina-Week001-ReadOnlyResearch/1.0 (GitHub Actions)",
        "Accept":"application/json",
        **({"Content-Type":"application/json"} if data else {})
    },method="POST" if data else "GET")
    with urllib.request.urlopen(request,timeout=12) as response:
        if response.status != 200: raise ValueError("Non-200 provider response")
        raw = response.read(524289)
    if len(raw)>524288: raise ValueError("Provider payload exceeded 512KiB")
    return json.loads(raw), digest(raw)
def parse(lab,document):
    if lab=="capital":
        price=float(document["price"])
        if not math.isfinite(price) or price<=0: raise ValueError("Invalid market price")
        # Provider-supplied exchange timestamp required for quote provenance.
        stamp=str(document["time"])
        dt.datetime.fromisoformat(stamp.replace("Z","+00:00"))
        return {"metric":"btc_usd_price","value":price,"provider_timestamp":stamp}
    if lab=="business":
        if document.get("errorcode") != 0: raise ValueError("Grants.gov reported error")
        data=document["data"]
        value=int(data["hitCount"])
        if value<0: raise ValueError("Negative opportunity count")
        hits=data.get("oppHits",[])
        if not isinstance(hits,list): raise ValueError("Invalid opportunity hits")
        return {"metric":"posted_business_keyword_grant_count","value":value,"sample_opportunity_numbers":[str(h.get("number","")) for h in hits[:5]]}
    if lab in ("social_music","tv_music","tv_music_catalog"):
        value=int(document["resultCount"])
        hits=document["results"]
        if not isinstance(hits,list) or value<0: raise ValueError("Invalid iTunes response")
        return {"metric":"itunes_catalog_search_result_count","value":value,"sample_track_ids":[str(h.get("trackId",h.get("collectionId",""))) for h in hits[:5]]}
    raise ValueError("Unknown lab")
def collect(transport=fetch_public_json, attempts=3, sleeper=time.sleep, enrich=False):
    if not (1<=attempts<=3): raise ValueError('Retry budget must stay within 1-3 calls')
    receipts={}
    for key,(url,payload) in SOURCES.items():
        public_url=url
        receipt={"source":("Coinbase Exchange" if key=="capital" else "Grants.gov" if key=="business" else "Apple iTunes Search API"),
                 "source_url":public_url,"request_kind":"POST" if payload else "GET",
                 "observation_status":"UNAVAILABLE","observation":None,"source_response_sha256":None,"domain_evidence":None,"attempts":0,"observed_at_utc":None}
        for attempt in range(1,attempts+1):
            receipt['attempts']=attempt
            try:
                data,digest_value=transport(url,payload)
                receipt['observation']=parse(key,data)
                receipt['domain_evidence']=evidence(key,data)
                receipt['source_response_sha256']=digest_value
                receipt['observation_status']='VERIFIED_PROVIDER_RESPONSE'
                if key=='business' and enrich:
                    # Optional capped read-only detail retrieval; missing details do not fake funding.
                    receipt=enrich_grants(receipt)
                receipt['observed_at_utc']=dt.datetime.now(dt.timezone.utc).isoformat()
                break
            except (ValueError,TypeError,KeyError,IndexError,urllib.error.URLError,TimeoutError,OverflowError,OSError) as exc:
                receipt['error_type']=type(exc).__name__
                # A provider contract/parse error will not improve on repetition.
                if not isinstance(exc,(urllib.error.URLError,TimeoutError,OSError)) or attempt==attempts:
                    break
                sleeper(0.25*attempt)
        receipts[key]=receipt
    return receipts
def score(prior, current):
    """Compare next observed provider metric to sealed previous naive forecast.
    No hindsight updates to earlier observations."""
    outcomes={}
    if not isinstance(prior,dict) or prior.get("dry_run") or prior.get("preflight") or prior.get("schema_version")!=1:
        return outcomes
    for key in SOURCES:
        old=prior.get("feeds",{}).get(key,{})
        new=current.get(key,{})
        if old.get("observation_status")!="VERIFIED_PROVIDER_RESPONSE" or new.get("observation_status")!="VERIFIED_PROVIDER_RESPONSE":
            continue
        p=old["observation"]["value"]
        a=new["observation"]["value"]
        if old["observation"].get("metric")!=new["observation"].get("metric"): continue
        if key=="capital":
            outcomes[key]={"baseline":"last_observed_price","absolute_percentage_error":abs(a-p)/p*100,"prediction":p,"actual":a}
        else:
            outcomes[key]={"baseline":"last_observed_catalog_count","absolute_error":abs(a-p),"prediction":p,"actual":a}
    return outcomes
