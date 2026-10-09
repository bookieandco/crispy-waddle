#!/usr/bin/env python3
"""Read-only production health probe. No Supabase keys, order endpoints or claims of FINAL."""
from __future__ import annotations
import argparse
import json
import sys
from urllib.parse import urlsplit
from urllib.request import urlopen, Request


def strict_https_origin(value: str) -> str:
    parts=urlsplit(value)
    if (parts.scheme!="https" or not parts.hostname or parts.username or parts.password
        or parts.path not in ("","/") or parts.query or parts.fragment):
        raise ValueError("PROBE_HTTPS_ORIGIN_REQUIRED")
    return value.rstrip("/")


def inspect_probes(web: dict, gateway: dict, expected: str) -> dict:
    errors=[]
    if not isinstance(expected,str) or len(expected)!=40 or any(c not in "0123456789abcdef" for c in expected.lower()):
        raise ValueError("PROBE_EXPECTED_SHA_INVALID")
    if (web.get("success") is not True or web.get("status") not in ("ok","healthy")
       or web.get("durableMemory")!="ready" or web.get("environment")!="production"
       or web.get("commitSha")!=expected):
        errors.append("VERCEL_DURABLE_EXACT_SHA_NOT_PROVEN")
    if (gateway.get("ok") is not True or gateway.get("service")!="jhadina-portable-memory-gateway"
       or gateway.get("authority")!="MEMORY_STORAGE_TRANSPORT_ONLY"
       or gateway.get("canExecute") is not False):
        errors.append("INDEPENDENT_PORTABLE_GATEWAY_HEALTH_NOT_PROVEN")
    return {"schema":"money.portable.prod-preflight.v1",
        "status":"PORTABLE_WEB_PROBE_REVIEW_REQUIRED" if not errors else "BLOCKED",
        "reasonCodes":errors,"expectedHeadSha":expected,
        "swlcStatus":"DEFERRED_AUDIT_REPAIR","originalShadowRecovered":False,
        "paperRuntimeCertified":False,"finalCertification":"NOT_ISSUED",
        "canExecute":False,"canAuthorizeLive":False}


def get_json(origin:str,path:str)->dict:
    req=Request(strict_https_origin(origin)+path,
        headers={"accept":"application/json","user-agent":"money-portable-production-preflight/1"})
    with urlopen(req, timeout=15) as response:
        if response.status!=200:raise ValueError("PROBE_HEALTH_HTTP_NOT_200")
        raw=response.read(8193)
        if len(raw)>8192:raise ValueError("PROBE_RESPONSE_TOO_LARGE")
        body=json.loads(raw)
        if not isinstance(body,dict):raise ValueError("PROBE_HEALTH_BODY_INVALID")
        return body


def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--web-origin",required=True)
    parser.add_argument("--gateway-origin",required=True)
    parser.add_argument("--expected-head",required=True)
    args=parser.parse_args()
    try:
        web=get_json(args.web_origin,"/api/health")
        gateway=get_json(args.gateway_origin,"/healthz")
        report=inspect_probes(web,gateway,args.expected_head)
    except Exception as err:
        report={"schema":"money.portable.prod-preflight.v1","status":"BLOCKED",
            "reasonCodes":["PORTABLE_ENDPOINT_NOT_VERIFIED",type(err).__name__],
            "swlcStatus":"DEFERRED_AUDIT_REPAIR","finalCertification":"NOT_ISSUED",
            "canExecute":False,"canAuthorizeLive":False}
    print(json.dumps(report,indent=2,sort_keys=True))
    return 0 if report["status"]=="PORTABLE_WEB_PROBE_REVIEW_REQUIRED" else 2


if __name__=="__main__":
    sys.exit(main())
