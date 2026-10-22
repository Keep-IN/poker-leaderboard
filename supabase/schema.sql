-- =====================================================================
-- Poker Leaderboard — Supabase schema
-- Jalankan sekali di Supabase Dashboard → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  role        text not null default 'player' check (role in ('player', 'dealer')),
  created_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 60),
  dealer_id    uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'open'
               check (status in ('open', 'ongoing', 'finished', 'cancelled')),
  max_players  int  not null default 8 check (max_players between 2 and 8),
  winner_id    uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

create index if not exists matches_status_idx      on public.matches (status);
create index if not exists matches_finished_at_idx on public.matches (finished_at);
create index if not exists matches_dealer_idx      on public.matches (dealer_id);

create table if not exists public.match_players (
  match_id       uuid not null references public.matches (id) on delete cascade,
  player_id      uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'playing'
                 check (status in ('playing', 'eliminated', 'winner')),
  joined_at      timestamptz not null default now(),
  eliminated_at  timestamptz,
  primary key (match_id, player_id)
);

create index if not exists match_players_player_idx on public.match_players (player_id);

-- Realtime DELETE events carry the full old row (needed to know which match changed).
alter table public.match_players replica identity full;

-- ---------- Auto-create profile on sign-up -----------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 40)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security -----------------------------------------
-- Semua user yang login boleh MEMBACA. Semua perubahan hanya lewat RPC di bawah.

alter table public.profiles      enable row level security;
alter table public.matches       enable row level security;
alter table public.match_players enable row level security;

drop policy if exists "profiles readable"      on public.profiles;
drop policy if exists "matches readable"       on public.matches;
drop policy if exists "match_players readable" on public.match_players;

create policy "profiles readable"      on public.profiles      for select to authenticated using (true);
create policy "matches readable"       on public.matches       for select to authenticated using (true);
create policy "match_players readable" on public.match_players for select to authenticated using (true);

-- ---------- Helpers ----------------------------------------------------

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Lock the match row and make sure the caller is its dealer.
create or replace function public.lock_own_match(p_match uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
begin
  select * into m from public.matches where id = p_match for update;
  if not found then
    raise exception 'Match tidak ditemukan';
  end if;
  if m.dealer_id <> auth.uid() then
    raise exception 'Hanya dealer match ini yang bisa melakukan aksi ini';
  end if;
  return m;
end;
$$;

-- ---------- Dealer RPCs ------------------------------------------------

create or replace function public.create_match(p_title text, p_max_players int default 8)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if public.current_role_name() is distinct from 'dealer' then
    raise exception 'Hanya akun dealer yang bisa membuat match';
  end if;
  if p_max_players < 2 or p_max_players > 8 then
    raise exception 'Jumlah player harus 2 sampai 8';
  end if;

  insert into public.matches (title, dealer_id, max_players)
  values (trim(p_title), auth.uid(), p_max_players)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.start_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches := public.lock_own_match(p_match);
begin
  if m.status <> 'open' then
    raise exception 'Match ini tidak bisa dimulai';
  end if;
  if (select count(*) from public.match_players where match_id = p_match) < 2 then
    raise exception 'Butuh minimal 2 player untuk memulai';
  end if;
  update public.matches set status = 'ongoing', started_at = now() where id = p_match;
end;
$$;

create or replace function public.kick_player(p_match uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches := public.lock_own_match(p_match);
begin
  if m.status <> 'open' then
    raise exception 'Player hanya bisa dikeluarkan sebelum match dimulai';
  end if;
  delete from public.match_players where match_id = p_match and player_id = p_player;
end;
$$;

create or replace function public.eliminate_player(p_match uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches := public.lock_own_match(p_match);
begin
  if m.status <> 'ongoing' then
    raise exception 'Match belum/tidak sedang berlangsung';
  end if;
  update public.match_players
     set status = 'eliminated', eliminated_at = now()
   where match_id = p_match and player_id = p_player and status = 'playing';
  if not found then
    raise exception 'Player tidak sedang bermain di match ini';
  end if;
end;
$$;

create or replace function public.revive_player(p_match uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches := public.lock_own_match(p_match);
begin
  if m.status <> 'ongoing' then
    raise exception 'Match belum/tidak sedang berlangsung';
  end if;
  update public.match_players
     set status = 'playing', eliminated_at = null
   where match_id = p_match and player_id = p_player and status = 'eliminated';
end;
$$;

create or replace function public.declare_winner(p_match uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches := public.lock_own_match(p_match);
begin
  if m.status <> 'ongoing' then
    raise exception 'Match belum/tidak sedang berlangsung';
  end if;
  if not exists (select 1 from public.match_players where match_id = p_match and player_id = p_player) then
    raise exception 'Player bukan peserta match ini';
  end if;

  update public.match_players
     set status = 'eliminated', eliminated_at = coalesce(eliminated_at, now())
   where match_id = p_match and player_id <> p_player;
  update public.match_players
     set status = 'winner', eliminated_at = null
   where match_id = p_match and player_id = p_player;
  update public.matches
     set status = 'finished', winner_id = p_player, finished_at = now()
   where id = p_match;
end;
$$;

create or replace function public.cancel_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches := public.lock_own_match(p_match);
begin
  if m.status not in ('open', 'ongoing') then
    raise exception 'Match ini sudah selesai';
  end if;
  update public.matches set status = 'cancelled', finished_at = now() where id = p_match;
end;
$$;

-- ---------- Player RPCs ------------------------------------------------

create or replace function public.join_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
begin
  if public.current_role_name() is distinct from 'player' then
    raise exception 'Hanya akun player yang bisa join match';
  end if;

  select * into m from public.matches where id = p_match for update;
  if not found then
    raise exception 'Match tidak ditemukan';
  end if;
  if m.status <> 'open' then
    raise exception 'Match sudah dimulai atau selesai';
  end if;
  if exists (select 1 from public.match_players where match_id = p_match and player_id = auth.uid()) then
    return;
  end if;
  if (select count(*) from public.match_players where match_id = p_match) >= m.max_players then
    raise exception 'Match sudah penuh (maks % player)', m.max_players;
  end if;

  insert into public.match_players (match_id, player_id) values (p_match, auth.uid());
end;
$$;

create or replace function public.leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.matches where id = p_match and status = 'open') then
    raise exception 'Tidak bisa keluar setelah match dimulai';
  end if;
  delete from public.match_players where match_id = p_match and player_id = auth.uid();
end;
$$;

-- ---------- Leaderboard ------------------------------------------------
-- p_from / p_to null = all time.

create or replace function public.get_leaderboard(p_from timestamptz default null, p_to timestamptz default null)
returns table (player_id uuid, name text, wins bigint, played bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name,
         count(*) filter (where mp.status = 'winner') as wins,
         count(*) as played
    from public.match_players mp
    join public.matches  m on m.id = mp.match_id
    join public.profiles p on p.id = mp.player_id
   where m.status = 'finished'
     and (p_from is null or m.finished_at >= p_from)
     and (p_to   is null or m.finished_at <  p_to)
     and auth.uid() is not null
   group by p.id, p.name
  having count(*) filter (where mp.status = 'winner') > 0
   order by wins desc, played asc, p.name asc;
$$;

-- Semua akun player (termasuk yang belum pernah main) beserta statistiknya.
create or replace function public.get_player_stats()
returns table (player_id uuid, name text, played bigint, wins bigint, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name,
         count(m.id) as played,
         count(m.id) filter (where mp.status = 'winner') as wins,
         p.created_at
    from public.profiles p
    left join public.match_players mp on mp.player_id = p.id
    left join public.matches m on m.id = mp.match_id and m.status = 'finished'
   where p.role = 'player'
     and auth.uid() is not null
   group by p.id, p.name, p.created_at
   order by wins desc, played desc, p.name asc;
$$;

-- ---------- Grants -----------------------------------------------------

revoke all on function public.lock_own_match(uuid) from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_match(text, int)',
    'public.start_match(uuid)',
    'public.kick_player(uuid, uuid)',
    'public.eliminate_player(uuid, uuid)',
    'public.revive_player(uuid, uuid)',
    'public.declare_winner(uuid, uuid)',
    'public.cancel_match(uuid)',
    'public.join_match(uuid)',
    'public.leave_match(uuid)',
    'public.get_leaderboard(timestamptz, timestamptz)',
    'public.get_player_stats()',
    'public.current_role_name()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- ---------- Realtime ---------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.matches;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.match_players;
  exception when duplicate_object then null;
  end;
end;
$$;

-- ---------- Jadikan user sebagai dealer --------------------------------
-- Daftar dulu lewat website, lalu jalankan (ganti emailnya):
--
--   update public.profiles set role = 'dealer'
--    where id = (select id from auth.users where email = 'dealer@contoh.com');
