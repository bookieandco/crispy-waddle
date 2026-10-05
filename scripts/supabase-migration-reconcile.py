#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Any

VERSION_RE=re.compile(r"^(\d+)_.*\.sql$")

def local_versions(root:Path)->dict[str,list[str]]:
    out:dict[str,list[str]]={}
    for path in sorted((root/"supabase"/"migrations").glob("*.sql")):
        m=VERSION_RE.match(path.name)
        if not m:
            continue
        out.setdefault(m.group(1),[]).append(path.name)
    return out

def collect_remote_versions(value:Any)->set[str]:
    versions:set[str]=set()
    if isinstance(value,dict):
        version=value.get("version")
        if isinstance(version,(str,int)):
            versions.add(str(version))
        for child in value.values():
            versions.update(collect_remote_versions(child))
    elif isinstance(value,list):
        for child in value:
            versions.update(collect_remote_versions(child))
    return versions

def main()->int:
    parser=argparse.ArgumentParser(
        description="Compare repo Supabase migration versions with list_migrations JSON."
    )
    parser.add_argument("--remote-json",required=True,type=Path)
    parser.add_argument("--repo-root",default=Path(__file__).resolve().parents[1],type=Path)
    args=parser.parse_args()

    payload=json.loads(args.remote_json.read_text())
    remote=collect_remote_versions(payload)
    local=local_versions(args.repo_root)

    duplicates={v:names for v,names in local.items() if len(names)>1}
    local_set=set(local)
    missing_remote=sorted(local_set-remote)
    remote_without_local=sorted(remote-local_set)

    report={
        "localMigrationCount":sum(len(v) for v in local.values()),
        "localVersionCount":len(local_set),
        "remoteVersionCount":len(remote),
        "duplicateLocalVersions":duplicates,
        "localVersionsMissingRemote":missing_remote,
        "remoteVersionsMissingLocal":remote_without_local,
        "clean":not duplicates and not remote_without_local,
        "note":"Local versions missing remote are unapplied candidates, not permission to blind-push them.",
    }
    print(json.dumps(report,indent=2,sort_keys=True))
    return 0 if report["clean"] else 2

if __name__=="__main__":
    raise SystemExit(main())
