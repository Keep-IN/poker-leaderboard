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
  max_players  int  not null default 8 check (max_players between 3 and 8),
  winner_id    uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

-- Minimal 3 pemain per match supaya poin tidak bisa dieksploitasi lewat match 1 lawan 1.
-- (Untuk database lama: ganti batas bawah constraint dari 2 ke 3.)
alter table public.matches drop constraint if exists matches_max_players_check;
alter table public.matches add constraint matches_max_players_check check (max_players between 3 and 8);

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

-- Peringkat akhir (1 = pemenang, 2 = runner-up 1, ...) diisi saat match selesai.
-- Poin dihitung otomatis dari peringkat: juara 10, runner-up 1 dapat 5, runner-up 2 dapat 1, sisanya 0.
alter table public.match_players add column if not exists placement int check (placement >= 1);
alter table public.match_players add column if not exists points int
  generated always as (case placement when 1 then 10 when 2 then 5 when 3 then 1 else 0 end) stored;

-- Poin di luar hasil match, mis. biaya player membuat match (-1). Total poin = poin match + penyesuaian ini.
create table if not exists public.point_adjustments (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.profiles (id) on delete cascade,
  amount      int  not null,
  reason      text not null check (reason in ('create_match')),
  match_id    uuid references public.matches (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists point_adjustments_player_idx on public.point_adjustments (player_id);

-- false = hanya mengurangi total poin (dipakai saat poin bulan itu masih 0), jadi poin bulanan tidak pernah minus.
alter table public.point_adjustments add column if not exists counts_monthly boolean not null default true;

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
alter table public.point_adjustments enable row level security;

drop policy if exists "profiles readable"      on public.profiles;
drop policy if exists "matches readable"       on public.matches;
drop policy if exists "match_players readable" on public.match_players;
drop policy if exists "point_adjustments readable" on public.point_adjustments;

create policy "profiles readable"      on public.profiles      for select to authenticated using (true);
create policy "matches readable"       on public.matches       for select to authenticated using (true);
create policy "match_players readable" on public.match_players for select to authenticated using (true);
create policy "point_adjustments readable" on public.point_adjustments for select to authenticated using (true);

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
    raise exception 'Hanya host match ini yang bisa melakukan aksi ini';
  end if;
  return m;
end;
$$;

-- Total poin seorang player: poin dari match selesai + penyesuaian (biaya membuat match, dll).
create or replace function public.points_balance(p_player uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select sum(mp.points)
                     from public.match_players mp
                     join public.matches m on m.id = mp.match_id
                    where mp.player_id = p_player and m.status = 'finished'), 0)
       + coalesce((select sum(amount) from public.point_adjustments where player_id = p_player), 0);
$$;

-- Poin seorang player di bulan berjalan (WIB), dengan aturan yang sama seperti leaderboard bulanan.
create or replace function public.month_points_balance(p_player uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta' as month_start
  )
  select coalesce((select sum(mp.points)
                     from public.match_players mp
                     join public.matches m on m.id = mp.match_id, bounds
                    where mp.player_id = p_player and m.status = 'finished' and m.finished_at >= bounds.month_start), 0)
       + coalesce((select sum(a.amount)
                     from public.point_adjustments a, bounds
                    where a.player_id = p_player and a.counts_monthly and a.created_at >= bounds.month_start), 0);
$$;

create or replace function public.get_my_points()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select public.points_balance(auth.uid()) where auth.uid() is not null;
$$;

-- ---------- Host RPCs (dealer, atau player dengan biaya poin) -----------

create or replace function public.match_creation_cost()
returns int
language sql
immutable
as $$ select 1 $$;

create or replace function public.create_match(p_title text, p_max_players int default 8)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  my_role text;
begin
  -- Kunci baris profil supaya dua request bersamaan tidak sama-sama lolos cek saldo.
  select role into my_role from public.profiles where id = auth.uid() for update;
  if my_role is null then
    raise exception 'Akun tidak ditemukan';
  end if;
  if p_max_players < 3 or p_max_players > 8 then
    raise exception 'Jumlah player harus 3 sampai 8';
  end if;
  if my_role = 'player' and public.points_balance(auth.uid()) < public.match_creation_cost() then
    raise exception 'Poin kamu belum cukup untuk membuat match (butuh % poin)', public.match_creation_cost();
  end if;

  insert into public.matches (title, dealer_id, max_players)
  values (trim(p_title), auth.uid(), p_max_players)
  returning id into new_id;

  if my_role = 'player' then
    -- Kalau poin bulan ini belum cukup (mis. awal bulan), biaya hanya diambil dari total poin.
    insert into public.point_adjustments (player_id, amount, reason, match_id, counts_monthly)
    values (auth.uid(), -public.match_creation_cost(), 'create_match', new_id,
            public.month_points_balance(auth.uid()) >= public.match_creation_cost());
  end if;
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
  if (select count(*) from public.match_players where match_id = p_match) < 3 then
    raise exception 'Butuh minimal 3 player untuk memulai';
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

-- Pemenang peringkat 1, lalu yang kalah paling akhir peringkat 2, dst.
create or replace function public.set_placements(p_match uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.match_players mp
     set placement = r.rn
    from (
      select player_id,
             row_number() over (order by (status = 'winner') desc, eliminated_at desc nulls last, joined_at) as rn
        from public.match_players
       where match_id = p_match
    ) r
   where mp.match_id = p_match and mp.player_id = r.player_id;
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
  if not exists (select 1 from public.match_players where match_id = p_match and player_id = p_player and status = 'playing') then
    raise exception 'Pemenang harus pemain yang masih main';
  end if;
  if (select count(*) from public.match_players where match_id = p_match) < 3 then
    raise exception 'Match dengan kurang dari 3 player tidak bisa dihitung';
  end if;
  -- Peringkat ditentukan dari urutan kalah, jadi pemenang baru bisa ditetapkan saat tersisa 2 pemain.
  if (select count(*) from public.match_players where match_id = p_match and status = 'playing' and player_id <> p_player) > 1 then
    raise exception 'Tandai dulu pemain yang kalah sampai tersisa 2 pemain';
  end if;

  update public.match_players
     set status = 'eliminated', eliminated_at = now()
   where match_id = p_match and player_id <> p_player and status = 'playing';
  update public.match_players
     set status = 'winner', eliminated_at = null
   where match_id = p_match and player_id = p_player;
  perform public.set_placements(p_match);
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
  -- Kembalikan poin yang dipakai player untuk membuat match ini.
  delete from public.point_adjustments where match_id = p_match and reason = 'create_match';
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
  if m.dealer_id = auth.uid() then
    raise exception 'Kamu tidak bisa join match yang kamu buat sendiri';
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

drop function if exists public.get_leaderboard(timestamptz, timestamptz);
create function public.get_leaderboard(p_from timestamptz default null, p_to timestamptz default null)
returns table (player_id uuid, name text, points bigint, wins bigint, played bigint)
language sql
stable
security definer
set search_path = public
as $$
  -- Poin dari hasil match + penyesuaian (biaya membuat match), dihitung pada tanggal kejadiannya.
  with events as (
    select mp.player_id, mp.points, (mp.status = 'winner')::int as win, 1 as play, m.finished_at as at, true as counts_monthly
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
     where m.status = 'finished'
    union all
    select a.player_id, a.amount, 0, 0, a.created_at, a.counts_monthly
      from public.point_adjustments a
  )
  select p.id, p.name,
         coalesce(sum(e.points), 0) as points,
         coalesce(sum(e.win), 0) as wins,
         coalesce(sum(e.play), 0) as played
    from events e
    join public.profiles p on p.id = e.player_id
   where (p_from is null or e.at >= p_from)
     and (p_to   is null or e.at <  p_to)
     and (e.counts_monthly or (p_from is null and p_to is null))
     and auth.uid() is not null
   group by p.id, p.name
  having coalesce(sum(e.points), 0) > 0
   order by points desc, wins desc, played asc, p.name asc;
$$;

-- Semua akun player (termasuk yang belum pernah main) beserta statistiknya.
-- p_month_start = awal bulan berjalan (dari jam lokal browser) untuk menghitung poin bulan ini.
drop function if exists public.get_player_stats();
drop function if exists public.get_player_stats(timestamptz);
create function public.get_player_stats(p_month_start timestamptz default null)
returns table (player_id uuid, name text, played bigint, wins bigint, points bigint, month_points bigint, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with events as (
    select mp.player_id, mp.points, (mp.status = 'winner')::int as win, 1 as play, m.finished_at as at, true as counts_monthly
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
     where m.status = 'finished'
    union all
    select a.player_id, a.amount, 0, 0, a.created_at, a.counts_monthly
      from public.point_adjustments a
  )
  select p.id, p.name,
         coalesce(sum(e.play), 0) as played,
         coalesce(sum(e.win), 0) as wins,
         coalesce(sum(e.points), 0) as points,
         coalesce(sum(e.points) filter (where e.at >= p_month_start and e.counts_monthly), 0) as month_points,
         p.created_at
    from public.profiles p
    left join events e on e.player_id = p.id
   where p.role = 'player'
     and auth.uid() is not null
   group by p.id, p.name, p.created_at
   order by points desc, wins desc, played desc, p.name asc;
$$;

-- Isi peringkat untuk match yang selesai sebelum sistem poin ada (aman dijalankan ulang).
do $$
declare
  mid uuid;
begin
  for mid in
    select distinct m.id from public.matches m join public.match_players mp on mp.match_id = m.id
     where m.status = 'finished' and mp.placement is null
  loop
    perform public.set_placements(mid);
  end loop;
end;
$$;

-- ---------- Grants -----------------------------------------------------

revoke all on function public.lock_own_match(uuid) from public, anon, authenticated;
revoke all on function public.set_placements(uuid) from public, anon, authenticated;
revoke all on function public.points_balance(uuid) from public, anon, authenticated;
revoke all on function public.month_points_balance(uuid) from public, anon, authenticated;

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
    'public.get_player_stats(timestamptz)',
    'public.get_my_points()',
    'public.match_creation_cost()',
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
