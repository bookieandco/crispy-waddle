"""Vercel OIDC verification for the Director speaker-QC worker.

The trusted identity is pinned to the production Jhadina Vercel project. A
static worker token remains supported as a manual fallback, but production can
operate without copying a long-lived bearer secret into Vercel or SWLC.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient

ALLOWED_ISSUERS={
    "https://oidc.vercel.com/bookieandcos-projects",
    "https://oidc.vercel.com",
}
AUDIENCE="https://vercel.com/bookieandcos-projects"
SUBJECT="owner:bookieandcos-projects:project:crispy-waddle-jhadina-web:environment:production"
OWNER="bookieandcos-projects"
OWNER_ID="team_NYQJ3NwijZZ6UJQdOdc5FjmX"
PROJECT="crispy-waddle-jhadina-web"
PROJECT_ID="prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco"
ENVIRONMENT="production"
MAX_TOKEN_BYTES=16*1024

@lru_cache(maxsize=4)
def _jwks(issuer:str)->PyJWKClient:
    return PyJWKClient(
        issuer.rstrip("/")+"/.well-known/jwks",
        cache_keys=True,
        lifespan=3600,
        timeout=10,
    )

def claims_are_trusted(claims:dict[str,Any])->bool:
    return (
        claims.get("sub")==SUBJECT
        and claims.get("owner")==OWNER
        and claims.get("owner_id")==OWNER_ID
        and claims.get("project")==PROJECT
        and claims.get("project_id")==PROJECT_ID
        and claims.get("environment")==ENVIRONMENT
    )

def authorize_vercel_token(token:str)->bool:
    if not token or len(token.encode("utf-8"))>MAX_TOKEN_BYTES:
        return False
    try:
        unverified=jwt.decode(
            token,
            options={
                "verify_signature":False,
                "verify_aud":False,
                "verify_exp":False,
                "verify_nbf":False,
            },
            algorithms=["RS256"],
        )
    except Exception:
        return False
    issuer=unverified.get("iss") if isinstance(unverified,dict) else None
    if not isinstance(issuer,str) or issuer not in ALLOWED_ISSUERS:
        return False
    try:
        signing_key=_jwks(issuer).get_signing_key_from_jwt(token).key
        verified=jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=AUDIENCE,
            issuer=issuer,
            options={"require":["exp","iat","iss","sub"]},
        )
    except Exception:
        return False
    return isinstance(verified,dict) and claims_are_trusted(verified)
