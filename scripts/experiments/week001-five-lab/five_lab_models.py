"""Five bounded Jhadina research experiments. All outputs are non-executable.
Source receipts are immutable inputs; only forward-day paper fills may be graded.
"""
import datetime as dt
import hashlib
import json
import math
import statistics

VIRTUAL_CASH=1000.0
PAPER_NOTIONAL=100.0
FEE_BPS=10.0
SLIPPAGE_BPS=5.0
KEYWORDS=("business","entrepreneur","music","community","small","research","education","technology","marketing","creative","local")
RELEASES=(
 {"id":"music-release-a","title":"Night Drive","format":"short_visualizer","hook":"behind_the_song","audience":"independent_hip_hop"},
 {"id":"music-release-b","title":"Night Drive — Studio Cut","format":"lyric_clip","hook":"first_line","audience":"independent_hip_hop"},
 {"id":"music-release-c","title":"Night Drive — Late Mix","format":"behind_scenes","hook":"production_breakdown","audience":"producers"},
)

def _finite(value):
    try:
        n=float(value)
        return n if math.isfinite(n) and n>=0 else None
    except (ValueError,TypeError,OverflowError):
        return None

def _time(value):
    try:
        t=dt.datetime.fromisoformat(str(value).replace("Z","+00:00"))
        if t.tzinfo is None:return None
        return t.astimezone(dt.timezone.utc)
    except (TypeError,ValueError,OverflowError):
        return None

def _sha(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False).encode()).hexdigest()

def capital(feeds,previous,observed_at):
    """Long-only one-day mark to bid. Pays both fees and slippage; no order sent."""
    now=_time(observed_at)
    q=feeds.get("capital",{})
    info=q.get("domain_evidence") or {}
    quote=q.get("observation") or {}
    bid=_finite(info.get("bid_usd"))
    ask=_finite(info.get("ask_usd"))
    mark=_time(quote.get("provider_timestamp"))
    valid=bool(q.get("observation_status")=="VERIFIED_PROVIDER_RESPONSE" and
               info.get("status")=="OBSERVED" and bid and ask and bid<=ask and now and mark and
               -60 <= (now-mark).total_seconds() <= 1800)
    prior=(previous or {}).get("lab_experiments",{}).get("capital",{})
    state=prior.get("state") or {}
    balance=float(state.get("equity_usd",VIRTUAL_CASH))
    peak=float(state.get("peak_equity_usd",VIRTUAL_CASH))
    history=list(state.get("net_return_pct",[]))[-6:]
    peak=max(peak,balance)
    closed=None
    prior_position=prior.get("open_position")
    open_prior=prior_position if isinstance(prior_position,dict) else None
    position=None
    unresolved_reason=None
    if open_prior:
        try:
            due=dt.date.fromisoformat(open_prior["target_date_utc"])
        except (KeyError,TypeError,ValueError):
            due=None
        # Never invent next-day fills after a missed due date: preserve the position
        # and require a specifically documented evaluation decision.
        if due is None:
            unresolved_reason="INVALID_PRIOR_POSITION_TARGET"
        elif now is None or now.date()>due:
            unresolved_reason="MISSED_TARGET_DATE_REQUIRES_REVIEW"
        elif now.date()<due:
            unresolved_reason="POSITION_NOT_DUE_YET"
        elif not valid:
            unresolved_reason="TARGET_DAY_MARKET_QUOTE_UNAVAILABLE"
        else:
            units=_finite(open_prior.get("units"))
            stake=_finite(open_prior.get("notional_usd"))
            entry_ts=_time(open_prior.get("quote_at_utc"))
            if not (units and stake and stake<=balance*1.01 and entry_ts and mark and mark>entry_ts
                    and open_prior.get("authority")=="PAPER_ONLY"):
                unresolved_reason="UNVERIFIABLE_OR_UNSAFE_PRIOR_POSITION"
            else:
                sell=bid*(1-SLIPPAGE_BPS/10000)
                proceeds=units*sell*(1-FEE_BPS/10000)
                pnl=proceeds-stake
                balance=round(balance+pnl,6)
                daily_return=pnl/stake*100
                history.append(daily_return)
                history=history[-7:]
                peak=max(peak,balance)
                closed={"entry_quote_at_utc":open_prior["quote_at_utc"],"exit_quote_at_utc":quote["provider_timestamp"],
                        "entry_effective_ask_usd":open_prior["entry_effective_ask_usd"],
                        "exit_effective_bid_usd":round(sell,6),"units":units,
                        "notional_usd":stake,"proceeds_usd":round(proceeds,6),
                        "net_pnl_usd":round(pnl,6),"net_return_pct":round(daily_return,6),
                        "cost_model":{"per_side_fee_bps":FEE_BPS,"per_side_slippage_bps":SLIPPAGE_BPS,"spread_included":True},
                        "observed_only_not_executed":True}
    # Unresolved exposure survives missing data. Never issue a second position
    # until the original simulated research case has settled or been reviewed.
    if unresolved_reason:
        position=dict(open_prior)
    elif valid and now.date()<dt.date(2026,10,21) and balance>=PAPER_NOTIONAL:
        entry_price=ask*(1+SLIPPAGE_BPS/10000)
        units=(PAPER_NOTIONAL*(1-FEE_BPS/10000))/entry_price
        position={"quote_at_utc":quote["provider_timestamp"],"information_cutoff_utc":observed_at,
                  "target_date_utc":(now.date()+dt.timedelta(days=1)).isoformat(),
                  "entry_effective_ask_usd":round(entry_price,6),"units":units,
                  "notional_usd":PAPER_NOTIONAL,"provider_receipt_sha256":q.get("source_response_sha256"),
                  "authority":"PAPER_ONLY"}
    drawdown=max(0,(peak-balance)/peak*100) if peak>0 else 0
    max_drawdown=max(drawdown,float(state.get("max_drawdown_pct",0)))
    sharpe_like=None
    if len(history)>=2:
        stdev=statistics.stdev(history)
        if stdev>0: sharpe_like=round(statistics.mean(history)/stdev,6)
    return {"lab":"capital","mode":"PAPER_ONLY","status":"OBSERVED" if valid else "QUOTE_UNAVAILABLE",
            "new_paper_entry":position if not unresolved_reason else None,"open_position":position,"closed_paper_trade":closed,
            "unresolved_prior_position":bool(unresolved_reason),"unresolved_reason":unresolved_reason,
            "state":{"equity_usd":balance,"peak_equity_usd":peak,"max_drawdown_pct":round(max_drawdown,6),"current_closed_equity_drawdown_pct":round(drawdown,6),
                     "net_return_pct":history,"mean_daily_paper_return_pct":round(statistics.mean(history),6) if history else None,
                     "sample_sharpe_like_unannualized":sharpe_like,
                     "samples":len(history)},
            "constraints":{"no_trade_or_wallet_access":True,"max_notional_usd":PAPER_NOTIONAL,
                           "fee_bps_per_side":FEE_BPS,"slippage_bps_per_side":SLIPPAGE_BPS},
            "risk_metric_caveat":"Closed-equity drawdown omits unsettled intraday marking. Sharpe-like ratio requires >=2 daily paper outcomes, unannualized and not investment performance."}

def social_music(day,feeds):
    """Predeclared toy scenario using deterministic simulated impressions, NOT provider engagement."""
    proxy=feeds.get("social_music",{})
    context=(proxy.get("domain_evidence") or {})
    cases=[]
    for variant in RELEASES:
        seed=int(_sha({"day":str(day),"id":variant["id"],"scenario":"synthetic-v1"})[:8],16)
        impressions=100
        # Controlled fixed scenario preferences and deterministic noise, never real-user views.
        format_weight={"short_visualizer":8,"lyric_clip":11,"behind_scenes":6}[variant["format"]]
        hook_weight={"behind_the_song":3,"first_line":6,"production_breakdown":4}[variant["hook"]]
        clicks=min(100,format_weight+hook_weight+seed%5)
        cases.append({**variant,"hypothesis":"Short-form title/hook/format preference in a synthetic hip-hop test cohort",
                      "simulated_impressions":impressions,"simulated_clicks":clicks,
                      "simulated_ctr_pct":float(clicks),"source":"DETERMINISTIC_SIMULATION_NOT_ACCOUNT_ANALYTICS",
                      "publication_authorized":False})
    return {"lab":"social_music","status":"SIMULATION_ONLY","simulation_version":"scenario-v1",
            "winner_in_simulation_only":max(cases,key=lambda c:c["simulated_clicks"])["id"],
            "variants":cases,"catalog_context_count":context.get("sample_count"),
            "genuine_engagement_verified":False,"statistical_inference_permitted":False,
            "requires":"Authorized owned social-account analytics and observed campaign exposure to evaluate real reach."}

def business(feeds,day):
    """Rank real public opportunity samples, never infer applicant eligibility or award value."""
    source=(feeds.get("business",{}).get("domain_evidence") or {}).get("sample_opportunities",[])
    results=[]
    for item in source:
        number=item.get("number")
        if not number: continue
        title=str(item.get("title") or "")
        agency=str(item.get("agency") or "")
        text=(title+" "+agency).casefold()
        matched=[w for w in KEYWORDS if w in text]
        relevance=min(50,10*len(matched))
        # Search2 dates can be ISO or US month/day/year; labels remain unverified.
        raw_close=str(item.get("close_date_unverified") or "").strip()
        closing_day=None
        for parser in (lambda text:dt.date.fromisoformat(text[:10]),
                       lambda text:dt.datetime.strptime(text,"%m/%d/%Y").date()):
            try:
                closing_day=parser(raw_close)
                break
            except ValueError:
                continue
        days_left=(closing_day-day).days if closing_day else None
        deadline_score=0 if days_left is None else 25 if 1<=days_left<=30 else 15 if 31<=days_left<=90 else 5 if days_left>90 else -30
        detail=item.get("official_detail") if item.get("detail_status")=="VERIFIED_OFFICIAL_DETAIL" else None
        ceiling=_finite((detail or {}).get("award_ceiling_usd"))
        floor=_finite((detail or {}).get("award_floor_usd"))
        award_score=0 if ceiling is None else 25 if ceiling>=1000000 else 15 if ceiling>=100000 else 8 if ceiling>0 else 0
        score=max(0,min(100,relevance+deadline_score+award_score))
        results.append({"source_number":number,"title":title,"agency":agency,
                        "value_score":award_score,
                        "matched_relevance_terms":matched,"relevance_score":relevance,
                        "listed_close_date_unverified":closing_day.isoformat() if closing_day else None,
                        "days_to_listed_close_date":days_left,"score_heuristic_only":score,
                        "applicant_eligibility":"NOT_VERIFIED","potential_award_usd":ceiling,
                        "provider_award_floor_usd":floor,
                        "applicant_type_descriptions":(detail or {}).get("applicant_type_descriptions",[]),
                        "funding_value_status":"OFFICIAL_CEILING_NOT_GUARANTEED" if ceiling is not None else "UNKNOWN_NOT_IN_RECEIPT",
                        "outreach_or_application_authorized":False})
    results.sort(key=lambda x:(-x["score_heuristic_only"],x["source_number"]))
    return {"lab":"business","status":"RANKED_PUBLIC_SAMPLES" if results else "NO_ELIGIBLE_SOURCE_SAMPLES",
            "opportunities":results,"eligibility_verified":False,"contractor_or_grant_win_verified":False,
            "rank_caveat":"Heuristic relevance and listed deadline only; cannot certify eligibility, funding or commercial value."}

def discovery(feeds,observed_at):
    """Dedup and rank catalog hits. Official link != streaming authorization."""
    all_items=[]
    for key in ("tv_music","tv_music_catalog"):
        receipt=feeds.get(key,{})
        evidence=receipt.get("domain_evidence") or {}
        stamp=_time(receipt.get("observed_at_utc"))
        now=_time(observed_at)
        freshness=None
        if stamp and now:freshness=round((now-stamp).total_seconds()/3600,4)
        for raw in evidence.get("sample_items",[]):
            title=(raw.get("name") or "")
            genre=(raw.get("genre") or "")
            relevance=40 if ("planet earth" in title.casefold() if key=="tv_music" else "jazz" in genre.casefold()) else 0
            official=bool(raw.get("official_catalog_link_present"))
            all_items.append({"source":key,"id":str(raw.get("id")),"name":title,"genre":genre,
                              "provider_observation_age_hours":freshness,
                              "official_catalog_link_verified":official,
                              "playback_rights_verified":False,
                              "score":relevance+(20 if official else 0)+(10 if freshness is not None and 0<=freshness<=24 else 0)})
    seen=set();ranked=[];dupes=0
    for row in sorted(all_items,key=lambda x:(-x["score"],x["source"],x["id"])):
        ident=(row["source"],row["id"])
        if ident in seen:dupes+=1;continue
        seen.add(ident);ranked.append(row)
    return {"lab":"tv_music","status":"PUBLIC_CATALOG_RANKED" if ranked else "NO_CATALOG_CANDIDATES",
            "ranked_candidates":ranked,"duplicate_rows_removed":dupes,
            "official_catalog_links":sum(x["official_catalog_link_verified"] for x in ranked),
            "authorized_playback_sources":0,"playback_certification":"NOT_VERIFIED",
            "catalog_freshness_basis":"Time since provider read, not underlying title release/update date."}

def game_qa(results, browser=None):
    game=next((x for x in results if x.get("lab")=="game_qa"),{})
    browser=browser if isinstance(browser,dict) else {}
    checks=browser.get("checks") if isinstance(browser.get("checks"),list) else []
    return {"lab":"game_qa",
            "core_regression_status":game.get("status","NOT_EXECUTED"),
            "headless_browser_status":browser.get("status","NOT_RUN"),
            "browser_checks":checks,
            "actual_iphone_safari_audio_verified":False,
            "hardware_touchscreen_verified":False,
            "user_gesture_audio_route":browser.get("audio_route","NOT_VERIFIED"),
            "limitations":"Headless browser behavior is not physical iPhone audio, speakers or multi-touch."}

def assemble(day,observed_at,feeds,results,previous=None,browser=None):
    """Research artifacts are not input to the six legacy pre-outcome forecasts."""
    suite={
      "capital":capital(feeds,previous,observed_at),
      "social_music":social_music(day,feeds),
      "business":business(feeds,day),
      "tv_music":discovery(feeds,observed_at),
      "game_qa":game_qa(results,browser),
    }
    return suite
