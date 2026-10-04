#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, os, shutil, subprocess, sys
from pathlib import Path

ROOT=Path(os.getenv("JHADINA_GPU_ROOT","/workspace/jhadina"))
STATE_ROOT=Path(os.getenv("SHARK_SHADOW_DATA_DIR",str(ROOT/"shark-shadow")))
PGPORT=os.getenv("SHARK_SHADOW_POSTGRES_PORT","55432")
PGUSER=os.getenv("SHARK_SHADOW_POSTGRES_USER","jhadina_shadow_pg")
PGDB=os.getenv("SHARK_SHADOW_POSTGRES_DB","jhadina_shadow")
DBURL=os.getenv("SHARK_SHADOW_DATABASE_URL",f"postgresql://{PGUSER}@127.0.0.1:{PGPORT}/{PGDB}")

def find_psql()->str:
    direct=shutil.which("psql")
    if direct:return direct
    matches=sorted(Path("/usr/lib/postgresql").glob("*/bin/psql"))
    if not matches:raise SystemExit("RUNPOD_SHADOW_PSQL_REQUIRED")
    return str(matches[-1])

PSQL=find_psql()

def query(sql:str)->str:
    result=subprocess.run([PSQL,DBURL,"-v","ON_ERROR_STOP=1","-Atqc",sql],check=True,text=True,capture_output=True)
    return result.stdout.strip()

def export(limit:int)->int:
    limit=max(1,min(500,limit))
    sql=f"""
    select coalesce(json_agg(row_to_json(x)),'[]'::json)::text
    from (
      select
        sync_id as "syncId",
        record_type as "recordType",
        record_id as "recordId",
        payload_json as payload,
        created_at as "createdAt"
      from runpod_shark_shadow_sync_queue
      where status in ('PENDING','EXPORTED')
      order by sync_id asc
      limit {limit}
    ) x
    """
    raw=query(sql) or "[]"
    records=json.loads(raw)
    print(json.dumps({
        "records":records,
        "count":len(records),
        "authority":"SHADOW_EXPORT_ONLY",
        "canExecute":False,
        "canAuthorizeLive":False,
    },separators=(",",":")))
    return 0

def ack(ids:list[int])->int:
    if not ids:
        print(json.dumps({"acknowledged":0}))
        return 0
    clean=sorted(set(i for i in ids if i>0))
    if not clean:raise SystemExit("RUNPOD_SHADOW_ACK_IDS_REQUIRED")
    literal=",".join(str(i) for i in clean)
    sql=f"""
    update runpod_shark_shadow_sync_queue
    set status='ACKNOWLEDGED',acknowledged_at=current_timestamp
    where sync_id in ({literal}) and status in ('PENDING','EXPORTED')
    returning sync_id
    """
    returned=[int(x) for x in query(sql).splitlines() if x.strip().isdigit()]
    print(json.dumps({"acknowledged":len(returned),"syncIds":returned,"authority":"LOCAL_QUEUE_ACK_ONLY","canExecute":False}))
    return 0

def main()->int:
    parser=argparse.ArgumentParser()
    sub=parser.add_subparsers(dest="command",required=True)
    exp=sub.add_parser("export")
    exp.add_argument("--limit",type=int,default=200)
    ackp=sub.add_parser("ack")
    ackp.add_argument("--ids",required=True)
    args=parser.parse_args()
    if args.command=="export":return export(args.limit)
    ids=[int(x) for x in args.ids.split(",") if x.strip().isdigit()]
    return ack(ids)

if __name__=="__main__":
    raise SystemExit(main())
