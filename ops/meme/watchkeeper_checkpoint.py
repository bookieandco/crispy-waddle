"""WATCHKEEPER.09 local crash-safe, duplicate-resistant SHARK observation checkpoints.

Offline POSIX file journal with SHA256 content-addressed full state snapshots.
NOT an independently timestamped external witness, remote backup, worker,
cloud restore, encrypted archive or 24/7 availability claim.
No network, wallet, trading, external billable APIs or database writes.
"""
from __future__ import annotations
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import re

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("w09_experiment",HERE/"experiment_7day.py")
obs=importlib.util.module_from_spec(spec);spec.loader.exec_module(obs)
SCHEMA="SHARK-CHECKPOINT-09"
ROOT="0"*64
RUN_ID=re.compile(r"^[A-Za-z0-9:_-]{8,128}$")
MAX_STATE_BYTES=8_000_000
MAX_JOURNAL_BYTES=4_000_000
MAX_LOCAL_GAP=7200

def canonical(obj):
    return json.dumps(obj,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()
def path_guard(folder:pathlib.Path):
    if folder.is_symlink():
        raise ValueError("checkpoint_archive_symlink")
    if folder.exists() and not folder.is_dir():
        raise ValueError("checkpoint_archive_not_directory")
def safe_file(folder:pathlib.Path,name:str):
    if not re.fullmatch(r"[a-z0-9_.-]{1,130}",name):
        raise ValueError("checkpoint_name_invalid")
    path=folder/name
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise ValueError("checkpoint_symlink_or_bad_file")
    return path
def parse_state(raw:bytes,recorded_at:str):
    if not isinstance(raw,bytes) or not 0<len(raw)<=MAX_STATE_BYTES:
        raise ValueError("checkpoint_state_size_invalid")
    state=json.loads(raw)
    obs.audit(state)
    now=obs.timestamp(recorded_at)
    if now<obs.timestamp(obs.START):
        raise ValueError("checkpoint_preexperiment")
    last=obs.timestamp(state["events"][-1]["availableAt"]) if state["events"] else obs.timestamp(obs.START)
    if last>now:
        raise ValueError("checkpoint_future_data")
    # Calendar age distinguishes late/failed schedulers from valid fresh scans;
    # after official END no stale warning is applicable to the completed ledger.
    gap=(now-last).total_seconds()
    stale=gap>MAX_LOCAL_GAP and state.get("status")!="COMPLETED"
    return state,int(gap),stale
def construct(raw:bytes,run_id:str,recorded_at:str)->dict:
    if not isinstance(run_id,str) or not RUN_ID.fullmatch(run_id):
        raise ValueError("checkpoint_run_id_invalid")
    state,gap,stale=parse_state(raw,recorded_at)
    return {
        "schema":SCHEMA,"experimentId":obs.ID,"runId":run_id,
        "recordedAt":recorded_at,"sourceHead":state["lastDigest"],
        "stateBytesSha256":hashlib.sha256(raw).hexdigest(),
        "stateBytes":len(raw),"stateStatus":state["status"],
        "events":len(state["events"]),"secondsSinceLastEvent":gap,
        "schedulerFreshEnough":not stale,
        "schedulerCoverageCertified":False,
        "externalAnchorVerified":False,"independentArchiveVerified":False,
        "fullPostgresRestoreVerified":False,
        "authority":"RESEARCH_ONLY","canExecute":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False,
    }
def audit(folder:pathlib.Path,events:list[dict],check_snapshots:bool=True)->str:
    if not isinstance(events,list) or len(events)>10000:
        raise ValueError("checkpoint_journal_invalid")
    last=ROOT;seen_runs={};seen_heads={}
    last_time=None
    for idx,event in enumerate(events,1):
        if not isinstance(event,dict) or set(event)!={"seq","prevHash","receipt","hash"}:
            raise ValueError("checkpoint_event_shape_invalid")
        if type(event["seq"]) is not int or event["seq"]!=idx or event["prevHash"]!=last:
            raise ValueError("checkpoint_chain_disconnected")
        expected=digest({k:event[k] for k in ("seq","prevHash","receipt")})
        if event["hash"]!=expected:raise ValueError("checkpoint_hash_tampered")
        receipt=event["receipt"]
        if not isinstance(receipt,dict) or receipt.get("schema")!=SCHEMA or receipt.get("experimentId")!=obs.ID:
            raise ValueError("checkpoint_receipt_invalid")
        if any(receipt.get(k) is not False for k in ("canExecute","canSign","canBroadcast","canAuthorizeLive",
            "externalAnchorVerified","independentArchiveVerified","fullPostgresRestoreVerified","schedulerCoverageCertified")):
            raise ValueError("checkpoint_false_certification")
        rid=receipt.get("runId");head=receipt.get("sourceHead")
        if not isinstance(rid,str) or not RUN_ID.fullmatch(rid) or not isinstance(head,str) or len(head)!=64:
            raise ValueError("checkpoint_receipt_identity_invalid")
        if rid in seen_runs or head in seen_heads:
            raise ValueError("checkpoint_duplicate")
        seen_runs[rid]=idx;seen_heads[head]=idx
        at=obs.timestamp(receipt["recordedAt"])
        if last_time is not None and at<last_time:raise ValueError("checkpoint_time_regression")
        last_time=at
        h=receipt["stateBytesSha256"]
        if not isinstance(h,str) or not re.fullmatch(r"[0-9a-f]{64}",h):
            raise ValueError("checkpoint_blob_hash_invalid")
        if check_snapshots:
            blob=safe_file(folder,"state-"+h+".json")
            if not blob.exists() or blob.stat().st_size!=receipt["stateBytes"]:
                raise ValueError("checkpoint_archive_missing")
            payload=blob.read_bytes()
            if hashlib.sha256(payload).hexdigest()!=h:
                raise ValueError("checkpoint_restore_bytes_mismatch")
            state,gap,stale=parse_state(payload,receipt["recordedAt"])
            if state["lastDigest"]!=head or len(state["events"])!=receipt["events"] or state["status"]!=receipt["stateStatus"] or gap!=receipt["secondsSinceLastEvent"] or (not stale)!=receipt["schedulerFreshEnough"]:
                raise ValueError("checkpoint_source_reconstruction_mismatch")
        last=event["hash"]
    return last
def load(folder:pathlib.Path,check_snapshots=True):
    path_guard(folder)
    path=safe_file(folder,"journal.jsonl")
    if not path.exists():return []
    if path.stat().st_size>MAX_JOURNAL_BYTES:raise ValueError("checkpoint_journal_too_large")
    events=[json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    audit(folder,events,check_snapshots)
    return events
def _create_blob(path:pathlib.Path,raw:bytes):
    if path.exists():
        if path.read_bytes()!=raw:raise ValueError("checkpoint_blob_collision")
        return
    flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL
    if hasattr(os,"O_NOFOLLOW"):flags|=os.O_NOFOLLOW
    try:fd=os.open(path,flags,0o600)
    except FileExistsError:
        if path.read_bytes()!=raw:raise ValueError("checkpoint_blob_collision")
        return
    with os.fdopen(fd,"wb") as out:
        out.write(raw);out.flush();os.fsync(out.fileno())
def commit(folder:pathlib.Path,raw:bytes,run_id:str,at:str):
    path_guard(folder)
    folder.mkdir(parents=True,exist_ok=True)
    receipt=construct(raw,run_id,at)
    lock_path=safe_file(folder,"append.lock")
    flags=os.O_RDWR|os.O_CREAT
    if hasattr(os,"O_NOFOLLOW"):flags|=os.O_NOFOLLOW
    fd=os.open(lock_path,flags,0o600)
    with os.fdopen(fd,"r+") as lock:
        fcntl.flock(lock.fileno(),fcntl.LOCK_EX)
        entries=load(folder)
        runs={e["receipt"]["runId"]:e for e in entries}
        heads={e["receipt"]["sourceHead"]:e for e in entries}
        if run_id in runs:
            existing=runs[run_id]
            if existing["receipt"]!=receipt:
                raise ValueError("checkpoint_run_reuse_conflict")
            return {"status":"IDEMPOTENT_REPLAY","event":existing,"externalArchiveVerified":False}
        if receipt["sourceHead"] in heads:
            raise ValueError("checkpoint_repeated_source_head_new_run")
        if entries and obs.timestamp(at)<obs.timestamp(entries[-1]["receipt"]["recordedAt"]):
            raise ValueError("checkpoint_time_regression")
        blob=safe_file(folder,"state-"+receipt["stateBytesSha256"]+".json")
        _create_blob(blob,raw)
        base={"seq":len(entries)+1,"prevHash":audit(folder,entries),"receipt":receipt}
        event={**base,"hash":digest(base)}
        journal=safe_file(folder,"journal.jsonl")
        flags=os.O_WRONLY|os.O_APPEND|os.O_CREAT
        if hasattr(os,"O_NOFOLLOW"):flags|=os.O_NOFOLLOW
        f=os.open(journal,flags,0o600)
        with os.fdopen(f,"a",encoding="utf-8") as out:
            out.write(canonical(event).decode()+"\n")
            out.flush();os.fsync(out.fileno())
        if audit(folder,[*entries,event])!=event["hash"]:
            raise ValueError("checkpoint_readback_failure")
        return {"status":"LOCAL_CHECKPOINT_COMMITTED","event":event,
            "externalArchiveVerified":False}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--archive-dir",required=True)
    subs=p.add_subparsers(dest="cmd",required=True)
    save=subs.add_parser("append")
    save.add_argument("--state",required=True)
    save.add_argument("--run-id",required=True)
    save.add_argument("--at",required=True)
    subs.add_parser("verify")
    a=p.parse_args()
    folder=pathlib.Path(a.archive_dir)
    if a.cmd=="append":
        result=commit(folder,pathlib.Path(a.state).read_bytes(),a.run_id,a.at)
        print(json.dumps({"status":result["status"],"eventHash":result["event"]["hash"],
            "externalArchiveVerified":False}))
    else:
        e=load(folder)
        print(json.dumps({"status":"LOCAL_ARCHIVE_AUDITED","checkpoints":len(e),
            "headHash":audit(folder,e),"externalArchiveVerified":False}))

if __name__=="__main__":
    main()
