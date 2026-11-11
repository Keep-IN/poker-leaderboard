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

-- Match offline (dimainkan di meja sungguhan, dealer menandai yang kalah) atau online (dimainkan di meja poker
-- website, mode turnamen). online_config = { sb, start_chips, level_minutes } dari dealer.
alter table public.matches add column if not exists mode text not null default 'offline';
alter table public.matches add column if not exists online_config jsonb;
alter table public.matches drop constraint if exists matches_mode_check;
alter table public.matches add constraint matches_mode_check
  check ((mode = 'offline' and online_config is null) or (mode = 'online' and online_config is not null));

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

-- Peringkat akhir (1 = pemenang, 2 = runner-up 1, ...) dan poinnya diisi saat match selesai.
-- Poin disimpan per match, jadi perubahan aturan poin hanya berlaku untuk match berikutnya.
alter table public.match_players add column if not exists placement int check (placement >= 1);
alter table public.match_players add column if not exists points int not null default 0;
-- Database lama: dulu `points` adalah kolom generated (10/5/1). Jadikan kolom biasa, nilai lama tetap tersimpan.
alter table public.match_players alter column points drop expression if exists;
alter table public.match_players alter column points set default 0;

-- Poin di luar hasil match, mis. biaya player membuat match (-1). Total poin = poin match + penyesuaian ini.
create table if not exists public.point_adjustments (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.profiles (id) on delete cascade,
  amount      int  not null,
  reason      text not null,
  match_id    uuid references public.matches (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists point_adjustments_player_idx on public.point_adjustments (player_id);

-- false = hanya mengurangi total poin (dipakai saat poin bulan itu masih 0), jadi poin bulanan tidak pernah minus.
alter table public.point_adjustments add column if not exists counts_monthly boolean not null default true;

-- Duel 1 lawan 1 antar player dengan taruhan poin.
-- pending → (lawan terima) accepted → (dealer setuju) approved → finished
-- Bisa berhenti di declined (lawan tolak), cancelled (dibatalkan pemain/dealer), rejected (dealer tolak).
create table if not exists public.duels (
  id             uuid primary key default gen_random_uuid(),
  challenger_id  uuid not null references public.profiles (id) on delete cascade,
  opponent_id    uuid not null references public.profiles (id) on delete cascade,
  stake          int  not null check (stake >= 1),
  status         text not null default 'pending'
                 check (status in ('pending', 'accepted', 'approved', 'finished', 'declined', 'cancelled', 'rejected')),
  dealer_id      uuid references public.profiles (id) on delete set null,
  winner_id      uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  approved_at    timestamptz,
  finished_at    timestamptz,
  check (challenger_id <> opponent_id)
);

create index if not exists duels_challenger_idx on public.duels (challenger_id);
create index if not exists duels_opponent_idx   on public.duels (opponent_id);
create index if not exists duels_status_idx     on public.duels (status);

-- Taruhan duel ditahan sebagai penyesuaian negatif; pemenang menerima pot (2× taruhan).
-- Bagian taruhan yang tertutup poin bulan ini dicatat counts_monthly = true, sisanya hanya total poin,
-- jadi poin bulanan tidak pernah minus.
alter table public.point_adjustments add column if not exists duel_id uuid references public.duels (id) on delete cascade;

-- Misi duel dari dealer untuk semua player: menangkan `required_wins` duel dengan taruhan minimal
-- `min_stake` sebelum `deadline`, dapat `reward` poin. Duel dihitung kalau selesai di antara
-- dibuatnya misi dan deadline. Reward diberikan otomatis saat duel yang memenuhi target selesai.
create table if not exists public.missions (
  id             uuid primary key default gen_random_uuid(),
  required_wins  int  not null check (required_wins between 1 and 50),
  min_stake      int  not null check (min_stake >= 1),
  reward         int  not null check (reward between 1 and 1000),
  deadline       timestamptz not null,
  status         text not null default 'active' check (status in ('active', 'cancelled')),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists missions_deadline_idx on public.missions (deadline);

-- Jenis misi: 'duel' (menang X duel dengan taruhan minimal) atau 'match_streak' (menang X match berturut-turut).
-- Misi match tidak punya taruhan minimal.
alter table public.missions add column if not exists kind text not null default 'duel';
alter table public.missions alter column min_stake drop not null;
alter table public.missions drop constraint if exists missions_kind_check;
alter table public.missions add constraint missions_kind_check
  check ((kind = 'duel' and min_stake is not null) or (kind = 'match_streak' and min_stake is null));

-- Misi match berlaku untuk match offline atau online saja (misi lama = offline).
alter table public.missions add column if not exists match_mode text;
update public.missions set match_mode = 'offline' where kind = 'match_streak' and match_mode is null;
alter table public.missions drop constraint if exists missions_match_mode_check;
alter table public.missions add constraint missions_match_mode_check
  check ((kind = 'duel' and match_mode is null) or (kind = 'match_streak' and match_mode in ('offline', 'online')));

alter table public.point_adjustments add column if not exists mission_id uuid references public.missions (id) on delete cascade;
-- Reward tiap misi hanya sekali per player.
create unique index if not exists point_adjustments_mission_reward_idx
  on public.point_adjustments (mission_id, player_id) where reason = 'mission_reward';

-- Bounty: dealer menandai player sebagai buruan dengan reward poin. Saat match yang diikuti player itu selesai,
-- pemenang match mengklaim reward-nya (kalau yang menang si buruan sendiri, dia yang mengklaim). Satu bounty aktif per player.
create table if not exists public.bounties (
  id          uuid primary key default gen_random_uuid(),
  target_id   uuid not null references public.profiles (id) on delete cascade,
  reward      int  not null check (reward between 1 and 1000),
  status      text not null default 'active' check (status in ('active', 'claimed', 'cancelled')),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  claimed_by  uuid references public.profiles (id) on delete set null,
  claimed_at  timestamptz,
  match_id    uuid references public.matches (id) on delete set null
);
create unique index if not exists bounties_one_active_idx on public.bounties (target_id) where status = 'active';
create index if not exists bounties_match_idx on public.bounties (match_id);

alter table public.point_adjustments add column if not exists bounty_id uuid references public.bounties (id) on delete cascade;

alter table public.point_adjustments drop constraint if exists point_adjustments_reason_check;
alter table public.point_adjustments add constraint point_adjustments_reason_check
  check (reason in ('create_match', 'duel_stake', 'duel_payout', 'mission_reward', 'bounty_reward'));

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
alter table public.duels enable row level security;
alter table public.missions enable row level security;
alter table public.bounties enable row level security;

drop policy if exists "profiles readable"      on public.profiles;
drop policy if exists "matches readable"       on public.matches;
drop policy if exists "match_players readable" on public.match_players;
drop policy if exists "point_adjustments readable" on public.point_adjustments;
drop policy if exists "duels readable" on public.duels;
drop policy if exists "missions readable" on public.missions;
drop policy if exists "bounties readable" on public.bounties;

create policy "profiles readable"      on public.profiles      for select to authenticated using (true);
create policy "matches readable"       on public.matches       for select to authenticated using (true);
create policy "match_players readable" on public.match_players for select to authenticated using (true);
create policy "point_adjustments readable" on public.point_adjustments for select to authenticated using (true);
create policy "duels readable" on public.duels for select to authenticated using (true);
create policy "missions readable" on public.missions for select to authenticated using (true);
create policy "bounties readable" on public.bounties for select to authenticated using (true);

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

-- Small blind yang boleh dipilih untuk match online (big blind = 2×). Sama dengan LEVELS di api/_lib/poker.js.
create or replace function public.online_blind_levels()
returns int[]
language sql
immutable
as $$
  select array[10, 15, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 50000];
$$;

drop function if exists public.create_match(text, int);
create or replace function public.create_match(p_title text, p_max_players int default 8, p_mode text default 'offline', p_config jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  my_role text;
  cfg jsonb;
  sb int;
  chips int;
  minutes int;
begin
  -- Kunci baris profil supaya dua request bersamaan tidak sama-sama lolos cek saldo.
  select role into my_role from public.profiles where id = auth.uid() for update;
  if my_role is null then
    raise exception 'Akun tidak ditemukan';
  end if;
  if p_max_players < 3 or p_max_players > 8 then
    raise exception 'Jumlah player harus 3 sampai 8';
  end if;
  if p_mode is null or p_mode not in ('offline', 'online') then
    raise exception 'Mode match tidak dikenal';
  end if;
  if p_mode = 'online' then
    sb := (p_config ->> 'sb')::int;
    chips := (p_config ->> 'start_chips')::int;
    minutes := (p_config ->> 'level_minutes')::int;
    if sb is null or not (sb = any (public.online_blind_levels())) then
      raise exception 'Blind awal tidak valid';
    end if;
    if chips is null or chips < 20 * sb or chips > 1000000 then
      raise exception 'Chip awal minimal 10× big blind dan maksimal 1.000.000';
    end if;
    if minutes is null or minutes < 2 or minutes > 60 then
      raise exception 'Blind naik tiap 2 sampai 60 menit';
    end if;
    cfg := jsonb_build_object('sb', sb, 'start_chips', chips, 'level_minutes', minutes);
  end if;
  if my_role = 'player' and public.points_balance(auth.uid()) < public.match_creation_cost() then
    raise exception 'Poin kamu belum cukup untuk membuat match (butuh % poin)', public.match_creation_cost();
  end if;

  insert into public.matches (title, dealer_id, max_players, mode, online_config)
  values (trim(p_title), auth.uid(), p_max_players, p_mode, cfg)
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
  if m.mode = 'online' then
    raise exception 'Hasil match online dicatat otomatis oleh meja poker';
  end if;
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
  if m.mode = 'online' then
    raise exception 'Hasil match online dicatat otomatis oleh meja poker';
  end if;
  if m.status <> 'ongoing' then
    raise exception 'Match belum/tidak sedang berlangsung';
  end if;
  update public.match_players
     set status = 'playing', eliminated_at = null
   where match_id = p_match and player_id = p_player and status = 'eliminated';
end;
$$;

-- Pemenang peringkat 1, lalu yang kalah paling akhir peringkat 2, dst.
-- Poin berdasarkan peringkat dan jumlah pemain (N): juara 2×N, runner-up 1 N,
-- runner-up 2 N÷3 dibulatkan (hanya kalau N ≥ 4), sisanya 0. Sama dengan pointsFor() di frontend.
create or replace function public.placement_points(p_placement int, p_players int)
returns int
language sql
immutable
as $$
  select case
           when p_placement = 1 then 2 * p_players
           when p_placement = 2 then p_players
           when p_placement = 3 and p_players >= 4 then round(p_players / 3.0)::int
           else 0
         end;
$$;

-- Match online: setengah poin offline. Juara N, runner-up 1 N÷2, runner-up 2 N÷6 (hanya kalau N ≥ 4), dibulatkan.
-- Sama dengan pointsFor(..., 'online') di frontend.
create or replace function public.online_placement_points(p_placement int, p_players int)
returns int
language sql
immutable
as $$
  select case
           when p_placement = 1 then p_players
           when p_placement = 2 then round(p_players / 2.0)::int
           when p_placement = 3 and p_players >= 4 then round(p_players / 6.0)::int
           else 0
         end;
$$;

create or replace function public.set_placements(p_match uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.match_players mp
     set placement = r.rn,
         points = case when (select mode from public.matches where id = p_match) = 'online'
                       then public.online_placement_points(r.rn::int, r.total::int)
                       else public.placement_points(r.rn::int, r.total::int) end
    from (
      select player_id,
             row_number() over (order by (status = 'winner') desc, eliminated_at desc nulls last, joined_at) as rn,
             count(*) over () as total
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
  if m.mode = 'online' then
    raise exception 'Hasil match online dicatat otomatis oleh meja poker';
  end if;
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
  perform public.award_missions(p_player);
  perform public.claim_bounties(p_match, p_player);
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

-- ---------- Duel RPCs -------------------------------------------------

create or replace function public.lock_duel(p_duel uuid)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels;
begin
  select * into d from public.duels where id = p_duel for update;
  if not found then
    raise exception 'Duel tidak ditemukan';
  end if;
  return d;
end;
$$;

-- Tahan taruhan: diambil dari poin bulan ini sebanyak yang ada, sisanya hanya dari total poin.
create or replace function public.hold_duel_stake(p_duel uuid, p_player uuid, p_stake int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  monthly int := least(p_stake, greatest(public.month_points_balance(p_player), 0));
begin
  if monthly > 0 then
    insert into public.point_adjustments (player_id, amount, reason, duel_id, counts_monthly)
    values (p_player, -monthly, 'duel_stake', p_duel, true);
  end if;
  if p_stake - monthly > 0 then
    insert into public.point_adjustments (player_id, amount, reason, duel_id, counts_monthly)
    values (p_player, -(p_stake - monthly), 'duel_stake', p_duel, false);
  end if;
end;
$$;

-- Kembalikan semua taruhan yang ditahan untuk duel ini.
create or replace function public.refund_duel(p_duel uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.point_adjustments where duel_id = p_duel and reason = 'duel_stake';
$$;

create or replace function public.create_duel(p_opponent uuid, p_stake int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  -- Kunci profil penantang supaya saldo tidak dipakai dua kali bersamaan.
  perform 1 from public.profiles where id = auth.uid() and role = 'player' for update;
  if not found then
    raise exception 'Hanya akun player yang bisa mengajak duel';
  end if;
  if p_opponent = auth.uid() then
    raise exception 'Kamu tidak bisa duel dengan diri sendiri';
  end if;
  if not exists (select 1 from public.profiles where id = p_opponent and role = 'player') then
    raise exception 'Lawan duel harus akun player';
  end if;
  if p_stake is null or p_stake < 1 then
    raise exception 'Taruhan minimal 1 poin';
  end if;
  if public.points_balance(auth.uid()) < p_stake then
    raise exception 'Poin kamu tidak cukup untuk taruhan % poin', p_stake;
  end if;
  if exists (
    select 1 from public.duels
     where status in ('pending', 'accepted', 'approved')
       and ((challenger_id = auth.uid() and opponent_id = p_opponent)
         or (challenger_id = p_opponent and opponent_id = auth.uid()))
  ) then
    raise exception 'Masih ada duel yang belum selesai dengan pemain ini';
  end if;

  insert into public.duels (challenger_id, opponent_id, stake)
  values (auth.uid(), p_opponent, p_stake)
  returning id into new_id;

  perform public.hold_duel_stake(new_id, auth.uid(), p_stake);
  return new_id;
end;
$$;

create or replace function public.respond_duel(p_duel uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels := public.lock_duel(p_duel);
begin
  if d.opponent_id <> auth.uid() then
    raise exception 'Ajakan duel ini bukan untuk kamu';
  end if;
  if d.status <> 'pending' then
    raise exception 'Ajakan duel ini sudah tidak aktif';
  end if;

  if not p_accept then
    perform public.refund_duel(p_duel);
    update public.duels set status = 'declined', responded_at = now() where id = p_duel;
    return;
  end if;

  perform 1 from public.profiles where id = auth.uid() for update;
  if public.points_balance(auth.uid()) < d.stake then
    raise exception 'Poin kamu tidak cukup untuk taruhan % poin', d.stake;
  end if;
  perform public.hold_duel_stake(p_duel, auth.uid(), d.stake);
  update public.duels set status = 'accepted', responded_at = now() where id = p_duel;
end;
$$;

-- Pemain bisa membatalkan selama dealer belum menyetujui; dealer host bisa membatalkan duel yang sedang di-host.
create or replace function public.cancel_duel(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels := public.lock_duel(p_duel);
begin
  if not (
       (d.status = 'pending'  and auth.uid() = d.challenger_id)
    or (d.status = 'accepted' and auth.uid() in (d.challenger_id, d.opponent_id))
    or (d.status = 'approved' and auth.uid() = d.dealer_id)
  ) then
    raise exception 'Duel ini tidak bisa dibatalkan';
  end if;
  perform public.refund_duel(p_duel);
  update public.duels set status = 'cancelled', finished_at = now() where id = p_duel;
end;
$$;

create or replace function public.review_duel(p_duel uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels := public.lock_duel(p_duel);
begin
  if public.current_role_name() is distinct from 'dealer' then
    raise exception 'Hanya dealer yang bisa menyetujui duel';
  end if;
  if d.status <> 'accepted' then
    raise exception 'Duel ini sudah ditangani dealer lain atau sudah tidak aktif';
  end if;

  if p_approve then
    update public.duels set status = 'approved', dealer_id = auth.uid(), approved_at = now() where id = p_duel;
  else
    perform public.refund_duel(p_duel);
    update public.duels set status = 'rejected', dealer_id = auth.uid(), finished_at = now() where id = p_duel;
  end if;
end;
$$;

create or replace function public.finish_duel(p_duel uuid, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels := public.lock_duel(p_duel);
  monthly_pot int;
begin
  if d.dealer_id is distinct from auth.uid() then
    raise exception 'Hanya dealer host duel ini yang bisa menetapkan pemenang';
  end if;
  if d.status <> 'approved' then
    raise exception 'Duel ini belum disetujui atau sudah selesai';
  end if;
  if p_winner not in (d.challenger_id, d.opponent_id) then
    raise exception 'Pemenang harus salah satu pemain duel';
  end if;

  -- Pot total 2× taruhan. Poin bulanan pemenang bertambah sebesar bagian bulanan yang ditahan dari
  -- kedua pemain, jadi poin bulanan juga hanya berpindah (yang kalah −X bulanan, pemenang +X bulanan).
  select coalesce(-sum(amount), 0) into monthly_pot
    from public.point_adjustments
   where duel_id = p_duel and reason = 'duel_stake' and counts_monthly;
  if monthly_pot > 0 then
    insert into public.point_adjustments (player_id, amount, reason, duel_id, counts_monthly)
    values (p_winner, monthly_pot, 'duel_payout', p_duel, true);
  end if;
  if 2 * d.stake - monthly_pot > 0 then
    insert into public.point_adjustments (player_id, amount, reason, duel_id, counts_monthly)
    values (p_winner, 2 * d.stake - monthly_pot, 'duel_payout', p_duel, false);
  end if;
  update public.duels set status = 'finished', winner_id = p_winner, finished_at = now() where id = p_duel;
  perform public.award_missions(p_winner);
end;
$$;

-- ---------- Misi -------------------------------------------------------

drop function if exists public.mission_wins(uuid, uuid);

-- Progres player untuk satu misi. Hanya duel/match yang selesai antara dibuatnya misi dan deadline.
--   duel:         current = best = jumlah duel menang dengan taruhan >= min_stake
--   match_streak: current = streak menang terakhir, best = streak terpanjang (kalah mengulang dari 0)
create or replace function public.mission_progress(p_mission uuid, p_player uuid, out current int, out best int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.missions;
begin
  select * into m from public.missions where id = p_mission;
  if m.kind = 'duel' then
    select count(*)::int into current
      from public.duels d
     where d.status = 'finished'
       and d.winner_id = p_player
       and d.stake >= m.min_stake
       and d.finished_at between m.created_at and m.deadline;
    best := current;
  else
    -- Setiap kekalahan membuka grup baru; jumlah menang dalam satu grup = panjang streak.
    with played as (
      select mp.status = 'winner' as win, x.finished_at, x.id
        from public.match_players mp
        join public.matches x on x.id = mp.match_id
       where mp.player_id = p_player
         and x.status = 'finished'
         and x.mode = m.match_mode
         and x.finished_at between m.created_at and m.deadline
    ), grouped as (
      select win, count(*) filter (where not win) over (order by finished_at, id) as grp from played
    ), streaks as (
      select grp, count(*) filter (where win)::int as wins from grouped group by grp
    )
    select coalesce(max(wins), 0),
           coalesce((select wins from streaks order by grp desc limit 1), 0)
      into best, current
      from streaks;
  end if;
end;
$$;

-- Beri reward untuk semua misi aktif yang baru saja tercapai oleh player ini.
create or replace function public.award_missions(p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_adjustments (player_id, amount, reason, mission_id, counts_monthly)
  select p_player, m.reward, 'mission_reward', m.id, true
    from public.missions m
   where m.status = 'active'
     and m.deadline >= now()
     and (public.mission_progress(m.id, p_player)).best >= m.required_wins
  on conflict (mission_id, player_id) where reason = 'mission_reward' do nothing;
end;
$$;

drop function if exists public.create_mission(int, int, int, timestamptz);
drop function if exists public.create_mission(int, int, int, timestamptz, text);
create or replace function public.create_mission(p_wins int, p_min_stake int, p_reward int, p_deadline timestamptz,
                                                 p_kind text default 'duel', p_match_mode text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if public.current_role_name() is distinct from 'dealer' then
    raise exception 'Hanya dealer yang bisa membuat misi';
  end if;
  if p_kind is null or p_kind not in ('duel', 'match_streak') then
    raise exception 'Jenis misi tidak dikenal';
  end if;
  if p_kind = 'match_streak' and (p_match_mode is null or p_match_mode not in ('offline', 'online')) then
    raise exception 'Pilih misi match offline atau online';
  end if;
  if p_kind = 'duel' and (p_wins is null or p_wins < 1 or p_wins > 50) then
    raise exception 'Jumlah menang harus 1 sampai 50';
  end if;
  if p_kind = 'match_streak' and (p_wins is null or p_wins < 2 or p_wins > 20) then
    raise exception 'Jumlah menang beruntun harus 2 sampai 20';
  end if;
  if p_kind = 'duel' and (p_min_stake is null or p_min_stake < 1) then
    raise exception 'Taruhan minimal harus minimal 1 poin';
  end if;
  if p_reward is null or p_reward < 1 or p_reward > 1000 then
    raise exception 'Reward harus 1 sampai 1000 poin';
  end if;
  if p_deadline is null or p_deadline <= now() + interval '5 minutes' then
    raise exception 'Deadline harus di masa depan';
  end if;
  insert into public.missions (kind, match_mode, required_wins, min_stake, reward, deadline, created_by)
  values (p_kind, case when p_kind = 'match_streak' then p_match_mode end, p_wins,
          case when p_kind = 'duel' then p_min_stake end, p_reward, p_deadline, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

-- Reward yang sudah diberikan tetap milik player.
create or replace function public.cancel_mission(p_mission uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_name() is distinct from 'dealer' then
    raise exception 'Hanya dealer yang bisa membatalkan misi';
  end if;
  update public.missions set status = 'cancelled' where id = p_mission and status = 'active';
  if not found then
    raise exception 'Misi tidak ditemukan atau sudah dibatalkan';
  end if;
end;
$$;

-- Misi yang masih berjalan beserta progres player yang login.
drop function if exists public.get_my_missions();
create function public.get_my_missions()
returns table (id uuid, kind text, match_mode text, required_wins int, min_stake int, reward int, deadline timestamptz,
               created_at timestamptz, wins int, best int, completed boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.kind, m.match_mode, m.required_wins, m.min_stake, m.reward, m.deadline, m.created_at,
         (public.mission_progress(m.id, auth.uid())).current,
         (public.mission_progress(m.id, auth.uid())).best,
         exists (select 1 from public.point_adjustments a
                  where a.mission_id = m.id and a.player_id = auth.uid() and a.reason = 'mission_reward')
    from public.missions m
   where m.status = 'active'
     and m.deadline > now()
     and auth.uid() is not null
   order by m.deadline asc;
$$;

-- ---------- Meja poker online -------------------------------------------
-- State meja (termasuk kartu semua pemain) hanya dibaca/ditulis oleh fungsi server /api/meja memakai secret key.
-- Tidak ada policy RLS, jadi user biasa tidak bisa membacanya.

create table if not exists public.online_tables (
  match_id    uuid primary key references public.matches (id) on delete cascade,
  state       jsonb not null,
  ver         int  not null default 1,
  due_at      timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.online_tables enable row level security;

-- Buat meja sekali saja, saat match online sudah dimulai. Mengembalikan versi, atau null kalau meja sudah ada.
create or replace function public.meja_create(p_match uuid, p_state jsonb, p_due timestamptz)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.matches where id = p_match and mode = 'online' and status = 'ongoing') then
    raise exception 'match_not_ongoing';
  end if;
  insert into public.online_tables (match_id, state, due_at) values (p_match, p_state, p_due)
  on conflict (match_id) do nothing;
  return case when found then 1 end;
end;
$$;

-- Simpan state meja kalau versinya masih p_ver (compare-and-set), lalu catat hasil ke match:
-- p_out = uid pemain tersingkir sesuai urutan (kumulatif), p_winner = juara kalau turnamen selesai.
-- Mengembalikan versi baru, atau null kalau ada yang menulis lebih dulu.
create or replace function public.meja_save(p_match uuid, p_ver int, p_state jsonb, p_due timestamptz, p_out uuid[], p_winner uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  nv int;
begin
  perform 1 from public.matches where id = p_match and mode = 'online' and status = 'ongoing' for update;
  if not found then
    raise exception 'match_not_ongoing';
  end if;
  update public.online_tables
     set state = p_state, ver = ver + 1, due_at = p_due, updated_at = now()
   where match_id = p_match and ver = p_ver
  returning ver into nv;
  if nv is null then
    return null;
  end if;

  -- Yang tersingkir belakangan mendapat eliminated_at lebih akhir (= peringkat lebih baik).
  for i in 1 .. coalesce(array_length(p_out, 1), 0) loop
    update public.match_players
       set status = 'eliminated', eliminated_at = clock_timestamp()
     where match_id = p_match and player_id = p_out[i] and status = 'playing';
  end loop;

  if p_winner is not null then
    update public.match_players
       set status = 'eliminated', eliminated_at = clock_timestamp()
     where match_id = p_match and player_id <> p_winner and status = 'playing';
    update public.match_players
       set status = 'winner', eliminated_at = null
     where match_id = p_match and player_id = p_winner;
    perform public.set_placements(p_match);
    update public.matches
       set status = 'finished', winner_id = p_winner, finished_at = now()
     where id = p_match;
    perform public.award_missions(p_winner);
    perform public.claim_bounties(p_match, p_winner);
  end if;
  return nv;
end;
$$;

-- ---------- Bounty -----------------------------------------------------

-- Dipanggil saat match selesai: semua bounty aktif yang target-nya ikut match ini diklaim oleh pemenang.
create or replace function public.claim_bounties(p_match uuid, p_winner uuid)
returns void
language sql
security definer
set search_path = public
as $$
  with claimed as (
    update public.bounties
       set status = 'claimed', claimed_by = p_winner, claimed_at = now(), match_id = p_match
     where status = 'active'
       and target_id in (select player_id from public.match_players where match_id = p_match)
    returning id, reward
  )
  insert into public.point_adjustments (player_id, amount, reason, bounty_id, counts_monthly)
  select p_winner, reward, 'bounty_reward', id, true from claimed;
$$;

create or replace function public.create_bounty(p_target uuid, p_reward int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if public.current_role_name() is distinct from 'dealer' then
    raise exception 'Hanya dealer yang bisa memasang bounty';
  end if;
  if not exists (select 1 from public.profiles where id = p_target and role = 'player') then
    raise exception 'Bounty hanya bisa dipasang ke player';
  end if;
  if p_reward is null or p_reward < 1 or p_reward > 1000 then
    raise exception 'Reward bounty harus 1 sampai 1000 poin';
  end if;
  if exists (select 1 from public.bounties where target_id = p_target and status = 'active') then
    raise exception 'Player ini sudah punya bounty aktif';
  end if;
  insert into public.bounties (target_id, reward, created_by) values (p_target, p_reward, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.cancel_bounty(p_bounty uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_name() is distinct from 'dealer' then
    raise exception 'Hanya dealer yang bisa membatalkan bounty';
  end if;
  update public.bounties set status = 'cancelled' where id = p_bounty and status = 'active';
  if not found then
    raise exception 'Bounty tidak ditemukan atau sudah selesai';
  end if;
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

-- ---------- Grants -----------------------------------------------------

revoke all on function public.lock_own_match(uuid) from public, anon, authenticated;
revoke all on function public.set_placements(uuid) from public, anon, authenticated;
revoke all on function public.points_balance(uuid) from public, anon, authenticated;
revoke all on function public.month_points_balance(uuid) from public, anon, authenticated;
revoke all on function public.lock_duel(uuid) from public, anon, authenticated;
revoke all on function public.refund_duel(uuid) from public, anon, authenticated;
revoke all on function public.hold_duel_stake(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.mission_progress(uuid, uuid) from public, anon, authenticated;
revoke all on function public.meja_create(uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.meja_save(uuid, int, jsonb, timestamptz, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.meja_create(uuid, jsonb, timestamptz) to service_role;
grant execute on function public.meja_save(uuid, int, jsonb, timestamptz, uuid[], uuid) to service_role;
revoke all on function public.award_missions(uuid) from public, anon, authenticated;
revoke all on function public.claim_bounties(uuid, uuid) from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_match(text, int, text, jsonb)',
    'public.online_blind_levels()',
    'public.online_placement_points(int, int)',
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
    'public.placement_points(int, int)',
    'public.create_duel(uuid, int)',
    'public.respond_duel(uuid, boolean)',
    'public.cancel_duel(uuid)',
    'public.review_duel(uuid, boolean)',
    'public.finish_duel(uuid, uuid)',
    'public.create_mission(int, int, int, timestamptz, text, text)',
    'public.cancel_mission(uuid)',
    'public.get_my_missions()',
    'public.create_bounty(uuid, int)',
    'public.cancel_bounty(uuid)',
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
  begin
    alter publication supabase_realtime add table public.duels;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.missions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.bounties;
  exception when duplicate_object then null;
  end;
end;
$$;

-- ---------- Chat meja online (Realtime Broadcast) ----------------------
-- Chat tidak disimpan di tabel mana pun: pesan dikirim lewat channel privat 'meja:<match_id>'.
-- Semua user yang login boleh mendengar (penonton juga); yang boleh mengirim hanya pemain match itu
-- dan host-nya, selama match berjalan. Dilewati kalau skema realtime tidak ada (database lokal untuk tes).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'realtime') then
    execute 'drop policy if exists "meja chat read" on realtime.messages';
    execute 'drop policy if exists "meja chat send" on realtime.messages';
    execute $p$
      create policy "meja chat read" on realtime.messages for select to authenticated
      using (realtime.messages.extension = 'broadcast' and realtime.topic() like 'meja:%')
    $p$;
    execute $p$
      create policy "meja chat send" on realtime.messages for insert to authenticated
      with check (
        realtime.messages.extension = 'broadcast'
        and (
          exists (
            select 1
              from public.match_players mp
              join public.matches m on m.id = mp.match_id
             where 'meja:' || mp.match_id::text = realtime.topic()
               and mp.player_id = auth.uid()
               and m.status = 'ongoing'
          )
          or exists (
            select 1
              from public.matches m
             where 'meja:' || m.id::text = realtime.topic()
               and m.dealer_id = auth.uid()
               and m.status = 'ongoing'
          )
        )
      )
    $p$;
  end if;
end;
$$;

-- ---------- Jadikan user sebagai dealer --------------------------------
-- Daftar dulu lewat website, lalu jalankan (ganti emailnya):
--
--   update public.profiles set role = 'dealer'
--    where id = (select id from auth.users where email = 'dealer@contoh.com');
