"""Bounded official Grants.gov public detail reads; never applies for or contacts grantees.
No credentials, purchases, API-key fallbacks, or arbitrary endpoints.
"""
import hashlib
import json
import math
import urllib.error
import urllib.request

DETAIL_ENDPOINT="https://api.grants.gov/v1/api/fetchOpportunity"
MAX_DETAILS=3

def parse_detail(document,requested_id):
    if document.get("errorcode")!=0:raise ValueError("Grants.gov returned error")
    entry=document.get("data")
    if not isinstance(entry,dict) or str(entry.get("id"))!=str(requested_id):
        raise ValueError("Opportunity detail identity mismatch")
    syn=entry.get("synopsis") or {}
    def amount(value):
        try:
            n=float(str(value).replace(",","").strip())
            return n if math.isfinite(n) and n>=0 else None
        except (ValueError,TypeError,OverflowError):
            return None
    ceiling=amount(syn.get("awardCeiling"))
    floor=amount(syn.get("awardFloor"))
    if ceiling is not None and floor is not None and floor>ceiling:
        raise ValueError("Opportunity floor exceeds ceiling")
    types=[str(a.get("description"))[:100] for a in syn.get("applicantTypes",[])[:12]
           if isinstance(a,dict) and a.get("description")]
    return {"opportunity_id":str(requested_id),
            "award_ceiling_usd":ceiling,"award_floor_usd":floor,
            "applicant_type_descriptions":types,
            "source":"OFFICIAL_GRANTS_GOV_UNAUTHENTICATED_DETAIL",
            "applicant_eligibility_confirmed":False,
            "award_value_is_guaranteed":False}

def get_detail(requested_id):
    # Guaranteed hard-coded endpoint and numeric ID from the search2 result.
    if not str(requested_id).isdigit() or len(str(requested_id))>12:
        raise ValueError("Invalid opportunity ID")
    content=json.dumps({"opportunityId":int(requested_id)},separators=(",",":")).encode()
    req=urllib.request.Request(DETAIL_ENDPOINT,data=content,method="POST",headers={
        "Content-Type":"application/json","Accept":"application/json",
        "User-Agent":"Jhadina-Week001-ReadOnlyResearch/1.0"})
    with urllib.request.urlopen(req,timeout=6) as response:
        if response.status!=200:raise ValueError("Detail provider returned non-200")
        raw=response.read(262145)
    if len(raw)>262144:raise ValueError("Detail response exceeds cap")
    return parse_detail(json.loads(raw),requested_id),hashlib.sha256(raw).hexdigest()

def enrich_grants(receipt,fetcher=get_detail):
    sample=(receipt.get("domain_evidence") or {}).get("sample_opportunities",[])
    for item in sample[:MAX_DETAILS]:
        requested_id=item.get("opportunity_id")
        if not requested_id:
            item["detail_status"]="NO_OFFICIAL_OPPORTUNITY_ID"
            continue
        try:
            detail,source_hash=fetcher(requested_id)
            if detail.get("opportunity_id")!=str(requested_id):
                raise ValueError("Detail identity mismatch")
            item["official_detail"]=detail
            item["detail_response_sha256"]=source_hash
            item["detail_status"]="VERIFIED_OFFICIAL_DETAIL"
        except (ValueError,KeyError,TypeError,TimeoutError,OSError,urllib.error.URLError):
            item["detail_status"]="UNAVAILABLE"
    return receipt
