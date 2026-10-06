# Fieldnotes — Private Blog

Authenticated-only blog (articles, not products). Readers must log in;
only admins can publish from the dashboard. Any member can comment and
react (like/fire); admins moderate comments (pin/delete). Passwords are
owned by Supabase Auth (bcrypt hashing); the Python API never stores
credentials.

## Stack
- Backend: FastAPI (`backend/`)
- DB + Auth: Supabase (Postgres + Auth + Storage)
- Frontend: plain HTML/CSS/JS, files separated (`frontend/`)

## Setup
1. Create a Supabase project, run in the SQL editor in order:
   `supabase/schema.sql`, `supabase/migration_002_images_pin.sql`,
   `supabase/migration_003_comments.sql`.
2. Backend env:
   ```
   cd blog-portfolio/backend
   uv venv
   uv pip install -r requirements.txt
   cp .env.example .env
   ```
   Fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Seed first admin:
   ```
   uv run python seed_admin.py admin@example.com StrongPassword123!
   ```
4. Run API:
   ```
   uv run uvicorn app:app --port 8000
   ```
5. Copy `frontend/config.example.js` to `frontend/config.js` and fill in
   your Supabase URL/anon key + API base (`config.js` is git-ignored).
   Serve `frontend/` on the `FRONTEND_ORIGIN` port
   (e.g. `python -m http.server 5500 --bind 127.0.0.1`),
   open `index.html`, sign in.

## Pages
- `index.html` — reader: article list, article detail, comments
- `user.html` — member dashboard: profile + reputation + my comments
- `dashboard.html` — admin console: publish with cover image, pin articles

## Routes
- `GET /`, `GET /health`, `GET /docs`
- `GET /api/me` — session profile (auth required)
- `GET /api/me/activity` — my comments + reputation (auth required)
- `GET /api/articles`, `GET /api/articles/{slug}` — auth required
- `POST /api/articles` — admin only
- `PATCH /api/articles/{id}/pin` — admin only
- `GET /api/articles/{slug}/comments` — auth required
- `POST /api/articles/{slug}/comments` — auth required
- `DELETE /api/comments/{id}` — admin only
- `PATCH /api/comments/{id}/pin` — admin only
- `POST /api/comments/{id}/reactions` — toggle like (auth required) / fire (admin only)

## Comment ranking
Pinned first, then hot score `(likes + 5 × fires) / (age_hours + 2)^1.2`,
then newest. Reactions raise visibility (fires are admin-only and count ×5);
age decays it.
