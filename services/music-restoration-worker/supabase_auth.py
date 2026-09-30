"""Supabase user-session authentication for Music restoration compute.

This is a secretless interactive fallback when project-level Vercel OIDC is not
available. The publishable key is intentionally public; the bearer token is a
short-lived user session token and is verified by Supabase Auth itself.
"""
from __future__ import annotations

import json
import re
from typing import Any
import urllib.error
import urllib.request
from uuid import UUID

import jwt

SUPABASE_URL="https://kqbkaozfjubkjevdfvic.supabase.co"
SUPABASE_ISSUER=SUPABASE_URL+"/auth/v1"
SUPABASE_USER_URL=SUPABASE_URL+"/auth/v1/user"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_FVcYgRA8XOS5ZvePFgU4GQ_vdWTTvA7"
MAX_TOKEN_BYTES=16*1024
_USER_ID=re.compile(r"^[0-9a-fA-F-]{36}$")

def _valid_uuid(value:object)->bool:
    if not isinstance(value,str) or not _USER_ID.fullmatch(value):
        return False
    try:
        UUID(value)
        return True
    except ValueError:
        return False

def _audience_contains_authenticated(value:object)->bool:
    if isinstance(value,str):
        return value=="authenticated"
    if isinstance(value,list):
        return "authenticated" in value
    return False

def _candidate_claims(token:str)->dict[str,Any]|None:
    if not token or len(token.encode("utf-8"))>MAX_TOKEN_BYTES:
        return None
    try:
        claims=jwt.decode(
            token,
            options={
                "verify_signature":False,
                "verify_aud":False,
                "verify_exp":False,
                "verify_nbf":False,
            },
            algorithms=["HS256","ES256","RS256"],
        )
    except Exception:
        return None
    if not isinstance(claims,dict):
        return None
    if claims.get("iss")!=SUPABASE_ISSUER:
        return None
    if claims.get("role")!="authenticated":
        return None
    if not _audience_contains_authenticated(claims.get("aud")):
        return None
    if not _valid_uuid(claims.get("sub")):
        return None
    return claims

def authorize_supabase_user(token:str,expected_user_id:str|None)->dict[str,Any]|None:
    if expected_user_id is None or not _valid_uuid(expected_user_id):
        return None
    claims=_candidate_claims(token)
    if claims is None:
        return None
    subject=str(claims["sub"])
    if subject!=expected_user_id:
        return None

    request=urllib.request.Request(
        SUPABASE_USER_URL,
        method="GET",
        headers={
            "Authorization":f"Bearer {token}",
            "apikey":SUPABASE_PUBLISHABLE_KEY,
            "Accept":"application/json",
            "User-Agent":"jhadina-music-restoration/1",
        },
    )
    try:
        with urllib.request.urlopen(request,timeout=10) as response:
            if response.status!=200:
                return None
            payload=json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,ValueError,json.JSONDecodeError):
        return None

    if not isinstance(payload,dict):
        return None
    user_id=payload.get("id")
    if user_id!=subject or not _valid_uuid(user_id):
        return None
    if payload.get("is_anonymous") is True:
        return None
    return {
        "authMode":"supabase-session",
        "userId":user_id,
        "sessionId":claims.get("session_id"),
        "aal":claims.get("aal"),
    }
