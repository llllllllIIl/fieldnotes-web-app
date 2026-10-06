-- 003: comments + reactions. run after 002.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_email text,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_article_idx on public.comments(article_id);

create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('like', 'fire')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, kind)
);

create index if not exists comment_reactions_comment_idx
  on public.comment_reactions(comment_id);

alter table public.comments enable row level security;
alter table public.comment_reactions enable row level security;

-- same pattern as articles: auth reads, no direct writes
drop policy if exists "comments_auth_read" on public.comments;
create policy "comments_auth_read" on public.comments
  for select to authenticated using (true);

drop policy if exists "comments_no_direct_write" on public.comments;
create policy "comments_no_direct_write" on public.comments
  for insert to authenticated with check (false);

drop policy if exists "comment_reactions_auth_read" on public.comment_reactions;
create policy "comment_reactions_auth_read" on public.comment_reactions
  for select to authenticated using (true);

drop policy if exists "comment_reactions_no_direct_write" on public.comment_reactions;
create policy "comment_reactions_no_direct_write" on public.comment_reactions
  for insert to authenticated with check (false);
