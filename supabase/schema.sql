-- =========================================================
-- Moa · Supabase 설정 (1단계: 진짜 로그인 + 내 프로필 저장 + 가입자 수)
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 안전해요.
-- =========================================================

-- 1) 내 프로필 테이블 (계정 1개당 1줄)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null default '',
  age         int check (age is null or age between 19 and 60),
  height      int check (height is null or height between 140 and 220),
  bio         text not null default '' check (char_length(bio) <= 200),
  tagline     text not null default '' check (char_length(tagline) <= 24),
  gender      text,
  personality text[] not null default '{}',
  hobbies     text[] not null default '{}',
  music       text[] not null default '{}',
  travel      text,
  styles      text[] not null default '{}',
  religion    text,
  income      text,
  prefs       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) 보안 규칙: 내 프로필은 나만 읽고 쓸 수 있어요 (다른 가입자·비로그인 방문자는 못 봐요)
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: delete own" on public.profiles;

create policy "profiles: read own"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles: delete own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

revoke all on public.profiles from anon;

-- 3) 가입하면 프로필 줄을 자동으로 만들어요 (닉네임만 채운 상태)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'nickname', ''), 12))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) 현재 가입자 수 — 숫자 하나만 돌려줘요 (누가 가입했는지는 알 수 없어요)
--    이메일 인증을 켠 경우, 인증을 마친 사람만 세요.
create or replace function public.member_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from auth.users
  where email_confirmed_at is not null
    and deleted_at is null;
$$;

revoke all on function public.member_count() from public;
grant execute on function public.member_count() to anon, authenticated;

-- 5) 회원 탈퇴 — 로그인한 본인 계정만 지워요 (프로필도 함께 지워져요)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
