-- Run in Supabase SQL editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_email text,
  title text not null,
  slug text not null unique,
  excerpt text not null,
  content text not null,
  tags text[] not null default '{}',
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.articles enable row level security;

drop policy if exists "profiles_owner_read" on public.profiles;
create policy "profiles_owner_read" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "articles_auth_read" on public.articles;
create policy "articles_auth_read" on public.articles
  for select to authenticated using (true);

-- writes via api only
drop policy if exists "articles_no_direct_write" on public.articles;
create policy "articles_no_direct_write" on public.articles
  for insert to authenticated with check (false);

-- reader profile on signup, never admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
