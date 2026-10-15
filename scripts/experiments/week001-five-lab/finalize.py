from domain_evidence import changes as observe_domain_changes
from five_lab_models import assemble as recompute_labs
from continuity import FIRST_DATE, verify_genesis
#!/usr/bin/env python3
"""Verify and report an actual seven-day experiment plus October 21 settlement.
No model is trained or promoted from this report; all outputs are evidence-only.
"""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import sys

START = dt.date(2026, 10, 14)
LAST = dt.date(2026, 10, 21)
DATES = [(START + dt.timedelta(days=i)).isoformat() for i in range(8)]

def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()

def sha(value):
    return hashlib.sha256(encode(value)).hexdigest()

def verify(path):
    """Verify each record and its nested sealed cases against canonical hashes."""
    record = json.loads(path.read_text())
    assert isinstance(record, dict)
    record_sig = record.get("record_sha256")
    unsealed = {k: v for k,v in record.items() if k != "record_sha256"}
    if not record_sig or sha(unsealed) != record_sig:
        raise ValueError("record hash mismatch")
    if record.get("schema_version") != 1 or record.get("preflight") or record.get("dry_run"):
        raise ValueError("not a live experiment record")
    if record.get("date") not in DATES:
        raise ValueError("outside expected window")
    if record.get("financial_authority") != "NONE" or record.get("publication_authority") != "NONE" or record.get("paid_services_authorized") is not False:
        raise ValueError("unsafe or unverified authority")
    for kind, sig in (("predictions", "prediction_sha256"), ("outcomes", "grade_sha256")):
        for case in record.get(kind, []):
            if not isinstance(case, dict) or sha({k:v for k,v in case.items() if k!=sig}) != case.get(sig):
                raise ValueError("invalid "+kind+" signature")
            if kind == "predictions" and (case.get("execute_authority") is not False or case.get("publication_authority") is not False):
                raise ValueError("unsafe prediction case")
    return record

def validate_outcomes(previous, current):
    errors=[]
    sealed={p["prediction_id"]:p for p in previous.get("predictions",[])}
    matches=0
    for outcome in current.get("outcomes",[]):
        p=sealed.get(outcome.get("prediction_id"))
        if not p or p.get("prediction_sha256")!=outcome.get("prediction_sha256"):
            errors.append("orphaned or altered prediction: "+str(outcome.get("prediction_id")))
            continue
        if p.get("target_date_utc") != current["date"] or p.get("baseline_value") != outcome.get("baseline_value"):
            errors.append("target/baseline mismatch: "+p["prediction_id"])
            continue
        source=p["source"]
        if source=="game_qa":
            status=next((r["status"] for r in current.get("results",[]) if r.get("lab")=="game_qa"),None)
            actual=1 if status=="PASS" else 0 if status=="FAIL" else None
        else:
            receipt=current.get("feeds",{}).get(source,{})
            observed=receipt.get("observation",{})
            actual=observed.get("value") if receipt.get("observation_status")=="VERIFIED_PROVIDER_RESPONSE" else None
            if outcome.get("outcome_receipt_sha256")!=receipt.get("source_response_sha256"):
                errors.append("response receipt mismatch: "+p["prediction_id"])
                continue
        if actual is None or actual != outcome.get("actual_value"):
            errors.append("result/source mismatch: "+p["prediction_id"])
            continue
        if outcome.get("investment_performance") is not False or outcome.get("independently_verified_business_or_engagement_outcome") is not False:
            errors.append("real-world performance falsely certified: "+p["prediction_id"])
            continue
        matches+=1
    return matches,errors

def evaluate(root,anchor_first_day=False):
    """Return report from immutable GitHub workflow artifact contents."""
    root=pathlib.Path(root)
    issues=[]
    candidates={}
    invalid=[]
    for path in sorted(root.rglob("evidence.json")):
        try:
            record=verify(path)
            candidates.setdefault(record["date"],[]).append((path,record))
        except (OSError,ValueError,AssertionError,TypeError,KeyError,OverflowError) as exc:
            invalid.append({"path":str(path),"error":type(exc).__name__+": "+str(exc)})
    records={}
    for day in DATES:
        possibilities=candidates.get(day,[])
        if len(possibilities)==1: records[day]=possibilities[0][1]
        elif len(possibilities)==0: issues.append("Missing "+day+" verified scheduled evidence")
        else: issues.append("Ambiguous duplicate records for "+day)
    if anchor_first_day:
        initial=records.get(FIRST_DATE.isoformat())
        if initial is None or not verify_genesis(initial):
            issues.append("Original October 14 scheduled evidence anchor mismatch: reject replacement or replay")
    for invalid_receipt in invalid:
        issues.append("Rejected invalid artifact "+invalid_receipt["path"]+": "+invalid_receipt["error"])
    predictions=0
    graded=0
    metrics={}
    daily=[]
    for i,day in enumerate(DATES):
        record=records.get(day)
        if not record: continue
        if i==7 and (record.get("settlement") is not True or record.get("predictions")):
            issues.append("October 21 must be outcome-only settlement")
        if i<7 and record.get("settlement"):
            issues.append("Unexpected settlement during experiment: "+day)
        preds=record.get("predictions",[])
        grades=record.get("outcomes",[])
        predictions+=len(preds)
        prev=records.get(DATES[i-1]) if i>0 else None
        valid_grades=0
        if i and prev:
            if record.get("prior_record_sha256")!=prev.get("record_sha256"):
                issues.append("Broken previous-day hash chain on "+day)
            if record.get("prior_state")!="VERIFIED_PRIOR_DAY":
                issues.append("Previous-day evidence not verified on "+day)
            valid_grades,errors=validate_outcomes(prev,record)
            issues.extend(errors)
        elif i and grades:
            issues.append("Outcomes cannot be checked without prior date on "+day)
        if record.get("lab_experiments") is not None:
            try:
                capture=record["lab_experiments_captured_at_utc"]
                observed=recompute_labs(dt.date.fromisoformat(day),capture,
                                        record.get("feeds",{}),record.get("results",[]),
                                        prev,record.get("browser_qa"))
                if observed!=record["lab_experiments"]:
                    issues.append("Domain experiment evidence does not reconcile to public feeds on "+day)
            except (KeyError,ValueError,TypeError,ZeroDivisionError,OverflowError):
                issues.append("Domain experiment recomputation failed on "+day)
        if i==0 and grades: issues.append("First day contains premature grades")
        observed_metadata=record.get("domain_changes")
        if observed_metadata is not None:
            expected_metadata=observe_domain_changes(prev,record.get("feeds",{})) if prev else {}
            if observed_metadata!=expected_metadata:
                issues.append("Unreconciled public metadata sample changes on "+day)
        graded+=valid_grades
        for row in grades:
            if valid_grades!=len(grades): continue
            kind=row["outcome_kind"]
            metrics.setdefault(kind,[]).append(row)
        expected_sources={"capital","social_music","business","tv_music","tv_music_catalog"}
        expected_labs={"capital","social_music","business","tv_music","game_qa"}
        missing=sorted(key for key in expected_sources if record.get("feeds",{}).get(key,{}).get("observation_status")!="VERIFIED_PROVIDER_RESPONSE")
        certifications={r.get("lab"):r.get("status") for r in record.get("results",[])}
        failures=sorted(lab for lab in expected_labs if certifications.get(lab)!="PASS")
        if missing: issues.append("Missing verified source(s) on "+day+": "+", ".join(missing))
        if failures: issues.append("Failed or missing lab certification(s) on "+day+": "+", ".join(failures))
        if i<7 and len(preds)!=6:
            issues.append("Incomplete pre-outcome forecasts on "+day+": "+str(len(preds))+"/6")
        if i>0 and valid_grades!=6:
            issues.append("Incomplete verified next-day grades on "+day+": "+str(valid_grades)+"/6")
        if record.get("lab_experiments",{}).get("capital",{}).get("unresolved_prior_position"):
            issues.append("Unresolved paper position requires explicit review on "+day)
        if record.get("health",{}).get("status")=="DEGRADED":
            issues.append("Daily collector reported DEGRADED on "+day)
        daily.append({"date":day,"metadata_comparisons":len(record.get("domain_changes",{})),"predictions":len(preds),"raw_grades":len(grades),"verified_grades":valid_grades,"unavailable_sources":missing,"failed_lab_tests":failures,"hash":record["record_sha256"]})
    if not predictions: issues.append("No genuine pre-outcome predictions were sealed")
    if not graded: issues.append("No forward outcomes could be independently reconciled")
    kinds={}
    for kind,rows in metrics.items():
        compare=[x for x in rows if x.get("challenger_absolute_error") is not None]
        kinds[kind]={
            "verified_forward_cases":len(rows),
            "baseline_mean_absolute_error":sum(x["baseline_absolute_error"] for x in rows)/len(rows),
            "challenger_cases":len(compare),
            "challenger_mean_absolute_error":sum(x["challenger_absolute_error"] for x in compare)/len(compare) if compare else None,
            "auto_promotion_authorized":False
        }
    return {
        "schema_version":1,
        "window":"2026-10-14 through 2026-10-20; settlement 2026-10-21",
        "status":"COMPLETE_EVIDENCE_ONLY" if not issues else "INCOMPLETE_OR_UNVERIFIED",
        "dates_verified":len(records),
        "expected_dates":len(DATES),
        "sealed_predictions":predictions,
        "verified_forward_outcomes":graded,
        "metrics":kinds,
        "daily":daily,
        "issues":issues,
        "invalid_artifacts":invalid,
        "no_paid_spending":True,
        "no_trading_or_publication":True,
        "automatic_strategy_promotion":False,
        "limitations":[
            "BTC market observations do not constitute executed paper-trade P&L",
            "Music and TV catalog counts do not prove engagement or licensed playback",
            "Grants.gov search counts do not represent closed sales or qualified contractors",
            "Gaming unit tests do not verify iPhone Safari audio and controls",
            "No training weights are modified; evidence-only baseline comparison"
        ]
    }

def render(report):
    out=[
        "# Jhadina Five-Lab Experiment: Final Evidence Report",
        "",
        "**State:** "+report["status"],
        "",
        f"Experiment: {report['window']}",
        f"Verified days: {report['dates_verified']}/{report['expected_dates']}",
        f"Sealed pre-outcome cases: {report['sealed_predictions']}",
        f"Verified next-day outcomes: {report['verified_forward_outcomes']}",
        "",
        "## Daily coverage",
        "| UTC day | Forecasts | Graded outcomes | Unavailable sources | Failed lab tests |",
        "|---|---:|---:|---|---|"
    ]
    for d in report["daily"]:
        out.append(f"| {d['date']} | {d['predictions']} | {d['verified_grades']} | {', '.join(d['unavailable_sources']) or 'None'} | {', '.join(d['failed_lab_tests']) or 'None'} |")
    out.extend(("", "## Forward-baseline accuracy", "| Research proxy | Verified cases | Baseline MAE | Challenger cases | Challenger MAE |", "|---|---:|---:|---:|---:|"))
    for kind,metric in sorted(report["metrics"].items()):
        challenger=metric["challenger_mean_absolute_error"]
        out.append(f"| {kind} | {metric['verified_forward_cases']} | {metric['baseline_mean_absolute_error']:.5f} | {metric['challenger_cases']} | {f'{challenger:.5f}' if challenger is not None else 'Not scored'} |")
    out.extend(("", "## Certification and safety limitations"))
    out.extend("- "+s for s in report["limitations"])
    out.extend(("", "**No real-money authority. No automatic strategy promotion.**", "", "## Blockers"))
    out.extend("- "+s for s in report["issues"]) if report["issues"] else out.append("None detected in the research-evidence chain.")
    return "\n".join(out)+"\n"

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    report=evaluate(args.root,anchor_first_day=True)
    folder=pathlib.Path(args.output)
    folder.mkdir(parents=True,exist_ok=True)
    (folder/"final-report.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    (folder/"final-report.md").write_text(render(report))
    print(json.dumps({"status":report["status"],"dates":report["dates_verified"],"predictions":report["sealed_predictions"],"outcomes":report["verified_forward_outcomes"],"issues":len(report["issues"])}))
    return 0 if report["status"]=="COMPLETE_EVIDENCE_ONLY" else 1

if __name__=="__main__":
    sys.exit(main())
