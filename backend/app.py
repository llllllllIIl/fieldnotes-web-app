"""Private blog API. Login to read, admins publish. No HTML here."""
import os
import re
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import first_row, get_current_user, get_service_client, require_admin

load_dotenv()

FRONTEND_ORIGINS = [o.strip() for o in os.environ.get("FRONTEND_ORIGIN", "http://127.0.0.1:5500,http://localhost:5500").split(",") if o.strip()]

app = FastAPI(title="Private Blog API", version="1.2.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


class ArticleIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    excerpt: str = Field(min_length=10, max_length=300)
    content: str = Field(min_length=50)
    tags: list[str] = Field(default_factory=list)
    image_url: str | None = Field(default=None, max_length=2048)
    pinned: bool = False


class PinIn(BaseModel):
    pinned: bool


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CommentPinIn(BaseModel):
    pinned: bool


class ReactionIn(BaseModel):
    kind: str = Field(pattern="^(like|fire)$")


def slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug[:80] or "article"


def hot_score(likes: int, fires: int, created_at) -> float:
    """(likes + 5 * fires) / (age_hours + 2) ^ 1.2"""
    try:
        dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except Exception:
        dt = datetime.now(timezone.utc)
    age_h = max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 3600.0)
    return (likes + 5 * fires) / ((age_h + 2.0) ** 1.2)


def rank_comments(items: list) -> list:
    """Pinned first, then hot score, then newest. Adds 'score' to each item."""
    for c in items:
        c["score"] = round(
            hot_score(c.get("like_count", 0), c.get("fire_count", 0), c.get("created_at")),
            4,
        )
    # stable sorts, last one wins
    items.sort(key=lambda c: c.get("created_at", ""), reverse=True)
    items.sort(key=lambda c: c["score"], reverse=True)
    items.sort(key=lambda c: not c.get("pinned"))
    return items


def article_or_404(svc, slug: str) -> dict:
    res = (
        svc.table("articles")
        .select("id,title,slug")
        .eq("slug", slug)
        .eq("published", True)
        .limit(1)
        .execute()
    )
    row = first_row(res.data)
    if not row:
        raise HTTPException(status_code=404, detail="Article not found")
    return row


@app.get("/")
def root():
    return {"name": "Private Blog API", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/me")
def me(user: dict = Depends(get_current_user)):
    return user


@app.get("/api/me/activity")
def my_activity(user: dict = Depends(get_current_user)):
    svc = get_service_client()
    mine = (
        svc.table("comments")
        .select("id,article_id,body,created_at")
        .eq("author_id", user["id"])
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    items = mine.data or []
    if items:
        aids = list({c["article_id"] for c in items})
        arts = svc.table("articles").select("id,title,slug").in_("id", aids).execute()
        by_id = {a["id"]: a for a in arts.data or []}
        for c in items:
            a = by_id.get(c["article_id"], {})
            c["article_title"] = a.get("title", "?")
            c["article_slug"] = a.get("slug", "")
    all_ids_res = svc.table("comments").select("id").eq("author_id", user["id"]).execute()
    all_ids = [c["id"] for c in all_ids_res.data or []]
    likes = fires = 0
    if all_ids:
        rr = svc.table("comment_reactions").select("kind").in_("comment_id", all_ids).execute()
        for r in rr.data or []:
            if r["kind"] == "like":
                likes += 1
            elif r["kind"] == "fire":
                fires += 1
    return {
        "comments": items,
        "total_comments": len(all_ids),
        "likes_received": likes,
        "fires_received": fires,
    }


@app.get("/api/articles")
def list_articles(user: dict = Depends(get_current_user)):
    svc = get_service_client()
    res = (
        svc.table("articles")
        .select(
            "id,title,slug,excerpt,tags,image_url,pinned,"
            "created_at,author_email"
        )
        .eq("published", True)
        .order("pinned", desc=True)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    items = res.data or []
    counts: dict[str, int] = {}
    if items:
        try:
            ids = [a["id"] for a in items]
            cres = svc.table("comments").select("article_id").in_("article_id", ids).execute()
            for r in cres.data or []:
                counts[r["article_id"]] = counts.get(r["article_id"], 0) + 1
        except Exception:
            counts = {}
    for a in items:
        a["comment_count"] = counts.get(a["id"], 0)
    return {"items": items}


@app.get("/api/articles/{slug}")
def get_article(slug: str, user: dict = Depends(get_current_user)):
    svc = get_service_client()
    res = (
        svc.table("articles")
        .select("*")
        .eq("slug", slug)
        .eq("published", True)
        .limit(1)
        .execute()
    )
    row = first_row(res.data)
    if not row:
        raise HTTPException(status_code=404, detail="Article not found")
    return row


@app.post("/api/articles", status_code=status.HTTP_201_CREATED)
def create_article(payload: ArticleIn, admin: dict = Depends(require_admin)):
    svc = get_service_client()
    base = slugify(payload.title)
    slug = base
    # slug + timestamp on conflict
    existing = svc.table("articles").select("id").eq("slug", slug).execute()
    if existing.data:
        suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
        slug = f"{base}-{suffix}"

    row = {
        "title": payload.title.strip(),
        "slug": slug,
        "excerpt": payload.excerpt.strip(),
        "content": payload.content,
        "tags": payload.tags[:8],
        "image_url": (payload.image_url or "").strip() or None,
        "pinned": payload.pinned,
        "author_id": admin["id"],
        "author_email": admin.get("email"),
        "published": True,
    }
    res = svc.table("articles").insert(row).select().execute()
    created = first_row(res.data)
    if not created:
        raise HTTPException(status_code=500, detail="Could not create article")
    return created


@app.patch("/api/articles/{article_id}/pin")
def set_pinned(
    article_id: str, payload: PinIn, admin: dict = Depends(require_admin)
):
    svc = get_service_client()
    res = (
        svc.table("articles")
        .update({"pinned": payload.pinned})
        .eq("id", article_id)
        .select("id,pinned")
        .execute()
    )
    row = first_row(res.data)
    if not row:
        raise HTTPException(status_code=404, detail="Article not found")
    return row


@app.get("/api/articles/{slug}/comments")
def list_comments(slug: str, user: dict = Depends(get_current_user)):
    svc = get_service_client()
    art = article_or_404(svc, slug)
    res = (
        svc.table("comments")
        .select("id,article_id,author_id,author_email,body,pinned,created_at")
        .eq("article_id", art["id"])
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    items = res.data or []
    if not items:
        return {"items": []}
    ids = [c["id"] for c in items]
    rres = (
        svc.table("comment_reactions")
        .select("comment_id,user_id,kind")
        .in_("comment_id", ids)
        .execute()
    )
    likes: dict[str, int] = {}
    fires: dict[str, int] = {}
    mine: dict[str, set] = {}
    for r in rres.data or []:
        cid = r["comment_id"]
        if r["kind"] == "like":
            likes[cid] = likes.get(cid, 0) + 1
        elif r["kind"] == "fire":
            fires[cid] = fires.get(cid, 0) + 1
        if r["user_id"] == user["id"]:
            mine.setdefault(cid, set()).add(r["kind"])
    for c in items:
        lc = likes.get(c["id"], 0)
        fc = fires.get(c["id"], 0)
        c["like_count"] = lc
        c["fire_count"] = fc
        c["liked"] = "like" in mine.get(c["id"], set())
        c["fired"] = "fire" in mine.get(c["id"], set())
    return {"items": rank_comments(items)}


@app.post("/api/articles/{slug}/comments", status_code=status.HTTP_201_CREATED)
def create_comment(
    slug: str, payload: CommentIn, user: dict = Depends(get_current_user)
):
    svc = get_service_client()
    art = article_or_404(svc, slug)
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment is empty")
    row = {
        "article_id": art["id"],
        "author_id": user["id"],
        "author_email": user.get("email"),
        "body": body,
        "pinned": False,
    }
    res = svc.table("comments").insert(row).select().execute()
    created = first_row(res.data)
    if not created:
        raise HTTPException(status_code=500, detail="Could not save comment")
    created["like_count"] = 0
    created["fire_count"] = 0
    return created


@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: str, admin: dict = Depends(require_admin)):
    svc = get_service_client()
    res = svc.table("comments").delete().eq("id", comment_id).select("id").execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"ok": True}


@app.patch("/api/comments/{comment_id}/pin")
def pin_comment(
    comment_id: str, payload: CommentPinIn, admin: dict = Depends(require_admin)
):
    svc = get_service_client()
    res = (
        svc.table("comments")
        .update({"pinned": payload.pinned})
        .eq("id", comment_id)
        .select("id,pinned")
        .execute()
    )
    row = first_row(res.data)
    if not row:
        raise HTTPException(status_code=404, detail="Comment not found")
    return row


@app.post("/api/comments/{comment_id}/reactions")
def toggle_reaction(
    comment_id: str, payload: ReactionIn, user: dict = Depends(get_current_user)
):
    """Toggle like/fire. Fire is admin-only."""
    if payload.kind == "fire" and not user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can give fire",
        )
    svc = get_service_client()
    chk = svc.table("comments").select("id").eq("id", comment_id).execute()
    if not chk.data:
        raise HTTPException(status_code=404, detail="Comment not found")
    existing = (
        svc.table("comment_reactions")
        .select("id")
        .eq("comment_id", comment_id)
        .eq("user_id", user["id"])
        .eq("kind", payload.kind)
        .execute()
    )
    if existing.data:
        svc.table("comment_reactions").delete().eq("id", existing.data[0]["id"]).execute()
        active = False
    else:
        svc.table("comment_reactions").insert(
            {"comment_id": comment_id, "user_id": user["id"], "kind": payload.kind}
        ).execute()
        active = True
    all_r = (
        svc.table("comment_reactions")
        .select("user_id,kind")
        .eq("comment_id", comment_id)
        .execute()
    )
    data = all_r.data or []
    return {
        "active": active,
        "kind": payload.kind,
        "like_count": sum(1 for r in data if r["kind"] == "like"),
        "fire_count": sum(1 for r in data if r["kind"] == "fire"),
        "liked": any(r["kind"] == "like" and r["user_id"] == user["id"] for r in data),
        "fired": any(r["kind"] == "fire" and r["user_id"] == user["id"] for r in data),
    }
