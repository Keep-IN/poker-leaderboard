# ♠ BTP Poker League

**🔗 https://btp-poker-league.vercel.app**

BTP Poker League adalah website untuk mencatat hasil permainan poker antar teman. Setiap match yang dimainkan tercatat otomatis: siapa yang ikut, siapa yang kalah, dan siapa yang menang. Hasilnya langsung masuk ke statistik tiap pemain dan ke leaderboard bulanan maupun all time.

Ada dua jenis match: **offline** (dimainkan di meja sungguhan, host menandai siapa yang kalah) dan **online** (dimainkan langsung di meja poker website, mode turnamen).

Tampilannya dirancang untuk HP. Halaman match update secara real-time, jadi semua orang yang membuka match yang sama melihat perubahan yang sama tanpa perlu refresh.

---

## Fitur

### 👤 Akun
- Daftar cukup dengan **nama, email, dan password**, lalu langsung bisa login.
- Ada dua jenis akun: **Player** dan **Dealer**.
- Ketuk avatar di Beranda atau 👤 di header untuk membuka **Profil**: gelar podium, saldo koin, riwayat koin, pencapaian, statistik, dan pengaturan (ganti nama, ganti password, tema).

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

### 🎯 Misi
Dealer bisa membuat misi untuk semua player, dengan **deadline** dan **reward poin**. Ada dua jenis:
- **Misi duel**, misalnya *"Menangkan 2 duel dengan taruhan minimal 10 poin"*. Dealer mengisi **jumlah menang** dan **taruhan minimal**.
- **Misi match**, misalnya *"Menangkan 3 match online berturut-turut"*. Dealer memilih **match offline atau online** dan mengisi **jumlah menang beruntun** (2–20).

Detailnya:
- Misi muncul di **Beranda player** dengan progres (mis. 1/2 menang atau 🔥 2/3 beruntun) dan **timer hitung mundur** ke deadline.
- Reward **masuk otomatis** begitu target tercapai.
- Dealer bisa mengumumkan misi baru ke grup WA lewat tombol **📲 Kirim ke grup WA**.

### 💰 Bounty
- Dealer bisa **memasang bounty** ke player mana pun dengan reward poin (1–1000). Bisa banyak player sekaligus, satu bounty aktif per player.
- **Cara klaim**: menangkan match (offline atau online) yang **diikuti player buruan**. Juara match itu mendapat reward-nya. Kalau **si buruan sendiri yang juara**, dia yang mengklaim bounty-nya.
- Bounty langsung hilang setelah diklaim. Satu match bisa mengklaim beberapa bounty sekaligus kalau ada beberapa buruan di dalamnya.
- Daftar bounty muncul di **Beranda player** (player yang jadi buruan dapat peringatan khusus), dan buruan ditandai 🎯 di halaman match.
- Reward masuk ke **poin bulan ini dan total poin**. Dealer bisa membatalkan bounty atau mengirimnya ke grup WA.

### 🪙 Koin
- **Koin** adalah mata uang terpisah dari poin. Koin hanya untuk membeli skill card dan **tidak mengurangi poin leaderboard**.
- Cara dapat koin:
  - **Ikut match** (offline/online): +10, juara +15, runner-up +8, peringkat 3 +4. Otomatis masuk saat match selesai.
  - **Gaji bulanan** dari leaderboard bulan lalu: #1 100, #2 70, #3 50, #4–10 30, sisanya yang main minimal 1 match 20.
  - **Bonus peluncuran** sekali berdasarkan peringkat all time: 150 / 120 / 100 / 75 (#4–10) / 50.
  - **Pencapaian total poin**: 50 → 30 koin, 100 → 50, 250 → 80, 500 → 120.
- Gaji, bonus, dan pencapaian **diklaim** lewat tombol Klaim di Beranda atau Profil.

### 🛒 Market & 🎒 Inventory
- Player membeli **skill card** di Market pakai koin. Dealer mengatur kartu mana yang dijual, harga, dan stoknya.
- Kartu yang dibeli masuk ke **Inventory** (tombol di Beranda player).
- Kartu yang tersedia sekarang:
  - ⚡ **Double Down** (passive): pasang di halaman match **online** yang sudah kamu join sebelum match dimulai, atau lewat 🎒 di lobi meja sebelum hand pertama. Poin match itu jadi **2× lipat**. Satu per match. Kalau match batal atau kamu keluar, kartunya kembali.
  - 🪞 **Full Counter** (passive): dipasang dengan cara yang sama seperti Double Down, lalu aktif **sepanjang match**. Kalau ada yang memakai **Fold Player** atau **Reveal Card** ke kamu, serangannya berbalik: penyerang yang dipaksa fold, atau kamu yang melihat kartu penyerang. Pengumumannya cuma menyebut penyerang ("X terkena Full Counter, serangan berbalik ke arahnya"), tanpa nama yang diserang. Hanya pemiliknya yang tahu dia memasang Full Counter.
  - Passive boleh dipasang **lebih dari satu** (masing-masing satu per match), tapi tiap passive **memakai 1 dari 3 jatah kartu match itu**. Contoh: pasang Double Down + Full Counter, di meja tinggal 1 kartu.
  - 🛡️ **Defend Me** (defend): dipakai di meja online lewat tombol 🎒 saat hand berjalan. Kalau kamu kalah di hand itu, **setengah chip yang hilang dikembalikan** (diambil dari pemenang hand). Kartu yang dipakai terlihat oleh semua pemain sebelum showdown.
  - 🔄 **Card Reroll** (defend, termurah): dipakai lewat 🎒 saat hand berjalan. 2 kartu tanganmu dikembalikan ke bandar dan diganti 2 kartu baru (kartu meja tidak berubah). Diumumkan di tengah meja, dengan animasi kartu dilempar ke bandar lalu dibagi lagi.
  - 👁️ **Reveal Card** (attack): pilih satu lawan di meja, lalu **2 kartunya terlihat olehmu** sampai hand selesai (beserta nama kombinasinya). Pemakaiannya diumumkan di tengah meja, tapi **korbannya dirahasiakan**.
  - 🚫 **Fold Player** (attack): **paksa satu lawan fold**. Hanya bisa **sebelum flop** dan tidak bisa ke pemain yang sudah all-in. Chip yang sudah dia taruh tetap di pot. Langsung diumumkan ke semua pemain, dan korbannya ditandai "dipaksa fold".
  - 🍀 **Give Me A…** (luck): dipasang lewat 🎒 kapan saja selama masih ikut turnamen, lalu berlaku di **hand berikutnya**. Saat hand itu dibagi, ada peluang server menyusun kartu tanganmu dan kartu meja supaya kombinasinya terbentuk, dengan minimal satu kartu tanganmu ikut membentuknya:

    | Kartu | Peluang |
    | --- | ---: |
    | 🪜 Give Me A Straight | 70% |
    | 💧 Give Me A Flush | 70% |
    | 🏠 Give Me A Full House | 60% |
    | 🎲 Give Me A Four of a Kind | 40% |
    | 🌈 Give Me A Straight Flush | 30% |
    | 👑 Give Me A Royal Flush | 15% |
    | 👯 Pair Me Up | 100%: pocket pair (2 kartu tangan kembar), kartu meja dibagi biasa |

    Hanya **satu kartu Luck per hand di seluruh meja**: siapa yang memasang duluan, dia yang berlaku. Kartu Luck dihitung sebagai kartu hand itu. Berhasil atau tidaknya baru diberitahu ke pemiliknya setelah hand selesai. Kalau kamu tersingkir sebelum hand berikutnya, kartunya hangus.
  - ☠️ **Wildcard** (cursed, sangat mahal, stok 1, **tidak dijual sampai dealer membukanya**; tampil paling atas di Market dengan bingkai cursed). Dipakai lewat 🎒 di meja selama match berjalan, lalu **diumumkan di tengah meja setelah hand itu selesai** (jeda beberapa detik) dan dijalankan sebelum kartu dibagi lagi. **Tidak bisa dipakai kalau pemain tersisa tinggal 2**; kalau sebelum dijalankan pemakai/target tersingkir atau pemain jadi tinggal 2, wildcard batal dan kartunya kembali ke inventory. Satu wildcard menunggu sekaligus di satu meja.
    - 💸 **You Owe Me My Money**: 80% chip pemain pilihan pindah ke pemakai.
    - ⚔️ **Duel Me!**: seperti Go Big or Go Home!, **langsung berlaku di hand yang sedang berjalan** dan langsung diumumkan, tapi hanya **sebelum kartu ke-4 (turn) dibuka** (preflop atau flop). Pilih 1 lawan yang masih ikut hand; semua pemain lain dipaksa fold tanpa denda (chip yang sudah mereka taruh tetap di pot) dan jadi penonton sampai hand selesai. Lawan yang diajak duel cuma boleh call/raise: kalau fold (termasuk karena waktu habis) **50% chip-nya masuk pot**, dengan peringatan dan tombol Fold dua kali ketuk seperti Go Big. Pemakainya bebas denda. Perlu minimal 3 pemain di hand itu. Memakai jatah 1 kartu per hand.
    - 💀 **Get The F\*ck Out!**: pemain pilihan langsung tereliminasi (chip-nya hangus, peringkat di bawah semua yang masih bertahan).
    - 🔥 **Go Big or Go Home!**: beda dari wildcard lain, **langsung berlaku di hand yang sedang berjalan** dan langsung diumumkan. Sesudahnya semua lawan cuma boleh call/raise (check kalau tidak ada bet); yang fold, termasuk karena waktu habis, kehilangan **50% chip-nya ke pot**. Tombol Fold mereka diberi tanda denda dan perlu diketuk dua kali. Pemakainya bebas denda; fold karena Fold Player tidak kena denda. Memakai jatah 1 kartu per hand.
  - ✦ **Angelic** (kebalikan cursed: bingkai putih suci bersinar, stok 1, **tidak dijual sampai dealer membukanya**; tampil di Market tepat di bawah kartu cursed).
    - 😇 **Revive Card**: hidupkan lagi 1 pemain yang sudah tersingkir (boleh dirinya sendiri, jadi pemain yang tersingkir tetap bisa membuka 🎒) dengan **chip awal match**. Langsung diumumkan dengan bingkai malaikat dan suara paduan suara; pemain itu ikut lagi mulai hand berikutnya dan peringkat pemain lain yang sudah tersingkir disusun ulang. **Tidak bisa dipakai kalau pemain tersisa tinggal 2**; kalau sebelum hand berikutnya pemain jadi tinggal 2, revive batal dan kartunya kembali ke inventory. Satu revive menunggu sekaligus di satu meja.
  - **Kartu batch 3:**

    | Kartu | Jenis | Efek |
    |---|---|---|
    | 🪖 Shield | Defend | Kartu Attack pertama yang diarahkan ke kamu di hand ini ditahan (kartu penyerang hangus). Diam-diam sampai ada yang menyerang. |
    | 💤 Chip Saver | Defend | Kalau kamu fold di hand ini, setengah chip yang sudah kamu taruh kembali. |
    | 🔂 Second Chance | Defend | Kalau chip-mu habis di hand ini, kamu bertahan dengan 1 big blind. |
    | 🕳️ Blind Steal | Attack | Sebelum flop: ambil chip sebesar blind yang dipasang 1 lawan dari stack-nya. |
    | 🙈 Blindfold | Attack | Sebelum flop: 1 lawan tidak bisa melihat kartunya sendiri sampai flop. |
    | 🧊 Freeze Player | Attack | 1 lawan tidak bisa raise sampai hand selesai. |
    | 💣 Tax Collector | Attack | Ambil 10% chip lawan terkaya. |
    | ♠️ Suited Up | Luck | Hand berikutnya 2 kartu tanganmu pasti satu jenis. |
    | 🎴 Third Card | Luck | Hand berikutnya dibagi 3 kartu, otomatis disimpan 2 terbaik. |
    | 🔮 Board Peek | Luck | Lihat kartu meja berikutnya sebelum dibuka (hanya kamu). |
    | 🤴 King's Ransom | Wildcard | Di awal hand berikutnya semua lawan bayar 1 big blind ke kamu (tidak sampai membuat lawan tersingkir). |
    | 🌪️ Chaos Shuffle | Wildcard | Semua kartu tangan pemain yang masih ikut dikocok dan dibagi ulang. |
    | 💀 Death Card | Wildcard | Sebelum flop: 1 kartu yang sedang dipegang seseorang jadi kartu kematian (diumumkan). Pemegangnya yang bertahan sampai showdown kehilangan 65% chip awal hand-nya ke kombinasi terbaik lainnya. Bisa kena pemakainya sendiri; pemegang bisa fold untuk lolos. |
    | 🕊️ Guardian Angel | Angelic | 1 pemain lain di hand ini kebal tersingkir (bertahan dengan 25% chip awal hand). |
    | 💞 Share the Luck | Angelic | Kartu Luck kamu yang terpasang ikut berlaku untuk 1 pemain lain (pair/suited sejenis; kartu kombinasi meja jadi pocket pair). |
    | 💰 Chip Stack | Passive | Mulai match dengan chip awal +20%. |
    | 🧠 Card Sense | Passive | Sekali per match, saat flop kamu otomatis tahu 1 kartu lawan acak. |
    | 🧲 Lucky Charm | Passive | Peluang semua kartu Luck milikmu +15%. |

    Shield menahan semua kartu Attack (Fold Player, Reveal Card, Blindfold, Freeze Player, Blind Steal, Tax Collector); Full Counter tetap didahulukan. Wildcard dan Angelic batch ini belum dijual sampai dealer membukanya di Market.
- **Pengumuman di tengah meja**: pemakaian kartu Attack dan Wildcard ditampilkan ke semua pemain (siapa memakai kartu apa ke siapa; khusus Reveal Card tanpa nama korban). Kartu Passive, Luck, dan Defend tidak diumumkan, kecuali Card Reroll. Setiap pengumuman di tengah hand **mengulang waktu giliran** pemain yang sedang jalan dari awal.
- 🎁 **Gift dari dealer** (menu dealer **Kirim Gift** di Beranda, `/gifts`): dealer mengirim koin dan/atau skill card (1–10 per player, semua kartu termasuk wildcard) ke semua player atau player pilihan, dengan pesan opsional. Kartu gift tidak mengurangi stok market. Gift muncul di Beranda player dan masuk ke akun setelah player menekan **Klaim** (atau **Klaim semua**); koin tercatat di riwayat koin sebagai "Gift dari dealer". Dealer melihat riwayat kiriman (berapa yang sudah diklaim) dan bisa membatalkan gift yang belum diklaim.
- Kartu Defend dan Luck baru terlihat pemain lain saat kartu dibuka di akhir hand. Kalau kartu gagal dipakai (misalnya target keburu fold), kartunya kembali ke inventory.
- Batas pemakaian: 1 kartu per hand, maksimal 3 kartu per match (termasuk passive yang dipasang sebelum match).

### 👑 Podium all time
- Tiga besar leaderboard all time mendapat **bingkai avatar logam** (emas, perak, perunggu) dengan kilau berputar dan **medali peringkat**. #1 juga mendapat 👑 dan bintang berkelip. Bingkai tampil di semua tempat avatar muncul.
- Di meja online, papan nama mereka dibingkai logam berkilau dengan medali peringkat di sudutnya (#1 ditambah cahaya berdenyut).
- Gelar tampil sebagai pita logam di profil: Raja Meja, Tangan Dingin, Penantang.

### 🎩 Beranda Dealer
- Jumlah **match yang sudah di-host**.
- Tombol **Buat Match Baru**.
- Daftar **misi** yang sedang berjalan (jumlah player yang sudah selesai dan sisa waktunya), tombol **Buat misi**, dan tombol untuk membatalkan misi.
- Daftar match aktif dan riwayat hosting beserta pemenangnya.
- Daftar **🎩 Skill Bandar**: skill card khusus host yang bisa dipakai di meja online (lihat Match Online).

### 🃏 Match
- Daftar **match yang sedang aktif** dan **match yang baru selesai**, bisa dilihat semua user.
- Satu match berisi **maksimal 8 pemain**. Dealer bisa mengatur batasnya antara 3 sampai 8. Match butuh **minimal 3 pemain** untuk dimulai.
- **Halaman match real-time**:
  - Player bisa join dan keluar dari match.
  - Dealer bisa memulai match, menandai pemain yang kalah, dan menetapkan pemenang.
  - Urutan pemain mengikuti posisi akhir (pemenang di atas, yang kalah paling awal di bawah).
  - Setelah match selesai, tampil **hasil akhir**: Juara, Runner-up 1, Runner-up 2, beserta poinnya.
  - Tombol **📲 Kirim ke grup WA** membuka WhatsApp dengan pesan siap kirim: ajakan join (match baru), info pemain (match dimulai), atau juara dan poin (match selesai). Tinggal pilih grup lalu kirim.

### 🌐 Match Online
- Saat membuat match, host memilih **Offline** atau **Online**.
- Untuk match online, host menentukan **maksimal player**, **blind awal** (10/20, 25/50, 50/100, …), **chip awal** tiap player, dan **blind naik tiap berapa menit**.
- Setelah host menekan Mulai, pemain menekan **Masuk meja poker** di halaman match dan bermain Texas Hold'em langsung di website. Yang bukan pemain bisa **menonton** (kartu tertutup tidak terlihat).
- **Lobi Ready**: setelah host menekan Mulai, meja belum langsung membagi kartu. Tiap pemain menekan **Ready** (bisa dibatalkan) atau **Out** (keluar dari match). Begitu **semua pemain Ready**, muncul hitung mundur **3-2-1** lalu hand pertama dibagi. Selama lobi, Double Down bisa dipasang lewat 🎒. Host bisa **mengeluarkan** pemain yang belum Ready (misalnya tidak membuka meja) supaya match tidak tertahan. Out dan dikeluarkan butuh minimal tersisa 2 pemain.
- **Mode turnamen**: tidak ada beli chip lagi. Chip habis = tersingkir. Yang terakhir punya chip jadi juara.
- Peringkat dan poin dicatat **otomatis** oleh meja, jadi host tidak perlu menekan Kalah/Menang.
- Pemain yang tidak membuka meja atau diam terlalu lama tetap dibagi kartu, tapi otomatis check/fold. Pemain yang **AFK 4 putaran berturut-turut langsung dianggap keluar** (chip-nya hangus, peringkatnya di bawah pemain yang bust di putaran yang sama). Menekan **Main lagi** atau beraksi lagi mengulang hitungan AFK dari 0.
- **Peluang menang**: tiap pemain hanya melihat peluang menang tangannya sendiri, dalam persen, di kiri bawah meja (kartu di tangan + kartu meja melawan kartu acak sebanyak lawan yang masih main). Host match melihat peluang menang semua pemain yang masih main di pojok kanan atas. Peluang untuk host dihitung di server, jadi kartu tertutup pemain tidak pernah dikirim ke host.
- **Sorotan showdown**: saat kartu dibuka, kombinasi 5 kartu terbaik tiap pemain yang belum fold disorot bergantian (kartu naik dan menyala, kartu lain meredup), mulai dari kombinasi terlemah sampai pemenang. Cap "Menang" baru muncul di giliran pemenang. Tiap pemain disorot **3 detik**. Showdown hand terakhir (penentu juara) juga diputar, lalu muncul pengumuman besar **🏆 Winner: nama juara** di tengah meja sebelum daftar hasil turnamen.
- **Chat bubble**: pemain bisa kirim pesan singkat atau emoji (tombol 💬 di kanan panel bawah; kolom ketik tertutup lagi setelah pesan terkirim). Pesan muncul sebagai bubble di atas kursi pengirim lalu hilang sendiri. Chat tidak disimpan di database (lewat Supabase Realtime), maksimal 60 huruf, jeda 2 detik, dan maksimal 5 pesan per 30 detik supaya tidak bisa spam. Host match juga bisa chat (bubble-nya muncul di dekat bandar dengan label HOST). Penonton lain bisa membaca tapi tidak bisa mengirim.
- **Auto Fold / Auto Check / Any Call**: selama hand berjalan dan belum giliranmu, ada tiga tombol pre-action (ketuk lagi untuk mematikan). Pilihannya disimpan di server, jadi tetap jalan walau koneksi putus atau kamu AFK. **Auto Fold** = check kalau gratis, fold kalau ada taruhan (batal sendiri kalau fold kena denda Go Big/Duel). **Auto Check** = check terus, otomatis mati begitu ada yang bet/raise. **Any Call** = ikut call berapa pun taruhannya. Berlaku sampai hand selesai.
- **Suara**: tombol **SFX** (efek suara: kartu, chip, ketukan check, all-in, menang) dan **BGM** (musik jazz kasino: walking bass, Rhodes, brush drum, vibraphone) di pojok kanan atas, masing-masing bisa dimatikan sendiri dan diingat browser. Semua suara dibuat langsung di browser (Web Audio), tanpa file audio. Musik mengecil sebentar saat ada all-in, kemenangan, atau Revive, dan berhenti saat tab disembunyikan.
- **🎩 Skill Bandar**: host match online (yang tidak ikut main) punya skill card sendiri lewat tombol 🎩 di meja. Gratis dan tanpa batas, tapi **maksimal 1 per hand**, dan setiap pemakaian diumumkan besar di tengah meja dengan cap HOST.

  | Skill | Kapan | Efek |
  |---|---|---|
  | 💰 Double Payout | Saat hand berjalan | Pot saat itu **langsung dikali 2** (tiap side pot ikut digandakan). |
  | 🎰 Jackpot Hand | Saat hand berjalan | Tambah 10× big blind ke pot. |
  | 🃏 Open Hand | Saat hand berjalan | Semua kartu pemain di hand ini terbuka untuk semua orang. |
  | 🌀 Board Reroll | Setelah flop | Kartu meja yang sudah terbuka diganti kartu baru. |
  | ⏱️ Speed Round | Kapan saja | Waktu giliran 10 detik di hand ini (atau hand berikutnya kalau dipakai di antara hand). |
  | 🤐 Silence | Kapan saja | Skill card pemain dikunci di hand ini (atau hand berikutnya). |
  | 📈 Blind Up | Kapan saja | Blind naik 1 level, berlaku mulai hand berikutnya. |
  | 🤯 All-in Madness | Kapan saja | Hand berikutnya semua pemain otomatis all-in, kartu dibuka, board dibuka bertahap. |
  | 🎯 Bounty | Kapan saja | Tandai 1 pemain (ikon 🎯 di kursinya). Pemain yang menang chip terbanyak di hand saat dia tersingkir dapat bonus 50% chip awal. |
  | 🎁 Charity | Kapan saja | Pemain dengan chip paling sedikit dapat 50% chip awal. |
  | 🎡 Lucky Spin | Kapan saja | 1 pemain acak dapat kartu Luck gratis (acak) untuk hand berikutnya, kalau belum ada kartu Luck yang menunggu. |
  | 🎲 Double or Nothing | Saat hand berjalan | Saat hand selesai, undian 50:50: pot dikali 2, atau tinggal setengah (separuhnya hangus). Hasilnya diumumkan. |
  | 💥 Split Pot | Saat hand berjalan | Kalau sampai showdown, pot dibagi rata ke 2 kombinasi terbaik (tanpa side pot). |
  | 🏦 Insurance | Saat hand berjalan | Pemain yang kalah all-in di hand ini dapat kembali 25% chip yang dipertaruhkan (bisa menyelamatkan dari tersingkir). |
  | 🔦 Spotlight | Saat hand berjalan | 1 kartu tangan pemain pilihan host dibuka ke semua orang. |
  | 🧊 Freeze | Kapan saja | 1 pemain tidak bisa raise di hand ini (atau hand berikutnya). |
  | 🔥 Hot Seat | Kapan saja | Kalau pemain yang ditandai menang chip di hand itu, tiap pemain lain bayar dia 1 big blind. |
  | 🎤 Shot Clock Duel | Kapan saja | 2 pemain pilihan host cuma punya 5 detik per giliran di hand itu. |
  | 👑 Chip Leader Tax | Kapan saja | Pemain dengan chip terbanyak bayar 10% chip-nya, dibagi rata ke pemain lain yang masih bertahan. |
  | 🔀 Seat Shuffle | Kapan saja | Semua pemain pindah kursi acak (dealer juga acak) mulai hand berikutnya. |
  | 🎁 Mystery Box | Kapan saja | 1 pemain acak dapat 1 skill card acak gratis, langsung masuk inventory-nya. |
  | 🎆 Final Table | Pemain tinggal 3 | Meja menyala merah-emas dan musik jazz makin cepat sampai juara ditemukan. |
  | 🙃 Upside Down | Saat hand berjalan | Di showdown hand ini kombinasi **terlemah** yang menang (sorotan showdown ikut terbalik). |
  | ➕ Bonus River | Sebelum river | Hand ini punya 6 kartu meja; kombinasi terbaik tetap 5 kartu. |
  | 👻 House Hand | Sebelum flop | Bandar ikut dibagi 2 kartu terbuka. Kalau kombinasi bandar mengalahkan semua pemain di showdown, separuh pot hangus. |
  | 💸 Mandatory Ante | Saat hand berjalan | Semua yang masih ikut hand setor 5% chip ke pot (di luar taruhan ronde). |
  | 🪙 Coin Drop | Saat hand berjalan | Pemenang hand ini dapat 20 **koin aplikasi** (tercatat "Hadiah dari meja"). |
  | 🔮 Prediction | Saat hand berjalan | Pemain yang sudah tersingkir atau fold menebak pemenang hand ini; tebakan benar dapat 10 koin aplikasi. |
  | 🌑 Blackout | Kapan saja | Semua pemain tidak bisa melihat kartunya sendiri sampai flop (hand ini kalau masih pre-flop, atau hand berikutnya). |
  | 🎭 Masquerade | Kapan saja | Nama semua pemain disembunyikan (???) selama 1 hand; host tetap melihat nama. |
  | 🎲 Dice Blinds | Kapan saja | Dadu dilempar: blind hand berikutnya dikali 1–6. |
  | 🌧️ Chip Rain | Kapan saja | Semua pemain yang masih bertahan dapat bonus 10% chip awal. |
  | 🗳️ Revenge Vote | Ada yang tersingkir | Pemain yang sudah tersingkir voting 1 pemain yang masih bertahan; yang suaranya terbanyak kehilangan 10% chip (hangus) saat hand berikutnya dimulai. |

  Chip bonus dari Double Payout, Jackpot, Bounty, Charity, Double or Nothing (kalau menang), dan Insurance dibuat oleh bandar (menambah total chip di meja).
- Meja poker diadaptasi dari [Meja Hold'em](https://github.com/ragila/meja-holdem) karya Ragil.

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
   - ⏱ **Timer mulai otomatis (opsional):** saat membuat match, atau nanti di halaman match, host bisa memilih 5/10/15/30 menit, 1 jam, atau jam tertentu (maks 14 hari). Halaman match dan daftar match menampilkan hitung mundurnya, dan jadwalnya ikut di pesan ajakan WA. Saat waktunya tiba dan pemain sudah minimal 3, match dimulai sendiri; kalau belum cukup, match tetap menunggu dan langsung dimulai begitu pemain ke-3 join. Host tetap bisa mulai lebih awal, mengubah, atau menghapus timer. Yang memulai: halaman siapa pun yang sedang membuka match/daftar match, dan **tiap menit oleh pg_cron** kalau extension `pg_cron` diaktifkan di Supabase (Database → Extensions), supaya match tetap mulai walau tidak ada yang membuka website.
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

**Match online mendapat setengah poin match offline**: Juara **N**, Runner-up 1 **N ÷ 2**, Runner-up 2 **N ÷ 6** (dibulatkan, hanya kalau minimal 4 pemain). Contoh 8 pemain: offline 16 / 8 / 3, online 8 / 4 / 1.

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

Aturan ini berlaku untuk **semua match**, termasuk yang dimainkan sebelum aturan ini ada. Pada 27 Oktober 2026, poin semua match lama dihitung ulang dari aturan sebelumnya (juara 10, runner-up 1 5, runner-up 2 1) ke rumus ini. Poin disimpan saat match selesai, jadi kalau aturan diubah lagi nanti, poin match lama hanya berubah kalau sengaja dihitung ulang.

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
- Duel memengaruhi **poin bulan ini dan total poin**, sama seperti biaya membuat match:
  - Kalau poin bulan ini cukup, taruhan diambil dari poin bulan ini dan total poin. Contoh: poin bulan ini 20, total 20, kalah taruhan 10 → **10 dan 10**.
  - Kalau poin bulan ini kurang atau 0, poin bulan ini berkurang sebanyak yang ada (sampai 0) dan sisanya hanya dari total poin, jadi **poin bulan ini tidak pernah minus**.
  - Pemenang mendapat **+taruhan** di total poin, dan di poin bulan ini sebanyak poin bulanan yang benar-benar hilang dari lawannya. Jadi poin bulanan juga hanya berpindah, tidak tercipta dari duel.
- Duel tidak dihitung ke statistik match (match dimainkan, menang, win rate). Duel punya statistiknya sendiri di tab Duel.

### Aturan misi

- Yang dihitung hanya duel atau match yang **selesai setelah misi dibuat dan sebelum deadline**. Duel dan match lama tidak ikut dihitung.
- **Misi duel**: hanya duel yang **dimenangkan** dengan taruhan **minimal sebesar syarat misi**.
- **Misi match**: player harus menang beberapa match **berturut-turut**, khusus match **offline** atau khusus match **online** sesuai pilihan dealer. Kalah di match yang dihitung membuat streak mulai lagi dari 0. Match jenis lain dan match yang tidak diikuti player itu tidak memutus streak-nya. Peringkat 2 dan 3 tetap dihitung kalah untuk streak.
- Reward masuk otomatis ke **poin bulan ini dan total poin** saat duel yang memenuhi target selesai. Setiap player hanya bisa mendapat reward **sekali per misi**.
- Semua player bisa mengerjakan misi yang sama, dan semua yang berhasil mendapat reward.
- Kalau dealer **membatalkan misi**, misi hilang dari Beranda player. Reward yang sudah didapat tetap jadi milik player.
- Misi yang sudah lewat deadline hilang dari Beranda player.

### Bagaimana statistik dihitung

Statistik **tidak disimpan sebagai angka**. Statistik dihitung ulang dari riwayat match setiap kali halaman dibuka, jadi angkanya selalu sesuai dengan match yang benar-benar terjadi.

| Statistik       | Dihitung dari                                                |
| --------------- | ------------------------------------------------------------ |
| Match dimainkan | Jumlah match **selesai** yang diikuti pemain, terpisah untuk tab **Offline** dan **Online** |
| Match menang    | Jumlah match selesai di mana pemain menjadi **pemenang**, terpisah per tab |
| Win rate        | Match menang ÷ match dimainkan × 100%                        |
| Poin bulan ini  | Poin dari match bulan berjalan + hasil duel + reward misi & bounty − biaya membuat match di bulan itu |
| Total poin      | Poin dari semua match + hasil duel + reward misi & bounty − biaya membuat match |
| Leaderboard     | Total poin per pemain, untuk bulan terpilih / all time       |
| Match di-host   | Jumlah match **selesai** yang dibuat dealer                  |

### Peran Player vs Dealer

|                                         | Player | Dealer |
| --------------------------------------- | :----: | :----: |
| Lihat statistik, match & leaderboard    |   ✅   |   ✅   |
| Join / keluar dari match                |   ✅   |   –    |
| Buat match                              | ✅ (1 poin) | ✅ (gratis) |
| Mulai & batalkan match yang dibuat sendiri |   ✅   |   ✅   |
| Tandai pemain kalah & tetapkan pemenang (match offline sendiri) |   ✅   |   ✅   |
| Main di meja poker online               |   ✅   |   –    |
| Ajak duel & terima/tolak ajakan duel    |   ✅   |   –    |
| Setujui, tolak & host duel              |   –    |   ✅   |
| Kerjakan misi                           |   ✅   |   –    |
| Buat & batalkan misi                    |   –    |   ✅   |
| Pasang & batalkan bounty                |   –    |   ✅   |
| Klaim bounty (menang match)             |   ✅   |   –    |
| Kumpulkan koin, beli & pakai skill card |   ✅   |   –    |
| Atur kartu di Market (harga, stok, dijual) |   –    |   ✅   |

Semua akun baru otomatis menjadi **Player**. Akun dijadikan **Dealer** oleh admin melalui Supabase (Table Editor → tabel `profiles` → ubah kolom `role` menjadi `dealer`).

### Keamanan

- Data hanya bisa dilihat oleh user yang sudah login.
- Semua aksi (join, mulai match, tetapkan pemenang, dll.) dijalankan lewat fungsi di database yang **mengecek peran dan kepemilikan match**. Pemain tidak bisa mengubah hasil match atau menjadikan dirinya dealer, dan dealer hanya bisa mengatur match miliknya sendiri.
- Meja poker online berjalan di server (fungsi Vercel `api/meja.js`). Kartu dikocok dan dinilai di server, dan tiap pemain hanya menerima kartunya sendiri. State meja disimpan di tabel yang tidak bisa dibaca user, dan hasilnya hanya bisa dicatat oleh server.

---

## Teknologi

| Bagian   | Yang dipakai                                         |
| -------- | ---------------------------------------------------- |
| Frontend | React, TypeScript, Vite, Tailwind CSS                |
| Backend  | Supabase (Auth, PostgreSQL, Realtime, Row Level Security) |
| Meja online | Fungsi serverless Vercel (`api/meja.js`), mesin poker dari Meja Hold'em |
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
2. Tambahkan environment variable `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, dan `SUPABASE_SECRET_KEY` (secret key Supabase, khusus untuk server meja online, tandai **Sensitive**).
3. Deploy.

**Lokal**
```bash
cp .env.example .env   # isi URL & key Supabase
npm install
npm run dev
```

**Tes mesin poker**
```bash
node api/_lib/poker.test.js
node api/_lib/handler.test.js
```

**Struktur**
```
api/
  meja.js       Server meja poker online (fungsi Vercel)
  _lib/         Mesin turnamen Hold'em, logika API, penyimpanan Supabase, dan tesnya
public/
  meja.html     Tampilan meja poker online
src/
  pages/        Beranda, Leaderboard, Match, Match Room, Pemain, Buat Match, Login/Daftar, Reset password
  components/   Layout (header + bottom nav) dan komponen UI
  lib/          Supabase client, auth context, helper format
supabase/
  schema.sql    Tabel, RLS, fungsi database, realtime
```

</details>
