"""Forward-only, sealed, non-executable predictions for Jhadina five-lab week001.
Research proxies are never rebranded as actual business/social/media outcomes.
"""
import datetime as dt
import hashlib
import json
import math

SOURCE_LABS = {
    "capital": ("capital",),
    "social_music": ("social_music",),
    "business": ("business",),
    "tv_music": ("tv_music", "tv_music_catalog"),
}
SOURCE_TYPE = {
    "capital": "market_quote_research_only",
    "social_music": "music_catalog_count_not_engagement",
    "business": "grant_catalog_count_not_leads",
    "tv_music": "tv_catalog_count_not_playback",
    "tv_music_catalog": "music_catalog_count_not_playback",
    "game_qa": "software_regression_not_device_certification",
}
LABS = ("capital", "social_music", "business", "tv_music", "game_qa")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def sha(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def utc_time(value):
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp must be timezone-aware")
    return parsed.astimezone(dt.timezone.utc)


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("A prediction requires a genuine numeric observation")
    if not math.isfinite(value) or value < 0:
        raise ValueError("A prediction cannot use an invalid observation")
    return value


def prior_observation(previous, source):
    if not isinstance(previous, dict) or previous.get("preflight") or previous.get("dry_run"):
        return None
    r = previous.get("feeds", {}).get(source, {})
    if r.get("observation_status") != "VERIFIED_PROVIDER_RESPONSE":
        return None
    try:
        return number(r["observation"]["value"])
    except (KeyError, TypeError, ValueError):
        return None


def seal(pred):
    return dict(pred, prediction_sha256=sha(pred))


def produce(day, captured_at, feeds, results, previous=None):
    """Seal tomorrow's forecast before tomorrow's outcome can be observed."""
    now = utc_time(captured_at)
    if now.date() != day:
        raise ValueError("Never seal a prediction with a different UTC date")
    pass_states = {r["lab"]: r["status"] for r in results}
    predictions = []
    for lab in LABS:
        if pass_states.get(lab) != "PASS":
            continue
        entries = SOURCE_LABS.get(lab, ())
        for source in entries:
            receipt = feeds.get(source, {})
            if receipt.get("observation_status") != "VERIFIED_PROVIDER_RESPONSE":
                continue
            observation = receipt.get("observation", {})
            metric = observation.get("metric")
            if source == "capital":
                try:
                    age = (now-utc_time(observation["provider_timestamp"])).total_seconds()
                    if age < -60 or age > 1800:
                        continue  # reject stale, future, or unauthenticated quote
                except (KeyError, ValueError, TypeError):
                    continue
            source_hash = receipt.get("source_response_sha256")
            if not isinstance(source_hash, str) or len(source_hash) != 64:
                continue
            try:
                current = number(observation.get("value"))
            except ValueError:
                continue
            predecessor = prior_observation(previous, source)
            challenger = None
            if predecessor is not None and predecessor > 0:
                # Deliberately simple counterfactual: half of the last observed change.
                proposed = max(0.0, current + (current-predecessor)/2)
                if source != "capital":
                    proposed = round(proposed)
                if math.isfinite(proposed):
                    challenger = proposed
            predictions.append(seal({
                "prediction_id": f"week001:{day.isoformat()}:{source}",
                "lab": lab, "source": source, "metric": metric,
                "source_kind": SOURCE_TYPE[source],
                "information_cutoff_utc": captured_at,
                "target_date_utc": (day + dt.timedelta(days=1)).isoformat(),
                "source_response_sha256": source_hash,
                "baseline_method": "LAST_OBSERVED_VALUE",
                "baseline_value": current,
                "challenger_method": "HALF_PREVIOUS_CHANGE" if challenger is not None else None,
                "challenger_value": challenger,
                "execute_authority": False,
                "publication_authority": False,
            }))
    # A test-suite outcome is an independent software result, not an external event.
    state = pass_states.get("game_qa")
    if state in ("PASS", "FAIL"):
        predictions.append(seal({
            "prediction_id": f"week001:{day.isoformat()}:game_qa",
            "lab": "game_qa", "source": "game_qa",
            "metric": "next_game_ci_suite_pass",
            "source_kind": SOURCE_TYPE["game_qa"],
            "information_cutoff_utc": captured_at,
            "target_date_utc": (day+dt.timedelta(days=1)).isoformat(),
            "source_response_sha256": None,
            "baseline_method": "LAST_OBSERVED_CI_STATUS",
            "baseline_value": 1 if state == "PASS" else 0,
            "challenger_method": None, "challenger_value": None,
            "execute_authority": False, "publication_authority": False,
        }))
    return predictions


def grade(previous, day, captured_at, feeds, results):
    """Grade only yesterday's previously hashed predictions against today's observation."""
    if not isinstance(previous, dict) or previous.get("preflight") or previous.get("dry_run"):
        return []
    current_time = utc_time(captured_at)
    if dt.date.fromisoformat(previous["date"]) != day-dt.timedelta(days=1):
        return []
    new_states = {r["lab"]: r["status"] for r in results}
    grades = []
    for prediction in previous.get("predictions", []):
        if not isinstance(prediction, dict):
            continue
        signed = dict(prediction)
        signature = signed.pop("prediction_sha256", None)
        if not signature or sha(signed) != signature:
            continue
        if signed.get("target_date_utc") != day.isoformat():
            continue
        if utc_time(signed["information_cutoff_utc"]) >= current_time:
            continue
        source = signed.get("source")
        if source == "game_qa":
            status = new_states.get("game_qa")
            if status not in ("PASS", "FAIL"):
                continue
            actual = 1 if status == "PASS" else 0
            outcome_kind = SOURCE_TYPE[source]
            current_receipt = None
        else:
            receipt = feeds.get(source, {})
            if receipt.get("observation_status") != "VERIFIED_PROVIDER_RESPONSE":
                continue
            if receipt.get("observation", {}).get("metric") != signed.get("metric"):
                continue
            if source == "capital":
                try:
                    quote_time = utc_time(receipt["observation"]["provider_timestamp"])
                    age = (current_time-quote_time).total_seconds()
                    if age < -60 or age > 1800:
                        continue
                    if quote_time <= utc_time(signed["information_cutoff_utc"]):
                        continue
                except (KeyError,ValueError,TypeError):
                    continue
            actual = number(receipt["observation"]["value"])
            outcome_kind = signed["source_kind"]
            current_receipt = receipt.get("source_response_sha256")
            if not current_receipt or len(current_receipt) != 64:
                continue
        baseline = number(signed["baseline_value"])
        challenger = signed.get("challenger_value")
        grade = {
            "prediction_id": signed["prediction_id"],
            "prediction_sha256": signature,
            "date_utc": day.isoformat(),
            "outcome_kind": outcome_kind,
            "actual_value": actual,
            "baseline_value": baseline,
            "baseline_absolute_error": abs(actual-baseline),
            "challenger_value": challenger,
            "challenger_absolute_error": abs(actual-number(challenger)) if challenger is not None else None,
            "outcome_receipt_sha256": current_receipt,
            "independently_verified_business_or_engagement_outcome": False,
            "investment_performance": False,
        }
        grades.append(dict(grade, grade_sha256=sha(grade)))
    return grades


def summarize(grades):
    """No challenger promotion on fewer than three forward-only outcomes."""
    grouped = {}
    for grade in grades:
        key = grade["outcome_kind"]
        grouped.setdefault(key, []).append(grade)
    reports = {}
    for kind, rows in grouped.items():
        comparable = [r for r in rows if r["challenger_absolute_error"] is not None]
        reports[kind] = {
            "resolved_cases": len(rows),
            "challenger_comparable_cases": len(comparable),
            "baseline_mean_absolute_error": sum(r["baseline_absolute_error"] for r in rows)/len(rows),
            "challenger_mean_absolute_error": (sum(r["challenger_absolute_error"] for r in comparable)/len(comparable) if comparable else None),
            "challenger_promotion_eligible": False,
            "reason": "Requires at least three independent forward cases and an explicit review; no automatic promotion.",
        }
    return reports
