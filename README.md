# ♠ BTP Poker League

**🔗 https://btp-poker-league.vercel.app**

BTP Poker League adalah website untuk mencatat hasil permainan poker antar teman. Setiap match yang dimainkan tercatat otomatis: siapa yang ikut, siapa yang kalah, dan siapa yang menang. Hasilnya langsung masuk ke statistik tiap pemain dan ke leaderboard bulanan maupun all time.

Tampilannya dirancang untuk HP. Halaman match update secara real-time, jadi semua orang yang membuka match yang sama melihat perubahan yang sama tanpa perlu refresh.

---

## Fitur

### 👤 Akun
- Daftar cukup dengan **nama, email, dan password**, lalu langsung bisa login.
- Ada dua jenis akun: **Player** dan **Dealer**.

### 🎟️ Player bisa jadi host
- Player bisa **membuat match sendiri dengan biaya 1 poin**. Sebelum match dibuat, ada **halaman konfirmasi** yang menampilkan biaya dan sisa poin.
- Player yang membuat match menjadi **host**: memulai match, menandai pemain kalah, dan menetapkan pemenang. Host **tidak bisa ikut main** di match buatannya sendiri.
- Kalau match dibatalkan, **1 poin dikembalikan** ke host.
- Butuh minimal 1 poin untuk membuat match. Dealer tetap bisa membuat match gratis.

### 🏠 Beranda Player
- **Win rate**, jumlah **match dimainkan**, dan jumlah **match menang**.
- **Poin bulan ini** dan **total poin** yang sudah dikumpulkan.
- Daftar **match aktif** yang sedang kamu ikuti.
- **Riwayat match** dengan label WIN / #2 / #3 / OUT, poin yang didapat, dan nama pemenangnya.

### 👥 Pemain
- Daftar **semua player yang sudah daftar** beserta total poin, jumlah main, jumlah menang, dan win rate.
- Bisa dicari berdasarkan nama dan diurutkan berdasarkan total poin, poin bulan ini, menang, win rate, jumlah main, atau nama.
- Klik nama untuk membuka **profil pemain**: statistik lengkap, match yang sedang diikuti, dan riwayat match.

### ⚔️ Duel
- Player bisa **mengajak player lain duel 1 lawan 1** dengan **taruhan poin**, lewat tombol ⚔️ di menu Pemain atau di profil pemain.
- Penantang menentukan jumlah taruhan, lalu melihat **halaman konfirmasi** sebelum ajakan dikirim.
- Ajakan muncul di **Beranda pemain yang diajak**, yang bisa menerima atau menolak.
- Duel yang sudah diterima muncul di **Beranda semua dealer**. Dealer pertama yang menyetujui menjadi **host** dan menetapkan pemenangnya.
- Di kartu statistik ada tab **Match / Duel**. Tab Duel hanya muncul kalau pemain itu pernah duel, dan berisi win rate duel serta riwayat duel.

### 🎩 Beranda Dealer
- Jumlah **match yang sudah di-host**.
- Tombol **Buat Match Baru**.
- Daftar match aktif dan riwayat hosting beserta pemenangnya.

### 🃏 Match
- Daftar **match yang sedang aktif** dan **match yang baru selesai**, bisa dilihat semua user.
- Satu match berisi **maksimal 8 pemain**. Dealer bisa mengatur batasnya antara 3 sampai 8. Match butuh **minimal 3 pemain** untuk dimulai.
- **Halaman match real-time**:
  - Player bisa join dan keluar dari match.
  - Dealer bisa memulai match, menandai pemain yang kalah, dan menetapkan pemenang.
  - Urutan pemain mengikuti posisi akhir (pemenang di atas, yang kalah paling awal di bawah).
  - Setelah match selesai, tampil **hasil akhir**: Juara, Runner-up 1, Runner-up 2, beserta poinnya.

### 🏆 Leaderboard
- Dua tab: **Bulanan** dan **All Time**.
- Di tab Bulanan bisa geser ke bulan-bulan sebelumnya.
- **Juara 1, 2, 3 tampil di podium**, sisanya di daftar di bawahnya.
- Diurutkan berdasarkan **jumlah poin**. Pemain dengan poin yang sama mendapat peringkat yang sama.
- Nama di leaderboard bisa diklik untuk membuka profil pemain.

---

## Cara Kerja

### Alur sebuah match

```
Dealer buat match  →  Player join  →  Dealer mulai match  →  Dealer tandai yang kalah  →  Dealer tetapkan pemenang  →  Tercatat ✅
```

1. **Dealer membuat match** dari menu khusus dealer. Status match: *Menunggu player*.
2. **Player membuka menu Match**, memilih match, lalu menekan **Join Match**. Selama match belum dimulai, player masih boleh keluar dan dealer masih bisa mengeluarkan player.
3. **Dealer menekan Mulai Match** (minimal 3 pemain, supaya poin tidak bisa didapat dari match 1 lawan 1). Setelah itu tidak ada yang bisa join atau keluar.
4. Selama permainan, **dealer menekan Kalah** sesuai urutan pemain tersingkir. Kalau salah tekan, bisa di-**Undo**.
5. Saat tersisa **2 pemain**, tombol **Menang** muncul. Dealer menekan Menang pada pemenang dan mengonfirmasi. Pemain satunya otomatis menjadi Runner-up 1, dan match selesai.
6. Hasilnya langsung muncul di **riwayat**, **statistik**, dan **leaderboard** setiap pemain.

Match yang **dibatalkan** dealer tidak dihitung di statistik maupun leaderboard.

### Sistem poin

Setiap match selesai, pemain mendapat poin sesuai **peringkat akhir** dan **jumlah pemain di match itu** (N). Makin banyak lawan yang dikalahkan, makin besar poinnya.

| Peringkat | Poin |
| --- | :---: |
| 🏆 Juara | **2 × N** |
| 🥈 Runner-up 1 (kalah paling akhir) | **N** |
| 🥉 Runner-up 2 (kalah kedua dari akhir) | **N ÷ 3**, dibulatkan (hanya kalau minimal 4 pemain) |
| Pemain lain | 0 |

| Jumlah pemain | 🏆 Juara | 🥈 Runner-up 1 | 🥉 Runner-up 2 |
| :---: | :---: | :---: | :---: |
| 3 | 6 | 3 | 0 |
| 4 | 8 | 4 | 1 |
| 5 | 10 | 5 | 2 |
| 6 | 12 | 6 | 2 |
| 7 | 14 | 7 | 2 |
| 8 | 16 | 8 | 3 |

Kenapa begini:

- **Tidak ada lonjakan.** Setiap tambahan 1 pemain menambah 2 poin untuk juara, jadi tidak ada ukuran meja yang tiba-tiba jauh lebih menguntungkan.
- **Rata-rata poin per pemain stabil** di sekitar 3 poin per match untuk semua ukuran meja, jadi main di meja kecil atau besar sama adilnya.
- **Juru kunci tidak dapat poin.** Di meja 3 orang, runner-up 2 adalah pemain terakhir, jadi tidak diberi poin.
- Match butuh **minimal 3 pemain**, jadi poin tidak bisa didapat dari match 1 lawan 1.

Poin disimpan saat match selesai, jadi perubahan aturan tidak mengubah poin match lama. Match yang selesai sebelum 27 Oktober 2026 tetap memakai aturan lama (juara 10, runner-up 1 5, runner-up 2 1).

Di halaman match yang belum selesai, tampil poin yang akan didapat sesuai jumlah pemain saat itu.

Membuat match sebagai player memakai **1 poin**:

- Kalau poin bulan ini **minimal 1**, potongan mengurangi **total poin dan poin bulan ini**.
- Kalau poin bulan ini masih **0** (mis. awal bulan), potongan hanya mengurangi **total poin**, jadi poin bulanan tidak pernah minus.
- Kalau match dibatalkan, poinnya dikembalikan.

Peringkat ditentukan dari **urutan dealer menekan Kalah**, jadi pastikan tombol Kalah ditekan sesuai urutan pemain tersingkir. Itulah sebabnya pemenang baru bisa ditetapkan saat tersisa 2 pemain.

### Aturan duel

```
Player A ajak duel  →  Player B terima  →  Dealer setujui & host  →  Dealer tetapkan pemenang  →  Poin berpindah ✅
```

- **Taruhan ditahan** sejak ajakan dikirim (penantang) dan sejak ajakan diterima (lawan).
- **Pemenang mendapat taruhan lawan** (+taruhan), yang kalah kehilangan taruhannya (−taruhan). Total poin di liga tidak bertambah, hanya berpindah, jadi duel tidak bisa dipakai untuk mencetak poin.
- Taruhan **dikembalikan** kalau ajakan ditolak, dibatalkan sebelum disetujui dealer, ditolak dealer, atau dibatalkan dealer host.
- Taruhan maksimal adalah total poin yang lebih kecil di antara kedua pemain. Hanya boleh ada satu duel aktif antara dua pemain yang sama.
- Duel **hanya memengaruhi total poin** dan leaderboard All Time. **Poin bulan ini dan leaderboard bulanan tidak berubah**, jadi persaingan bulanan tetap murni dari hasil match.
- Duel tidak dihitung ke statistik match (match dimainkan, menang, win rate). Duel punya statistiknya sendiri di tab Duel.

### Bagaimana statistik dihitung

Statistik **tidak disimpan sebagai angka**. Statistik dihitung ulang dari riwayat match setiap kali halaman dibuka, jadi angkanya selalu sesuai dengan match yang benar-benar terjadi.

| Statistik       | Dihitung dari                                                |
| --------------- | ------------------------------------------------------------ |
| Match dimainkan | Jumlah match **selesai** yang diikuti pemain                 |
| Match menang    | Jumlah match selesai di mana pemain menjadi **pemenang**     |
| Win rate        | Match menang ÷ match dimainkan × 100%                        |
| Poin bulan ini  | Total poin dari match yang selesai di bulan berjalan         |
| Total poin      | Poin dari semua match + hasil duel − biaya membuat match     |
| Leaderboard     | Total poin per pemain, untuk bulan terpilih / all time       |
| Match di-host   | Jumlah match **selesai** yang dibuat dealer                  |

### Peran Player vs Dealer

|                                         | Player | Dealer |
| --------------------------------------- | :----: | :----: |
| Lihat statistik, match & leaderboard    |   ✅   |   ✅   |
| Join / keluar dari match                |   ✅   |   –    |
| Buat match                              | ✅ (1 poin) | ✅ (gratis) |
| Mulai & batalkan match yang dibuat sendiri |   ✅   |   ✅   |
| Tandai pemain kalah & tetapkan pemenang (di match sendiri) |   ✅   |   ✅   |
| Ajak duel & terima/tolak ajakan duel    |   ✅   |   –    |
| Setujui, tolak & host duel              |   –    |   ✅   |

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
  pages/        Beranda, Leaderboard, Match, Match Room, Pemain, Buat Match, Login/Daftar, Reset password
  components/   Layout (header + bottom nav) dan komponen UI
  lib/          Supabase client, auth context, helper format
supabase/
  schema.sql    Tabel, RLS, fungsi database, realtime
```

</details>
