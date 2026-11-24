# FinKu

FinKu adalah aplikasi pencatatan keuangan pribadi berbasis HTML, CSS, dan JavaScript murni. Tidak memerlukan build tool, framework, API key, atau database server.

## Fitur

- Pemasukan, pengeluaran, dan transfer antar dompet
- Saldo dompet dan transaksi terbaru
- Anggaran per kategori berdasarkan bulan
- Target tabungan dan hutang/piutang
- Portofolio investasi BTC, saham, serta reksa dana
- Harga BTC/IDR dari CoinGecko
- Pemantauan alamat Bitcoin publik melalui Blockstream
- Backup, pemulihan, unduh aplikasi, dan reset data
- Penyimpanan browser menggunakan `localStorage`
- Tampilan responsif untuk desktop, tablet, dan perangkat seluler

## Menjalankan

### Jalankan secara lokal

```bash
python3 -m http.server 8000
```

Buka `http://localhost:8000`.

### GitHub Pages

Publikasikan repo menggunakan GitHub Pages dari cabang `main` dengan folder `/ (root)`.

## Penyimpanan Data

Seluruh data disimpan pada browser perangkat yang membuka aplikasi. Data tidak ditransmisikan ke server FinKu. Lakukan backup secara berkala melalui menu **Backup & Pemulihan**.

Menghapus cache browser atau menggunakan perangkat/browser lain dapat membuat data tidak tersedia.

## Kontribusi

Ikuti pedoman [AGENTS.md](AGENTS.md). Gunakan bahasa Indonesia untuk dokumentasi dan komunikasi proyek.
