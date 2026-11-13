// ID tabel dan field Program Kerja di base BPK (appIGR8Duhj3Vsz48), dibuat Tahap 3.
export const T_PROGRAM = "tblUZqe32gVVPUuOg";
export const T_ANGGARAN = "tblueDU9Fs8Xhfk0f";
export const T_SETUJU = "tblqGl1NcxjsJHC7x";
export const T_NOTIF = "tbltOykEIlKWAPhGL";

export const PK = {
  nama: "fldukdyofqeOtI2zF",
  detail: "flde0Ng5ELRr94nvU",
  seksiPengaju: "fld3gpqZR1AA0e4DZ",
  bidang: "fldpYKfmhnRFdVzLt",
  mulai: "fldKLZJwkajZhzckO",
  seksiTerlibat: "fldFrxKG79NX05e2c",
  modeAnggaran: "fldVM2Iz5HzUX72iF",
  totalAnggaran: "fldKmS1b4A7vGypUO",
  status: "fldkVSLguGusqG9ME",
  dibuatOleh: "fldnJM9EqpUQMrNWt",
  waktuDibuat: "fldHc4za7jQhpaWQU",
} as const;

export const AG = {
  keterangan: "fldCUJS0e9qUWyr9d",
  programId: "fldvlC87sbMRo1p5P",
  jenis: "fldUk2mPl8LWxDQXa",
  nominal: "fldy18Meq3T5JPact",
} as const;

export const ST = {
  ringkasan: "fldnRWCpbDBPurlC5",
  programId: "fldj5wsQu5leFzQQ3",
  tahap: "fldhNY2pMqrjoDLCw",
  seksi: "fldqC0ZADZ92YUqai",
  keputusan: "fldr9MeFwxyyO7QfM",
  oleh: "fldYgpgtdToXEyhsI",
  waktu: "fldntiK2AsGWP38jj",
  catatan: "fldYfBX9FmPyHcgKn",
} as const;

export const NT = {
  pesan: "fldtOjqXSuW5oQq6K",
  penerima: "fldPpx5xp61aiEGug",
  tautan: "fldq54IWpghZTi1AK",
  dibaca: "fldA6GlD62cASs0m1",
  waktu: "fldZV42Q5OTj6xXup",
} as const;

export const STATUS = [
  "Draft", "Menunggu Koord Bidang", "Menunggu Kolaborasi", "Menunggu Sekjen",
  "Disetujui", "Berjalan", "Selesai", "Ditolak",
] as const;
export type StatusProgram = (typeof STATUS)[number];

export const JENIS = ["Pemasukan", "Pengeluaran"] as const;
export type JenisAnggaran = (typeof JENIS)[number];

/** Realisasi pengeluaran terhadap anggaran program (base BPK). Tiap baris punya padanan baris di Mutasi (base Bendahara). */
export const T_REALISASI = "tbl3RgGLiFVN6Zc0l";
export const RZ = {
  programId: "fldXpo8SuQQuyGWae",
  tanggal: "fldKUEidGANAEorl0",
  nominal: "fld2zsLvtKGu41UZI",
  keterangan: "fldLsgqK6c8heCh9a",
  penerima: "fldc7ba1kob8HxQHQ",
  mutasiId: "fldsj3Al8VGw4eyig",
  oleh: "fldfZAWzrj2oGtZNi",
} as const;
