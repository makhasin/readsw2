WhatsApp Auto-Reactor & AI Chat Bot

Repository ini berisi script bot WhatsApp untuk:

1. Auto react pada story


2. Chat AI di private chat



Fitur

Auto React Story: Bot akan otomatis memberikan reaksi (emoji) pada setiap story kontak yang Anda lihat.

AI Private Chat: Bot akan merespon pesan personal dengan kecerdasan buatan.


Persyaratan

Node.js v20 atau lebih baru

npm (Node Package Manager)

Akun WhatsApp terhubung via Baileys


Cara Pasang

1. Clone repository

git clone https://github.com/Nazir99inf/readsw


2. Masuk ke direktori project

cd readsw


3. Install dependencies

npm install


4. Jalankan Bot

npm start



Konfigurasi

1. Buka file settings.js dan atur pengaturan sesuai kebutuhan Anda:

global.settings = {
    autoread: true,
    anticall: true,
    autoreact: true
}

global.emoji = [
    "🗿", 
    "💩",
    "👌", 
    "💥",
    "🔥", 
    "🦍",
    "🖕",
    "👀",
    "💦",
    "🥳",
    "🎶",
    "💌",
    "🔥"
]


2. Pastikan file session.json (hasil QR scan) tersimpan di direktori yang sama.



Contoh Penggunaan

Setelah npm start, buka WhatsApp Web dan scan QR code. Bot akan online dan:

Mengirim reaksi otomatis pada setiap story yang muncul.

Merespon chat personal dengan AI.


# Langkah ringkas:
1. git clone https://github.com/Nazir99inf/readsw
2. cd readsw
3. npm install
4. npm start

Struktur Folder

readsw/
├── node_modules/        # Dependencies
├── index.js             # System & Socket
├── settings.js            # Settings
├── package.json
└── README.md

Lisensi

MIT © 2025 NAZIR

