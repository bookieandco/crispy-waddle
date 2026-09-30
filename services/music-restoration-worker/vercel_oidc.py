"""Vercel OIDC verification for the private Music restoration worker."""
from __future__ import annotations

from functools import lru_cache
import os
import re
from typing import Any

import jwt
from jwt import PyJWKClient

_OWNER_RE=re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

def _required(name:str)->str:
    value=os.getenv(name,"").strip()
    if not value:
        raise RuntimeError(f"{name}_REQUIRED")
    return value

def _issuer_for(owner:str,token_issuer:str)->str:
    legacy="https://oidc.vercel.com"
    team=f"{legacy}/{owner}"
    if token_issuer not in {legacy,team}:
        raise ValueError("MUSIC_RESTORATION_VERCEL_OIDC_ISSUER_NOT_ADMITTED")
    return token_issuer

@lru_cache(maxsize=4)
def _jwks_client(issuer:str)->PyJWKClient:
    return PyJWKClient(f"{issuer}/.well-known/jwks",cache_keys=True)

def verify_vercel_oidc(token:str)->dict[str,Any]:
    owner=_required("MUSIC_RESTORATION_VERCEL_OWNER")
    owner_id=_required("MUSIC_RESTORATION_VERCEL_OWNER_ID")
    project_id=_required("MUSIC_RESTORATION_VERCEL_PROJECT_ID")
    environment=os.getenv("MUSIC_RESTORATION_VERCEL_ENVIRONMENT","production").strip() or "production"
    audience=os.getenv("MUSIC_RESTORATION_VERCEL_AUDIENCE",f"https://vercel.com/{owner}").strip()

    if not _OWNER_RE.fullmatch(owner):
        raise RuntimeError("MUSIC_RESTORATION_VERCEL_OWNER_INVALID")
    if environment not in {"production","preview","development"}:
        raise RuntimeError("MUSIC_RESTORATION_VERCEL_ENVIRONMENT_INVALID")
    if not token:
        raise ValueError("MUSIC_RESTORATION_VERCEL_OIDC_TOKEN_REQUIRED")

    unverified=jwt.decode(
        token,
        options={"verify_signature":False,"verify_aud":False,"verify_exp":False},
        algorithms=["RS256"],
    )
    issuer=_issuer_for(owner,str(unverified.get("iss") or ""))
    signing_key=_jwks_client(issuer).get_signing_key_from_jwt(token)
    claims=jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=issuer,
        audience=audience,
        options={"require":["exp","iat","sub","iss","aud"]},
        leeway=15,
    )

    if claims.get("owner")!=owner:
        raise ValueError("MUSIC_RESTORATION_VERCEL_OWNER_MISMATCH")
    if claims.get("owner_id")!=owner_id:
        raise ValueError("MUSIC_RESTORATION_VERCEL_OWNER_ID_MISMATCH")
    if claims.get("project_id")!=project_id:
        raise ValueError("MUSIC_RESTORATION_VERCEL_PROJECT_ID_MISMATCH")
    if claims.get("environment")!=environment:
        raise ValueError("MUSIC_RESTORATION_VERCEL_ENVIRONMENT_MISMATCH")
    return claims
