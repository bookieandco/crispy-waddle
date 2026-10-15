"""Bounded, source-specific metadata evidence for five-lab research.

This module cannot establish engagement, commercial eligibility, licensed
playback, investment profit or iPhone-device correctness.
"""
import datetime as dt
import math
import re
from urllib.parse import urlparse

CAP = 10
def safe_text(value, limit=160):
    return value.strip()[:limit] if isinstance(value,str) else ""

def opaque_id(value):
    if isinstance(value,int) and value>=0: return str(value)
    if isinstance(value,str) and re.fullmatch(r"[a-zA-Z0-9._:-]{1,90}",value): return value
    return None

def apple_url(value):
    if not isinstance(value,str) or len(value)>1024: return False
    try:
        parsed=urlparse(value)
        return parsed.scheme=="https" and parsed.hostname in ("music.apple.com","tv.apple.com","itunes.apple.com") and not parsed.username and not parsed.password
    except ValueError:
        return False

def evidence(source, raw):
    """Provider-metadata features; never reconstruct artist/audio/video files."""
    if source=="capital":
        try:
            bid=float(raw["bid"]); ask=float(raw["ask"])
            if not all(math.isfinite(v) and v>0 for v in (bid,ask)) or bid>ask: raise ValueError()
            midpoint=(bid+ask)/2
            return {"kind":"market_spread_research_only","status":"OBSERVED",
                    "bid_usd":bid,"ask_usd":ask,
                    "spread_bps":round((ask-bid)/midpoint*10000,5),
                    "paper_roundtrip_spread_cost_bps":round((ask-bid)/ask*10000,5),
                    "trade_authorized":False}
        except (KeyError,TypeError,ValueError,OverflowError):
            return {"kind":"market_spread_research_only","status":"UNAVAILABLE",
                    "trade_authorized":False}
    if source=="business":
        hits=raw.get("data",{}).get("oppHits",[])
        if not isinstance(hits,list): hits=[]
        samples=[]
        for hit in hits[:CAP]:
            if not isinstance(hit,dict): continue
            ident=opaque_id(hit.get("number"))
            if not ident: continue
            samples.append({"number":ident,"title":safe_text(hit.get("title")),
                            "agency":safe_text(hit.get("agency"),100),
                            "close_date_unverified":safe_text(hit.get("closeDate"),40)})
        return {"kind":"posted_grants_search_metadata_not_qualified_leads",
                "sample_count":len(samples),"sample_opportunities":samples,
                "eligibility_verified":False,"outreach_authorized":False}
    if source in ("social_music","tv_music","tv_music_catalog"):
        rows=raw.get("results",[])
        if not isinstance(rows,list): rows=[]
        seen=set(); items=[]
        for hit in rows[:CAP]:
            if not isinstance(hit,dict): continue
            ident=opaque_id(hit.get("trackId")) or opaque_id(hit.get("collectionId"))
            if not ident or ident in seen: continue
            seen.add(ident)
            genre=safe_text(hit.get("primaryGenreName"),80)
            name=safe_text(hit.get("trackName") or hit.get("collectionName"),120)
            artist=safe_text(hit.get("artistName"),100)
            item={"id":ident,"name":name,"artist":artist,"genre":genre,
                  "official_catalog_link_present":apple_url(hit.get("trackViewUrl") or hit.get("collectionViewUrl"))}
            items.append(item)
        if source=="social_music":
            matching=sum("hip hop" in i["genre"].casefold().replace("-"," ") or "rap" in i["genre"].casefold() for i in items)
        elif source=="tv_music":
            matching=sum("planet earth" in (i["name"]+" "+i["artist"]).casefold() for i in items)
        else:
            matching=sum("jazz" in i["genre"].casefold() for i in items)
        return {"kind":"apple_catalog_metadata_not_streaming_or_engagement",
                "sample_count":len(items),"simple_query_match_count":matching,
                "distinct_ids":len(seen),"official_catalog_links":sum(i["official_catalog_link_present"] for i in items),
                "sample_items":items,
                "licensed_playback_verified":False,"engagement_verified":False,
                "recommendation_quality_verified":False}
    raise ValueError("Unrecognized read-only source")

def changes(previous, current):
    """Observed churn of bounded public Apple/Grants lists; NOT real business outcomes."""
    results={}
    if not isinstance(previous,dict) or previous.get("preflight") or previous.get("dry_run"):
        return results
    for source in ("social_music","business","tv_music","tv_music_catalog"):
        a=previous.get("feeds",{}).get(source,{})
        b=current.get(source,{})
        if a.get("observation_status")!="VERIFIED_PROVIDER_RESPONSE" or b.get("observation_status")!="VERIFIED_PROVIDER_RESPONSE":
            continue
        old=a.get("domain_evidence",{})
        new=b.get("domain_evidence",{})
        key="number" if source=="business" else "id"
        field="sample_opportunities" if source=="business" else "sample_items"
        oldids={i.get(key) for i in old.get(field,[]) if isinstance(i,dict)}
        newids={i.get(key) for i in new.get(field,[]) if isinstance(i,dict)}
        oldids.discard(None);newids.discard(None)
        if not oldids or not newids: continue
        union=oldids|newids
        results[source]={"research_kind":"public_search_sample_overlap_not_business_or_audience_performance",
                         "prior_count":len(oldids),"current_count":len(newids),
                         "stable_items":len(oldids&newids),"sample_jaccard":round(len(oldids&newids)/len(union),5),
                         "provenance_previous":a.get("source_response_sha256"),
                         "provenance_current":b.get("source_response_sha256")}
    return results
