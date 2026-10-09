#!/usr/bin/env python3
"""Purse .05-.06: public GitHub release proof + owner-host evidence admission.

READ ONLY. Never merges, changes Vercel, starts paid compute, reads bank credentials,
replays orders, or promotes database access. All receipts are structural claims
until reviewed independently on the authenticated physical host.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

SCHEMA="jhadina.purse.live-05-06-preflight.v1"
PRS=(1162,1166,1186,1188,1190,1191)
SHA=re.compile(r"^[0-9a-f]{40}$")
HEX=re.compile(r"^[0-9a-f]{64}$")
SNAP=re.compile(r"^[0-9a-f]{8,64}$")
REPO="bookieandco/crispy-waddle"
GITHUB="https://api.github.com/repos/"+REPO
# Per-PR checks reflect the actual workflow path filters; #1188 touches SQL/Money only.
REQUIRED_CI_BY_PR={
    1162:("Money R13B Certification","Jhadina Launch Gate","Jhadina Web Deploy Conformance"),
    1166:("Money R13B Certification","Jhadina Launch Gate","Jhadina Web Deploy Conformance"),
    1186:("Money R13B Certification","Jhadina Launch Gate","Jhadina Web Deploy Conformance","Jhadina Portable Postgres CI"),
    1188:("Money R13B Certification","Jhadina Launch Gate","Jhadina Portable Postgres CI"),
    1190:("Money R13B Certification","Jhadina Launch Gate","Jhadina Web Deploy Conformance"),
    1191:("Money R13B Certification","Jhadina Launch Gate","Jhadina Web Deploy Conformance"),
}

def read_json(path:Path)->dict:
    if path.is_symlink() or not path.is_file() or path.stat().st_size>65536:
        raise ValueError("RECEIPT_NOT_REGULAR_OR_SIZE_INVALID")
    with path.open("rb") as source:
        obj=json.load(source)
    if not isinstance(obj,dict):
        raise ValueError("RECEIPT_OBJECT_REQUIRED")
    return obj

def github_get(url:str)->dict|list:
    if not url.startswith(GITHUB+"/"):
        raise ValueError("GITHUB_URL_NOT_ALLOWED")
    headers={"accept":"application/vnd.github+json","user-agent":"purse-live-readonly-preflight/1"}
    token=os.environ.get("GITHUB_TOKEN","")
    if token:
        headers["authorization"]="Bearer "+token
    req=Request(url,headers=headers,method="GET")
    with urlopen(req,timeout=15) as response:
        if response.status!=200:
            raise ValueError("GITHUB_HTTP_NOT_200")
        raw=response.read(512001)
        if len(raw)>512000:
            raise ValueError("GITHUB_RESPONSE_TOO_LARGE")
    return json.loads(raw)

def collect_github()->dict:
    main=github_get(GITHUB+"/commits/main")
    data={"mainSha":main.get("sha"),"prs":{}}
    for n in PRS:
        pr=github_get(GITHUB+"/pulls/"+str(n))
        reviews=github_get(GITHUB+"/pulls/"+str(n)+"/reviews?per_page=100")
        runs=github_get(GITHUB+"/actions/runs?head_sha="+str(pr.get("head",{}).get("sha",""))+"&per_page=100")
        owner=pr.get("user",{}).get("login")
        approvals=[r for r in reviews if r.get("state")=="APPROVED"
                   and r.get("user",{}).get("login")!=owner
                   and r.get("commit_id")==pr.get("head",{}).get("sha")]
        # Only the exact head and successfully concluded workflow run counts.
        successful={w.get("name") for w in runs.get("workflow_runs",[])
                    if w.get("head_sha")==pr.get("head",{}).get("sha")
                    and w.get("status")=="completed" and w.get("conclusion")=="success"}
        data["prs"][str(n)]={
            "merged":pr.get("merged") is True,
            "draft":pr.get("draft") is True,
            "base":pr.get("base",{}).get("ref"),
            "headSha":pr.get("head",{}).get("sha"),
            "approvedAtExactHead":bool(approvals),
            "successfulWorkflowNames":sorted(successful)}
    return data

def evaluate(github:dict,receipts:dict,expected_head:str)->dict:
    if not SHA.fullmatch(expected_head):
        raise ValueError("EXPECTED_SHA_INVALID")
    blockers=[]
    if github.get("mainSha")!=expected_head:
        blockers.append("MAIN_SHA_MISMATCH_OR_NOT_DEPLOYED")
    prs=github.get("prs",{})
    for n in PRS:
        pr=prs.get(str(n),{})
        if pr.get("merged") is not True or pr.get("draft") is not False or pr.get("base")!="main":
            blockers.append("PR_"+str(n)+"_NOT_SAFELY_MERGED_TO_MAIN")
        if not SHA.fullmatch(str(pr.get("headSha",""))):
            blockers.append("PR_"+str(n)+"_HEAD_NOT_VERIFIED")
        if pr.get("approvedAtExactHead") is not True:
            blockers.append("PR_"+str(n)+"_INDEPENDENT_REVIEW_MISSING")
        successful=pr.get("successfulWorkflowNames",[])
        if any(name not in successful for name in REQUIRED_CI_BY_PR[n]):
            blockers.append("PR_"+str(n)+"_EXACT_HEAD_CI_MISSING")
    host=receipts.get("host",{})
    if host.get("status")!="INDEPENDENT_HOST_REVIEW_REQUIRED" or host.get("expectedHead")!=expected_head or host.get("finalCertification")!="NOT_ISSUED" or host.get("canExecute") is not False:
        blockers.append("REAL_POST_REBOOT_DURABLE_HOST_UNPROVEN")
    db=receipts.get("database",{})
    if (db.get("status")!="READABLE_BUT_UNCERTIFIED" or db.get("liveTradingEnabled") is not False
        or db.get("storageCertified") is not False or not db.get("databaseName")
        or not isinstance(db.get("tablePresent"),dict)
        or not db.get("tablePresent") or any(v is not True for v in db["tablePresent"].values())
        or db.get("blockers")):
        blockers.append("REAL_PG_SCHEMA_AND_RECOVERY_UNVERIFIED")
    backup=receipts.get("backup",{})
    restore=receipts.get("restore",{})
    remote=(backup.get("schema")=="jhadina.google-homebase.db-backup.v1"
        and backup.get("scope")=="POSTGRES_ONLY"
        and backup.get("source_kind")=="LOCAL_HOMEBASE_COMPOSE"
        and backup.get("hosted_supabase_data_covered") is False
        and backup.get("restic_encrypted") is True
        and backup.get("remote_byte_restore_verified") is True
        and SNAP.fullmatch(str(backup.get("snapshot_id","")))
        and HEX.fullmatch(str(backup.get("sha256",""))))
    isolated=(remote and restore.get("schema")=="jhadina.google-homebase.db-restore-drill.v1"
        and restore.get("source_snapshot_id")==backup.get("snapshot_id")
        and restore.get("source_sha256")==backup.get("sha256")
        and restore.get("source_kind")=="LOCAL_HOMEBASE_COMPOSE"
        and restore.get("hosted_supabase_data_covered") is False
        and restore.get("isolated_network") is True
        and restore.get("production_database_modified") is False
        and restore.get("postgres_database_restore_tested") is True
        and type(restore.get("restored_application_table_count")) is int
        and restore["restored_application_table_count"]>0)
    if not isolated:
        blockers.append("ACTUAL_ENCRYPTED_BACKUP_AND_ISOLATED_RESTORE_UNVERIFIED")
    web=receipts.get("web",{})
    if (web.get("schema")!="money.portable.prod-preflight.v1"
        or web.get("status")!="PORTABLE_WEB_PROBE_REVIEW_REQUIRED"
        or web.get("expectedHeadSha")!=expected_head
        or web.get("canExecute") is not False
        or web.get("canAuthorizeLive") is not False):
        blockers.append("EXACT_SHA_DURABLE_MEMORY_AND_WEB_NOT_VERIFIED")
    return {
        "schema":SCHEMA,
        "status":"BLOCKED" if blockers else "INDEPENDENT_OPERATIONS_REVIEW_REQUIRED",
        "reasonCodes":sorted(set(blockers)),
        "expectedMainHead":expected_head,
        "releasePrs":list(PRS),
        "supabaseState":"DEFERRED_AUDIT_REPAIR",
        "originalShadowRecovered":False,
        "economicLedgerParityCertified":False,
        "persistentMemoryCertified":False,
        "productionDeploymentCertified":False,
        "financialAuthority":"NONE",
        "canExecute":False,
        "canMoveMoney":False,
        "canAuthorizeLive":False,
        "liveAutonomousTradingCertified":False,
    }

def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--expected-main",required=True)
    parser.add_argument("--receipt-dir",type=Path,default=None)
    args=parser.parse_args()
    try:
        gh=collect_github()
        receipts={}
        if args.receipt_dir is not None:
            if args.receipt_dir.is_symlink() or not args.receipt_dir.is_dir():
                raise ValueError("RECEIPT_DIR_NOT_REAL")
            for key in ("host","database","backup","restore","web"):
                p=args.receipt_dir/(key+".json")
                if p.exists() or p.is_symlink():
                    receipts[key]=read_json(p)
        output=evaluate(gh,receipts,args.expected_main)
    except Exception as err:
        output={"schema":SCHEMA,"status":"BLOCKED","reasonCodes":[
            "RELEASE_PROBE_UNAVAILABLE",type(err).__name__],
            "supabaseState":"DEFERRED_AUDIT_REPAIR","canExecute":False,
            "canMoveMoney":False,"canAuthorizeLive":False,
            "liveAutonomousTradingCertified":False}
    print(json.dumps(output,sort_keys=True,indent=2))
    return 0 if output["status"]=="INDEPENDENT_OPERATIONS_REVIEW_REQUIRED" else 2

if __name__=="__main__":
    raise SystemExit(main())
