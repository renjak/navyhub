# NAVYHUB — KRI Alamang-644

Repository ini ditetapkan oleh pemilik project sebagai **repository utama NAVYHUB** untuk pemulihan, pengembangan, dan integrasi aplikasi Next.js yang terhubung ke Supabase dan Vercel.

## Struktur aplikasi
- Source aplikasi Next.js berada di folder `src/`.
- Project Vercel `navyhub` terhubung ke repository ini.
- Backend aktif menggunakan Supabase project yang telah dikonfigurasi melalui environment variables Vercel.
- Jangan menaruh kredensial, service-role key, password, atau secret produksi di repository.

## Recovery archive
File `recovery/NAVYHUB_source_recovery_backup.zip` adalah snapshot lama NAVYHUB v0.1.0 berbasis Prisma/PostgreSQL. Arsip tersebut hanya bahan referensi pemulihan dan **bukan** source aplikasi Supabase yang harus di-deploy secara langsung.

## Aturan pengembangan wajib
1. Pertahankan Supabase Auth, schema, data, RLS, role, policy, trigger, dan fungsi database yang sudah ada kecuali ada rencana migrasi yang disetujui.
2. Jangan menimpa atau menghapus data yang sudah tersimpan.
3. Semua perubahan aplikasi dilakukan di feature branch dan diverifikasi melalui preview Vercel sebelum merge.
4. Jangan mempromosikan deployment produksi tanpa persetujuan eksplisit pemilik.
5. Fitur yang belum selesai harus diberi status belum tersedia; jangan tampilkan data contoh sebagai data nyata.
6. Sebelum menambah dependency, periksa versi Next.js, React, dan kompatibilitas paket.

## Data
Data operasional NAVYHUB berada di Supabase, bukan di file backup ZIP. Aplikasi harus membaca dan menulis data melalui Supabase client dengan kebijakan RLS yang berlaku.

## Visual direction
Arah desain saat ini: **Black Smoke / Silver Crystal Glassmorphism** — latar charcoal-black, panel smoky translucent, refraction/blur, silver rim highlights, floating controls, dan responsive layout.
