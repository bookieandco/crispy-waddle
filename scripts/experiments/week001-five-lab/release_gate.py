#!/usr/bin/env python3
"""Independent LAB-FINISH.13-.18 certification from archived seven-day evidence.

Research evidence may complete while production rights, physical testing,
and account analytics remain unverified. Never promote one to the other.
"""
import argparse
import json
import pathlib
import sys
from archive import validate_archive
from finalize import evaluate
from finish_core import inspect,render_html
from continuity import FIRST_DATE

DATES=[f"2026-10-{i:02d}" for i in range(14,22)]
CODES=[
 ("LAB-FINISH.01","2026-10-15 real forward grades verified"),
 ("LAB-FINISH.02","unique hash-verified daily artifact admission"),
 ("LAB-FINISH.03","automatic restored Google Drive backups"),
 ("LAB-FINISH.04","canonical sealed prediction and paper ledger"),
 ("LAB-FINISH.05","missed day and source failures surfaced"),
 ("LAB-FINISH.06","paper positions, costs and drawdown reconciled"),
 ("LAB-FINISH.07","paper strategy checked against safe baseline"),
 ("LAB-FINISH.08","owned-account campaign results measured"),
 ("LAB-FINISH.09","opportunity relevance with eligibility review"),
 ("LAB-FINISH.10","licensed playable-source review completed"),
 ("LAB-FINISH.11","browser controller and audio regression"),
 ("LAB-FINISH.12","forward-only shadow learning review"),
 ("LAB-FINISH.13","common reporting schema and evidence labels"),
 ("LAB-FINISH.14","corruption/outage safety tests"),
 ("LAB-FINISH.15","physical iPhone Safari device certification"),
 ("LAB-FINISH.16","phone readable dashboard generated"),
 ("LAB-FINISH.17","seven days and settlement independently scored"),
 ("LAB-FINISH.18","no-charge, security, restore and production acceptance"),
]
CODE_ONLY={"LAB-FINISH.02","LAB-FINISH.04","LAB-FINISH.05","LAB-FINISH.06","LAB-FINISH.07",
           "LAB-FINISH.09","LAB-FINISH.11","LAB-FINISH.12","LAB-FINISH.13","LAB-FINISH.14",
           "LAB-FINISH.16"}

def run(root):
    root=pathlib.Path(root)
    study=evaluate(root,anchor_first_day=True)
    artifacts={}
    for path in root.rglob("evidence.json"):
        try:
            item=json.loads(path.read_text())
            day=item.get("date")
            if day in DATES and not item.get("preflight") and not item.get("dry_run"):
                artifacts.setdefault(day,[]).append((path,item))
        except (OSError,ValueError,TypeError):continue
    backups={}
    for day,items in artifacts.items():
        checks=[]
        for path,item in items:
            zip_files=list(path.parent.glob("jhadina-five-lab-*.zip"))
            receipt=path.parent/"archive-receipt.json"
            for z in zip_files:
                try:
                    meta=validate_archive(z)
                    if meta.get("record_sha256")==item.get("record_sha256"):
                        checks.append(True)
                except (ValueError,OSError,KeyError):
                    checks.append(False)
            drive_status="UNCONFIGURED_OR_UNVERIFIED"
            if receipt.is_file():
                try:
                    r=json.loads(receipt.read_text())
                    drive_status=r.get("drive_status","NOT_REQUESTED")
                except (ValueError,OSError):pass
            backups[day]={"archive_restore_verified":any(checks),"drive_status":drive_status}
    first=artifacts.get("2026-10-15",[])
    real_grades=bool(len(first)==1 and len(first[0][1].get("outcomes",[]))==6
                     and first[0][1].get("prior_state")=="VERIFIED_PRIOR_DAY")
    healthy=all(len(artifacts.get(day,[]))==1 and artifacts[day][0][1].get("health",{}).get("status")=="HEALTHY" for day in DATES)
    report={
       "schema_version":2,
       "final_evidence_status":study.get("status"),
       "dates_verified":study.get("dates_verified"),
       "forward_outcomes":study.get("verified_forward_outcomes"),
       "daily_backup_evidence":backups,
       "automatic_publication_or_orders":False,
       "licensed_playback_certified":False,
       "owned_social_analytics_certified":False,
       "physical_iphone_certified":False,
       "remaining_deployment_requirements":[
          "Owner-provisioned Drive service account with archive folder access and tested remote restore",
          "Authorized social analytics with actual observed campaign outcomes",
          "Licensed media source evidence and permission review",
          "Real iPhone Safari/physical controller and speaker acceptance",
          "Actual scheduled Oct 15–21 results, with no missing or degraded days"],
       "milestones":[]
    }
    drive_complete=all(backups.get(day,{}).get("archive_restore_verified") and
                       backups.get(day,{}).get("drive_status")=="RESTORE_VERIFIED"
                       for day in DATES)
    for code,summary in CODES:
        if code=="LAB-FINISH.01":status="VERIFIED" if real_grades else "PENDING_REAL_OCT15_OBSERVATIONS"
        elif code=="LAB-FINISH.03":status="REMOTE_RESTORE_VERIFIED" if drive_complete else "GOOGLE_DRIVE_AUTH_OR_RESTORE_PENDING"
        elif code=="LAB-FINISH.08":status="CODE_READY_OWNED_ANALYTICS_PENDING"
        elif code=="LAB-FINISH.10":status="CODE_READY_RIGHTS_PENDING"
        elif code=="LAB-FINISH.15":status="CODE_READY_PHYSICAL_DEVICE_PENDING"
        elif code=="LAB-FINISH.17":status="VERIFIED" if study.get("status")=="COMPLETE_EVIDENCE_ONLY" else "AWAITING_OCT21_SETTLEMENT"
        elif code=="LAB-FINISH.18":status="PRODUCTION_ACCEPTANCE_BLOCKED_EXTERNAL_RIGHTS_ANALYTICS_AND_DEVICE"
        elif code in CODE_ONLY:status="CODE_IMPLEMENTED_REQUIRES_PRODUCTION_EVIDENCE"
        else:status="PENDING_EVIDENCE"
        report["milestones"].append({"id":code,"description":summary,"status":status})
    report["certification"]="RESEARCH_EVIDENCE_COMPLETE_ONLY" if study.get("status")=="COMPLETE_EVIDENCE_ONLY" else "INCOMPLETE_PENDING_DATES_OR_EVIDENCE"
    report["production_certified"]=False
    return report

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True)
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    report=run(args.root)
    directory=pathlib.Path(args.output);directory.mkdir(parents=True,exist_ok=True)
    (directory/"lab-finish-acceptance.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    rows=["# Jhadina LAB-FINISH certification","",
          "**Research evidence:** "+report["certification"],"",
          "| Milestone | State |","|---|---|"]
    rows += [f'| {x["id"]} | {x["status"]} |' for x in report["milestones"]]
    rows += ["","**Full production acceptance remains blocked until separate authorizations and device tests are supplied.**"]
    (directory/"lab-finish-acceptance.md").write_text("\n".join(rows)+"\n")
    print(json.dumps({"research":report["certification"],"production_certified":False,
                      "milestones":len(report["milestones"])}))
    return 0

if __name__=="__main__":sys.exit(main())
