#!/usr/bin/env python3
"""Generate derivative, honest five-lab inspection and phone-readable artifact.

Does not modify the sealed original evidence; report is SHA-linked to it.
"""
import argparse
import json
import pathlib
import sys
from admission import read_valid
from finish_core import inspect,render_html,fingerprint
from learning import sha

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--evidence",required=True)
    ap.add_argument("--previous")
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    try:
        record=json.loads(pathlib.Path(args.evidence).read_text())
        if sha({k:v for k,v in record.items() if k!="record_sha256"})!=record.get("record_sha256"):
            raise ValueError("Unsealed source record cannot be reviewed")
        previous=json.loads(pathlib.Path(args.previous).read_text()) if args.previous and pathlib.Path(args.previous).exists() else None
        if previous is not None:
            if sha({k:v for k,v in previous.items() if k!="record_sha256"})!=previous.get("record_sha256"):
                raise ValueError("Invalid previous-day hash in lab report")
            if record.get("prior_record_sha256")!=previous.get("record_sha256") and record.get("preflight") is not True:
                raise ValueError("Previous-day paper chain mismatch")
        report=inspect(record,previous)
        output=pathlib.Path(args.output)
        output.mkdir(parents=True,exist_ok=True)
        (output/"five-lab-review.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
        (output/"five-lab-phone-dashboard.html").write_text(render_html(report))
        print(json.dumps({"five_lab_review":report["status"],
                          "blockers":report["blocking_checks"],
                          "review_sha256":report["report_sha256"]}))
        return 0
    except (OSError,TypeError,ValueError,KeyError) as exc:
        print("INSPECTION_INCOMPLETE:"+type(exc).__name__,file=sys.stderr)
        return 1
if __name__=="__main__":sys.exit(main())
