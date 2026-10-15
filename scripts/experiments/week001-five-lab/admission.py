#!/usr/bin/env python3
"""Fail-closed canonical admission for scheduled Jhadina prior-day artifacts.

Never use local filesystem ordering or latest-run heuristics as authority.
"""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import shutil
import sys
from continuity import FIRST_DATE,verify_genesis,prior_research_date_valid
from learning import sha

MAX_RECORD_BYTES=2_000_000
SOURCES={"capital","social_music","business","tv_music","tv_music_catalog"}
LABS={"capital","social_music","business","tv_music","game_qa"}

def read_valid(path, day):
    path=pathlib.Path(path)
    if not path.is_file() or path.stat().st_size>MAX_RECORD_BYTES:return None
    try:
        record=json.loads(path.read_text())
        if not isinstance(record,dict):return None
        signature=record.get("record_sha256")
        if not isinstance(signature,str) or len(signature)!=64:return None
        if sha({k:v for k,v in record.items() if k!="record_sha256"})!=signature:return None
        if record.get("schema_version")!=1 or not prior_research_date_valid(record,day):return None
        if day==FIRST_DATE and not verify_genesis(record):return None
        if set(x.get("lab") for x in record.get("results",[]) if isinstance(x,dict))!=LABS:return None
        if any(x.get("status")!="PASS" for x in record["results"]):return None
        if set(record.get("feeds",{}))!=SOURCES:return None
        if any(record["feeds"][key].get("observation_status")!="VERIFIED_PROVIDER_RESPONSE" for key in SOURCES):return None
        predictions=record.get("predictions",[])
        if not isinstance(predictions,list) or len(predictions)!=6:return None
        if len({x.get("prediction_id") for x in predictions})!=6:return None
        for pred in predictions:
            signature=pred.get("prediction_sha256")
            if sha({k:v for k,v in pred.items() if k!="prediction_sha256"})!=signature:return None
            if pred.get("execute_authority") is not False or pred.get("publication_authority") is not False:return None
            if pred.get("target_date_utc")!=(day+dt.timedelta(days=1)).isoformat():return None
        if day!=FIRST_DATE:
            if record.get("prior_state")!="VERIFIED_PRIOR_DAY":return None
            if not isinstance(record.get("prior_record_sha256"),str) or len(record["prior_record_sha256"])!=64:return None
            if record.get("health",{}).get("status")!="HEALTHY":return None
        return record
    except (ValueError,KeyError,TypeError,OSError,OverflowError):
        return None

def select(root,day):
    """Return unique valid artifact; reject even identical duplicates from distinct runs."""
    root=pathlib.Path(root)
    candidates=[]
    for path in root.rglob("evidence.json"):
        valid=read_valid(path,day)
        if valid is not None:candidates.append((path,valid))
    if len(candidates)!=1:
        raise ValueError("EXPECTED_EXACTLY_ONE_VALID_SCHEDULED_ARTIFACT;found="+str(len(candidates)))
    return candidates[0]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",required=True)
    parser.add_argument("--date",required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    try:
        day=dt.date.fromisoformat(args.date)
        path,record=select(args.root,day)
        output=pathlib.Path(args.output)
        output.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(path,output)
        print(json.dumps({"date":str(day),"admitted_record_sha256":record["record_sha256"],"source_path":str(path)}))
        return 0
    except (ValueError,OSError) as exc:
        print("REJECTED_PRIOR_DAY:"+str(exc),file=sys.stderr)
        return 1

if __name__=="__main__":sys.exit(main())
