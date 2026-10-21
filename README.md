# ♠ BTP Poker League

Website buat ngetracking match poker bareng teman. Mobile-first, real-time.

- **Player**: daftar pakai nama, email, password → lihat statistik (match dimainkan, menang, win rate), riwayat match, join match.
- **Dealer**: buat match (maks 8 player), mulai match, tandai player yang kalah, tetapkan pemenang.
- **Leaderboard**: tab Bulanan & All Time — top 3 di podium, sisanya di list.
- Halaman match update otomatis (Supabase Realtime) untuk semua yang sedang membukanya.

**Stack:** React + Vite + Tailwind · Supabase (Auth, Postgres, Realtime) · Vercel. Semua gratis.

---

## Setup (sekali saja, ±15 menit)

### 1. Supabase (database + login)

1. Buat akun di <https://supabase.com> → **New project** (region: Singapore). Simpan database password-nya.
2. Buka **SQL Editor** → New query → paste isi [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Sign In / Providers → Email**: matikan **Confirm email**.
   (Email bawaan Supabase gratis cuma bisa kirim beberapa email per jam, jadi tanpa ini teman-teman bakal gagal daftar.)
4. **Project Settings → API**: catat **Project URL** dan **anon / publishable key**.

### 2. Vercel (hosting)

1. Login ke <https://vercel.com> pakai GitHub → **Add New → Project** → import repo ini.
2. Framework otomatis terdeteksi **Vite**. Tambahkan **Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_KEY` = anon / publishable key
3. **Deploy**. Bagikan link `*.vercel.app` ke teman-teman.

### 3. Jadikan akun sebagai dealer

Daftar dulu lewat website, lalu di Supabase **SQL Editor** jalankan:

```sql
update public.profiles set role = 'dealer'
 where id = (select id from auth.users where email = 'email-dealer@contoh.com');
```

Logout & login lagi — badge **DEALER** muncul dan tombol **Buat Match** tersedia.

---

## Alur match

1. Dealer buat match → status **Menunggu player**.
2. Player buka menu **Match** → pilih match → **Join Match** (maks sesuai setting, ≤ 8).
3. Dealer tekan **Mulai Match** (min. 2 player). Setelah mulai, player tidak bisa join/keluar.
4. Selama main, dealer tekan **Kalah** untuk player yang tersingkir (bisa **Undo**).
5. Dealer tekan **Menang** pada pemenang → match selesai, tercatat di riwayat & leaderboard.

Match yang **Dibatalkan** tidak dihitung di statistik.

## Development lokal

```bash
cp .env.example .env   # isi dengan URL & key Supabase
npm install
npm run dev
```

## Batas free tier (cukup untuk 40–50 orang)

| Layanan  | Limit gratis                                   |
| -------- | ---------------------------------------------- |
| Supabase | 500 MB database, 50k user aktif/bulan, 200 koneksi realtime |
| Vercel   | 100 GB bandwidth/bulan                         |

Catatan: project Supabase gratis akan **di-pause kalau tidak ada aktivitas 7 hari**. Tinggal klik **Restore** di dashboard Supabase kalau itu terjadi.

## Keamanan

Semua tabel memakai Row Level Security: user yang login hanya bisa **membaca**. Semua perubahan (buat match, join, tentukan pemenang, dll.) lewat fungsi database yang mengecek role & kepemilikan match, jadi player tidak bisa mengubah hasil match atau menjadikan dirinya dealer.
