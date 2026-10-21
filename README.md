# ♠ BTP Poker League

**🔗 https://btp-poker-league.vercel.app**

BTP Poker League adalah website untuk mencatat hasil permainan poker antar teman. Setiap match yang dimainkan tercatat otomatis: siapa yang ikut, siapa yang kalah, dan siapa yang menang. Hasilnya langsung masuk ke statistik tiap pemain dan ke leaderboard bulanan maupun all time.

Tampilannya dirancang untuk HP. Halaman match update secara real-time, jadi semua orang yang membuka match yang sama melihat perubahan yang sama tanpa perlu refresh.

---

## Fitur

### 👤 Akun
- Daftar cukup dengan **nama, email, dan password**, lalu langsung bisa login.
- Ada dua jenis akun: **Player** dan **Dealer**.

### 🏠 Beranda Player
- **Win rate**, jumlah **match dimainkan**, dan jumlah **match menang**.
- Daftar **match aktif** yang sedang kamu ikuti.
- **Riwayat match** dengan label WIN / OUT dan nama pemenangnya.

### 🎩 Beranda Dealer
- Jumlah **match yang sudah di-host**.
- Tombol **Buat Match Baru**.
- Daftar match aktif dan riwayat hosting beserta pemenangnya.

### 🃏 Match
- Daftar **match yang sedang aktif** dan **match yang baru selesai**, bisa dilihat semua user.
- Satu match berisi **maksimal 8 pemain**. Dealer bisa mengatur batasnya antara 2 sampai 8.
- **Halaman match real-time**:
  - Player bisa join dan keluar dari match.
  - Dealer bisa memulai match, menandai pemain yang kalah, dan menetapkan pemenang.
  - Urutan pemain mengikuti posisi akhir (pemenang di atas, yang kalah paling awal di bawah).

### 🏆 Leaderboard
- Dua tab: **Bulanan** dan **All Time**.
- Di tab Bulanan bisa geser ke bulan-bulan sebelumnya.
- **Juara 1, 2, 3 tampil di podium**, sisanya di daftar di bawahnya.
- Diurutkan berdasarkan jumlah kemenangan. Pemain dengan jumlah menang yang sama mendapat peringkat yang sama.

---

## Cara Kerja

### Alur sebuah match

```
Dealer buat match  →  Player join  →  Dealer mulai match  →  Dealer tandai yang kalah  →  Dealer tetapkan pemenang  →  Tercatat ✅
```

1. **Dealer membuat match** dari menu khusus dealer. Status match: *Menunggu player*.
2. **Player membuka menu Match**, memilih match, lalu menekan **Join Match**. Selama match belum dimulai, player masih boleh keluar dan dealer masih bisa mengeluarkan player.
3. **Dealer menekan Mulai Match** (minimal 2 pemain). Setelah itu tidak ada yang bisa join atau keluar.
4. Selama permainan, **dealer menekan Kalah** untuk pemain yang tersingkir. Kalau salah tekan, bisa di-**Undo**.
5. **Dealer menekan Menang** pada pemenang dan mengonfirmasi. Match selesai, semua pemain lain tercatat kalah.
6. Hasilnya langsung muncul di **riwayat**, **statistik**, dan **leaderboard** setiap pemain.

Match yang **dibatalkan** dealer tidak dihitung di statistik maupun leaderboard.

### Bagaimana statistik dihitung

Statistik **tidak disimpan sebagai angka**. Statistik dihitung ulang dari riwayat match setiap kali halaman dibuka, jadi angkanya selalu sesuai dengan match yang benar-benar terjadi.

| Statistik       | Dihitung dari                                                |
| --------------- | ------------------------------------------------------------ |
| Match dimainkan | Jumlah match **selesai** yang diikuti pemain                 |
| Match menang    | Jumlah match selesai di mana pemain menjadi **pemenang**     |
| Win rate        | Match menang ÷ match dimainkan × 100%                        |
| Leaderboard     | Jumlah kemenangan per pemain, untuk bulan terpilih / all time |
| Match di-host   | Jumlah match **selesai** yang dibuat dealer                  |

### Peran Player vs Dealer

|                                         | Player | Dealer |
| --------------------------------------- | :----: | :----: |
| Lihat statistik, match & leaderboard    |   ✅   |   ✅   |
| Join / keluar dari match                |   ✅   |   –    |
| Buat, mulai, dan batalkan match         |   –    |   ✅   |
| Tandai pemain kalah & tetapkan pemenang |   –    |   ✅   |

Semua akun baru otomatis menjadi **Player**. Akun dijadikan **Dealer** oleh admin melalui Supabase (Table Editor → tabel `profiles` → ubah kolom `role` menjadi `dealer`).

### Keamanan

- Data hanya bisa dilihat oleh user yang sudah login.
- Semua aksi (join, mulai match, tetapkan pemenang, dll.) dijalankan lewat fungsi di database yang **mengecek peran dan kepemilikan match**. Pemain tidak bisa mengubah hasil match atau menjadikan dirinya dealer, dan dealer hanya bisa mengatur match miliknya sendiri.

---

## Teknologi

| Bagian   | Yang dipakai                                         |
| -------- | ---------------------------------------------------- |
| Frontend | React, TypeScript, Vite, Tailwind CSS                |
| Backend  | Supabase (Auth, PostgreSQL, Realtime, Row Level Security) |
| Hosting  | Vercel (auto-deploy setiap push ke `main`)           |

Semua layanan memakai paket gratis, cukup untuk 40–50 pengguna. Project Supabase gratis akan di-pause kalau tidak dipakai selama 7 hari. Klik **Restore** di dashboard Supabase untuk mengaktifkannya lagi.

---

## Untuk Pengembang

<details>
<summary>Setup dari nol & development lokal</summary>

**Supabase**
1. Buat project di <https://supabase.com>.
2. SQL Editor → jalankan isi [`supabase/schema.sql`](supabase/schema.sql).
3. Authentication → Sign In / Providers → Email → matikan **Confirm email**.
4. Project Settings → API → catat Project URL dan publishable key.

**Vercel**
1. Import repo ini di <https://vercel.com>.
2. Tambahkan environment variable `VITE_SUPABASE_URL` dan `VITE_SUPABASE_KEY`.
3. Deploy.

**Lokal**
```bash
cp .env.example .env   # isi URL & key Supabase
npm install
npm run dev
```

**Struktur**
```
src/
  pages/        Beranda, Leaderboard, Match, Match Room, Buat Match, Login/Daftar
  components/   Layout (header + bottom nav) dan komponen UI
  lib/          Supabase client, auth context, helper format
supabase/
  schema.sql    Tabel, RLS, fungsi database, realtime
```

</details>
