"""LAB-FINISH.04-.18: typed, read-only decision scorecards and acceptance gates.

Source labels are intentionally restrictive. Attested permissions are never
silently promoted into external certifications.
"""
import datetime as dt
import hashlib
import html
import json
import math
import pathlib
from urllib.parse import urlsplit

SCHEMA=2
LABS=("capital","social_music","business","tv_music","game_qa")
def fingerprint(obj):
    return hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(",",":"),allow_nan=False).encode()).hexdigest()
def utc(value):
    if not isinstance(value,str):return None
    try:
        d=dt.datetime.fromisoformat(value.replace("Z","+00:00"))
        return d.astimezone(dt.timezone.utc) if d.tzinfo is not None else None
    except (ValueError,OverflowError):return None
def valid_number(value):
    if isinstance(value,bool):return None
    try:
        value=float(value)
        return value if math.isfinite(value) and value>=0 else None
    except (ValueError,TypeError,OverflowError):return None

def paper_review(record,previous=None):
    latest=record.get("lab_experiments",{}).get("capital",{})
    ledger=(previous or {}).get("lab_experiments",{}).get("capital",{})
    closed=latest.get("closed_paper_trade")
    equity=(latest.get("state") or {})
    equity_value=valid_number(equity.get("equity_usd"))
    peak=valid_number(equity.get("peak_equity_usd"))
    drawdown=valid_number(equity.get("max_drawdown_pct"))
    state=latest.get("status","UNAVAILABLE")
    blockers=[]
    if latest.get("unresolved_prior_position"):blockers.append("PAPER_POSITION_UNSETTLED")
    if equity_value is None or peak is None or not peak or drawdown is None:
        blockers.append("EQUITY_OR_DRAWDOWN_UNVERIFIED")
    if equity_value is not None and peak is not None and equity_value>peak+0.00001:
        blockers.append("EQUITY_EXCEEDS_RECORDED_PEAK")
    comparison=None
    if closed:
        previous_open=ledger.get("open_position")
        prior_quote=utc((previous_open or {}).get("quote_at_utc"))
        exit_quote=utc(closed.get("exit_quote_at_utc"))
        entry_price=valid_number(closed.get("entry_effective_ask_usd"))
        exit_price=valid_number(closed.get("exit_effective_bid_usd"))
        stake=valid_number(closed.get("notional_usd"))
        pnl=closed.get("net_pnl_usd")
        if not(previous_open and prior_quote and exit_quote and exit_quote>prior_quote
               and stake and entry_price and exit_price and isinstance(pnl,(int,float)) and math.isfinite(pnl)
               and closed.get("observed_only_not_executed") is True):
            blockers.append("PAPER_TRADE_UNVERIFIABLE")
        else:
            change_pct=pnl/stake*100
            comparison={"capital_virtual_trade_return_pct":round(change_pct,6),
                        "no_trade_return_pct":0.0,
                        "paper_minus_no_trade_pct":round(change_pct,6),
                        "spread_fee_slippage_included":True,
                        "real_trade_or_investment_return":False}
    return {"lab":"capital","mode":"PAPER_ONLY","status":state,"blockers":blockers,
            "paper_position_open":bool(latest.get("open_position")),
            "closed_position_evaluated":comparison is not None,"comparison":comparison,
            "max_closed_equity_drawdown_pct":drawdown,
            "risk_metric":equity.get("sample_sharpe_like_unannualized"),
            "risk_metric_sample_count":equity.get("samples",0),
            "buy_and_hold_baseline":"NOT_COMPARABLE_WITHOUT_MATCHED_FORWARD_QUOTE_SERIES",
            "automatic_order_authority":False}

def campaign_plan(record,owned_analytics=None):
    source=record.get("lab_experiments",{}).get("social_music",{})
    variants=source.get("variants") or []
    review={"lab":"social_music","measurement":"SIMULATED_EXPOSURE_ONLY",
            "variants":len(variants),"synthetic_winner":source.get("winner_in_simulation_only"),
            "owned_account_authorized":False,"external_engagement_verified":False,
            "publication_authorized":False,"observed_metrics":None}
    if not isinstance(owned_analytics,dict):return review
    # User-supplied metrics must carry ownership, named campaign, post-issuance cutoff and provenance.
    proof=owned_analytics.get("authorization_receipt_sha256","")
    issued=utc(owned_analytics.get("published_at_utc"))
    measured=utc(owned_analytics.get("observed_at_utc"))
    cases={v.get("id") for v in variants}
    exposures=valid_number(owned_analytics.get("impressions"))
    clicks=valid_number(owned_analytics.get("clicks"))
    if (owned_analytics.get("provenance_kind")!="OWNED_PLATFORM_ACCOUNT_ANALYTICS"
        or not isinstance(proof,str) or len(proof)!=64
        or not issued or not measured or measured<=issued
        or owned_analytics.get("variant_id") not in cases
        or exposures is None or not exposures or clicks is None or clicks>exposures):
        review["analytics_status"]="REJECTED_UNVERIFIED_OR_INVALID"
        return review
    review["measurement"]="OWNER_ATTESTED_ANALYTICS_NOT_INDEPENDENTLY_VERIFIED"
    review["owned_account_authorized"]=True
    review["observed_metrics"]={"variant":owned_analytics["variant_id"],"impressions":exposures,
                                "clicks":clicks,"ctr_pct":round(100*clicks/exposures,4)}
    review["analytics_status"]="ACCEPTED_AS_USER_ATTESTATION_NOT_PLATFORM_AUDIT"
    return review

def business_review(record):
    lab=record.get("lab_experiments",{}).get("business",{})
    candidates=lab.get("opportunities",[])
    reviews=[]
    for row in candidates:
        award=valid_number(row.get("potential_award_usd"))
        score=valid_number(row.get("score_heuristic_only"))
        expired=(row.get("days_to_listed_close_date") is not None and row["days_to_listed_close_date"]<0)
        reviews.append({"id":row.get("source_number"),"research_priority":score,
                        "award_ceiling_usd_unpromised":award,
                        "expired_per_listed_date":expired,
                        "eligibility":"REQUIRES_APPLICANT_AND_CURRENT_AGENCY_RULE_REVIEW",
                        "decision":"DO_NOT_APPLY" if expired else "HUMAN_ELIGIBILITY_REVIEW",
                        "application_authority":False})
    return {"lab":"business","candidates":reviews,
            "genuine_verified_grant_award":False,"outreach_authorized":False,
            "notes":"Eligibility requires real applicant details and current agency rules; ceilings are not expected revenue."}

def media_review(record,rights=None):
    lab=record.get("lab_experiments",{}).get("tv_music",{})
    items=lab.get("ranked_candidates",[])
    seen=set()
    output=[]
    rights=rights if isinstance(rights,dict) else {}
    for item in items:
        key=(str(item.get("source")),str(item.get("id")))
        if key in seen:continue
        seen.add(key)
        claim=rights.get("|".join(key),{})
        license_reviewed=(isinstance(claim,dict) and claim.get("legal_review_completed") is True
                          and claim.get("rights_holder_verified") is True and
                          isinstance(claim.get("rights_receipt_sha256"),str) and
                          len(claim["rights_receipt_sha256"])==64 and
                          claim.get("permission_scope")=="PERSONAL_STREAMING_IN_APP")
        try:
            host=urlsplit(claim.get("playback_url","")).hostname if license_reviewed else None
        except ValueError:host=None
        playback_verified=bool(license_reviewed and claim.get("playback_url","").startswith("https://")
                               and host and host in tuple(claim.get("authorized_hosts",[])))
        output.append({"source":key[0],"id":key[1],"rank":len(output)+1,
                       "provider_catalog_link_present":item.get("official_catalog_link_verified") is True,
                       "playback_approved":playback_verified,
                       "rights_status":"ATTESTED_APPROVED_NOT_DEVICE_TESTED" if playback_verified else "NO_VERIFIED_PLAYBACK_RIGHT",
                       "freshness_hours":item.get("provider_observation_age_hours"),
                       "score":item.get("score")})
    return {"lab":"tv_music","candidates":output,"deduplicated_candidates":len(output),
            "approved_playback_count":sum(x["playback_approved"] for x in output),
            "licensed_device_playback_certified":False,
            "license_caveat":"Approval requires independently verified license and authorized host; Apple catalog metadata is not a license."}

REQUIRED_IPHONE=("safari_user_gesture_audio","audible_speaker_route","bluetooth_controller_inputs",
                 "touch_cancel_releases","landscape_controls_visible","fullscreen_responsive")
def game_review(record,physical=None):
    lab=record.get("lab_experiments",{}).get("game_qa",{})
    browser=record.get("browser_qa",{})
    passed={x.get("id") for x in browser.get("checks",[]) if isinstance(x,dict) and x.get("passed") is True}
    physical=physical if isinstance(physical,dict) else {}
    has_evidence=(physical.get("device_kind")=="IPHONE_SAFARI_REAL_DEVICE"
                  and physical.get("human_operator_attested") is True
                  and isinstance(physical.get("evidence_sha256"),str)
                  and len(physical["evidence_sha256"])==64)
    observed=set(physical.get("passed_checks",[])) if isinstance(physical.get("passed_checks"),list) else set()
    confirmed=bool(has_evidence and set(REQUIRED_IPHONE).issubset(observed))
    return {"lab":"game_qa","headless_browser_status":lab.get("headless_browser_status","NOT_RUN"),
            "headless_passed_checks":sorted(passed),
            "headless_actual_ios_hardware":False,
            "physical_iphone_user_attestation":confirmed,
            "independent_iphone_certification":False,
            "missing_real_device_checks":sorted(set(REQUIRED_IPHONE)-observed) if has_evidence else list(REQUIRED_IPHONE),
            "limitations":"Synthetic controller input and muted Web Audio are not audible Safari evidence."}

def inspect(record,previous=None,owned_analytics=None,rights=None,physical=None):
    results={x.get("lab"):x.get("status") for x in record.get("results",[]) if isinstance(x,dict)}
    daily=record.get("health",{})
    exams={"capital":paper_review(record,previous),
           "social_music":campaign_plan(record,owned_analytics),
           "business":business_review(record),
           "tv_music":media_review(record,rights),
           "game_qa":game_review(record,physical)}
    blockers=[]
    if daily.get("status")!="HEALTHY":blockers.append("LIVE_RESEARCH_HEALTH_NOT_VERIFIED")
    if any(results.get(x)!="PASS" for x in LABS):blockers.append("LAB_PACKAGE_TESTS_INCOMPLETE")
    if record.get("financial_authority")!="NONE" or record.get("publication_authority")!="NONE":
        blockers.append("UNSAFE_EXECUTION_AUTHORITY")
    blockers+=exams["capital"]["blockers"]
    if exams["tv_music"]["approved_playback_count"]==0:blockers.append("LICENSED_PLAYBACK_NOT_CERTIFIED")
    if not exams["game_qa"]["physical_iphone_user_attestation"]:blockers.append("IPHONE_HARDWARE_NOT_ATTESTED")
    if not exams["social_music"]["owned_account_authorized"]:blockers.append("OWNED_SOCIAL_ANALYTICS_NOT_CONNECTED")
    status="RESEARCH_COMPLETE_HARDWARE_AND_AUTH_PENDING" if not blockers else "PARTIAL_OR_UNVERIFIED"
    report={"schema":SCHEMA,"date":record.get("date"),"status":status,
            "source_record_sha256":record.get("record_sha256"),
            "labs":exams,"blocking_checks":sorted(set(blockers)),
            "real_money_and_publication_authorized":False,
            "automatic_strategy_promotion":False,
            "final_seven_day_certified":False}
    report["report_sha256"]=fingerprint(report)
    return report

def render_html(report):
    esc=lambda value:html.escape(str(value),quote=True)
    labs=report.get("labs",{})
    items="".join("<article><h2>"+esc(name.replace("_"," ").title())+
        "</h2><pre>"+esc(json.dumps(data,sort_keys=True,indent=2))+"</pre></article>"
        for name,data in labs.items())
    blockers="".join("<li>"+esc(x)+"</li>" for x in report.get("blocking_checks",[]))
    return ("<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        "<meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">"
        "<title>Jhadina — Five Lab Research</title><style>body{margin:0;padding:20px;font-family:system-ui;background:#13171d;color:#f2f3f5}"
        "main{max-width:800px;margin:auto}article{border:1px solid #46505d;border-radius:12px;padding:16px;margin:12px 0}"
        "pre{overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}h1{font-size:24px}"
        "li{margin:8px 0}small{color:#bdc6d1}</style></head><body><main>"
        "<h1>Jhadina • Five Labs</h1><small>Research-only snapshot, not a control or trading dashboard</small>"
        "<p>UTC day: "+esc(report.get("date"))+" | "+esc(report.get("status"))+"</p>"
        "<p>Record SHA-256: <code>"+esc(report.get("source_record_sha256"))+"</code></p>"
        "<h2>Certification blockers</h2><ul>"+blockers+"</ul>"+items+
        "<p>No live money, outreach or publication authority. Recheck provider and rights evidence before use.</p>"
        "</main></body></html>")
