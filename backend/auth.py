"""Supabase JWT check + profile/admin lookup. No passwords here, ever."""
import os

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_auth_scheme = HTTPBearer(auto_error=False)

_admin_client = None
_public_client = None


def first_row(data):
    """First row of a list/dict/None payload. Stands in for .single()."""
    if isinstance(data, list):
        return data[0] if data else None
    return data


def get_service_client():
    global _admin_client
    if _admin_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
        _admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _admin_client


def get_public_client():
    global _public_client
    if _public_client is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError("Missing SUPABASE_URL / SUPABASE_ANON_KEY")
        _public_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _public_client


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_auth_scheme),
):
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = creds.credentials
    try:
        client = get_public_client()
        user_resp = client.auth.get_user(token)
        user = user_resp.user
        if user is None:
            raise ValueError("invalid token")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    profile = None
    try:
        svc = get_service_client()
        res = (
            svc.table("profiles")
            .select("id,email,is_admin,created_at")
            .eq("id", user.id)
            .limit(1)
            .execute()
        )
        profile = first_row(res.data)
    except Exception:
        profile = None

    return {
        "id": user.id,
        "email": user.email,
        "is_admin": bool(profile and profile.get("is_admin")),
        "member_since": (profile or {}).get("created_at"),
    }


async def require_admin(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
