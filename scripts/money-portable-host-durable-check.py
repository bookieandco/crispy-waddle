#!/usr/bin/env python3
"""Two-phase local durable-host probe. Fail closed; never asserts unattended commissioning.

Initialize on an operator-authorized *existing* mount; verify after an actual
host reboot. Does not start compute, contact market vendors, or modify Supabase.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA="jhadina.money.portable.host-readback.v1"
CANARY=".money-portable-host-canary.json"

def boot_id() -> str:
    return Path("/proc/sys/kernel/random/boot_id").read_text().strip()

def sha(data:bytes)->str:
    return hashlib.sha256(data).hexdigest()

def check_mount(root:Path,minimum_available_bytes:int)->Path:
    if not root.is_absolute() or root.is_symlink() or not root.is_dir():
        raise ValueError("MONEY_HOST_ABSOLUTE_EXISTING_DIR_REQUIRED")
    path=root.resolve(strict=True)
    if str(path) in ("/","/tmp","/var/tmp") or (
        str(path).startswith(("/tmp/","/var/tmp/","/home/runner/"))
    ):
        raise ValueError("MONEY_HOST_EPHEMERAL_OR_SYSTEM_PATH_DENIED")
    if not os.path.ismount(path):
        raise ValueError("MONEY_HOST_DEDICATED_MOUNT_REQUIRED")
    mode=path.stat().st_mode
    if mode & (stat.S_IWGRP|stat.S_IWOTH):
        raise ValueError("MONEY_HOST_MOUNT_WORLD_OR_GROUP_WRITABLE")
    if minimum_available_bytes<=0:
        raise ValueError("MONEY_HOST_FREE_SPACE_POLICY_REQUIRED")
    fs=os.statvfs(path)
    if fs.f_bavail*fs.f_frsize<minimum_available_bytes:
        raise ValueError("MONEY_HOST_SPACE_BELOW_POLICY")
    if not boot_id():
        raise ValueError("MONEY_HOST_BOOT_ID_MISSING")
    return path

def make_challenge(root:Path,expected_head:str,min_bytes:int)->dict:
    if len(expected_head)!=40 or not all(c in "0123456789abcdef" for c in expected_head.lower()):
        raise ValueError("MONEY_HOST_SHA_INVALID")
    path=check_mount(root,min_bytes)
    challenge={"schema":SCHEMA,"phase":"INITIAL",
        "randomToken":os.urandom(32).hex(),
        "originalBootId":boot_id(),"expectedHead":expected_head,
        "createdAt":datetime.now(timezone.utc).isoformat(),
        "authority":"READ_ONLY_HOST_EVIDENCE","canExecute":False}
    data=json.dumps(challenge,sort_keys=True,separators=(",",":")).encode()
    # O_EXCL prevents silently overwriting an existing original host challenge.
    fd=os.open(str(path/CANARY),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    try:
        with os.fdopen(fd,"wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        try:os.unlink(path/CANARY)
        except OSError:pass
        raise
    folder_fd=os.open(str(path),os.O_RDONLY)
    try:os.fsync(folder_fd)
    finally:os.close(folder_fd)
    return {"schema":SCHEMA,"status":"REBOOT_PROOF_PENDING",
        "sourceBootId":challenge["originalBootId"],"canarySha256":sha(data),
        "canExecute":False,"finalCertification":"NOT_ISSUED"}

def check_after_restart(root:Path,expected_head:str,min_bytes:int)->dict:
    path=check_mount(root,min_bytes)
    file=path/CANARY
    if file.is_symlink():raise ValueError("MONEY_HOST_CANARY_SYMLINK_DENIED")
    raw=file.read_bytes()
    if len(raw)>4096 or not raw:raise ValueError("MONEY_HOST_CANARY_SIZE_INVALID")
    data=json.loads(raw)
    if not isinstance(data,dict) or data.get("schema")!=SCHEMA or (
        data.get("phase")!="INITIAL" or data.get("expectedHead")!=expected_head or
        not isinstance(data.get("randomToken"),str) or len(data["randomToken"])!=64
    ):
        raise ValueError("MONEY_HOST_CANARY_INVALID")
    if data["originalBootId"]==boot_id():
        raise ValueError("MONEY_HOST_RESTART_NOT_PROVEN")
    return {"schema":SCHEMA,"status":"INDEPENDENT_HOST_REVIEW_REQUIRED",
        "sourceBootId":data["originalBootId"],"currentBootId":boot_id(),
        "canarySha256":sha(raw),"expectedHead":expected_head,
        "canExecute":False,"finalCertification":"NOT_ISSUED"}

def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("phase",choices=["initialize","verify-after-reboot"])
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--head",required=True)
    parser.add_argument("--minimum-free-gb",type=int,default=10)
    args=parser.parse_args()
    try:
        if not 1<=args.minimum_free_gb<=10000:raise ValueError("MONEY_HOST_FREE_SPACE_POLICY_INVALID")
        f=make_challenge if args.phase=="initialize" else check_after_restart
        print(json.dumps(f(args.root,args.head,args.minimum_free_gb*1024**3),
                         sort_keys=True))
        return 0
    except Exception as e:
        print(json.dumps({"schema":SCHEMA,"status":"BLOCKED",
            "reason":type(e).__name__+":"+str(e)[:128],
            "canExecute":False,"finalCertification":"NOT_ISSUED"}))
        return 2
if __name__=="__main__":
    sys.exit(main())
