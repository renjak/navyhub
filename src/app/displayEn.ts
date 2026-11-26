/* English display labels for values stored in the database in Indonesian.
   Stored values are never changed (filters, RLS, PHST parsing and history
   keep working); only what is shown on screen is translated. Free text typed
   by users or taken from PHST source documents is shown as written. */

const VALUES: Record<string, string> = {
  // supply categories
  "Air Tawar": "Fresh water", "BBM": "Fuel (HSD)", "HSD": "HSD", "Amunisi": "Ammunition", "Bahan Bakar Skoci": "Rescue boat fuel", "Logistik": "Logistics",
  // PHST sections and app categories
  "A. SITUASI": "A. Situation", "B. TUGAS POKOK": "B. Main task", "C. UMUM": "C. General", "D. KHUSUS": "D. Special",
  "E. LAIN-LAIN": "E. Other", "F. LAIN-LAIN": "F. Other", "PHST META": "PHST metadata", "Umum": "General", "Tugas Pokok": "Main task",
  // statuses
  "draft": "Draft", "done": "Done", "submitted": "Submitted", "verified": "Verified", "approved": "Approved", "pending": "Pending",
  "reported": "Reported", "in_progress": "In progress", "completed": "Completed", "deferred": "Deferred", "planned": "Planned", "cancelled": "Cancelled",
  "issue": "Finding", "not_done": "Not done", "pass": "Done", "fail": "Finding", "not_applicable": "N/A",
  "inbound": "In", "outbound": "Out", "ready": "Ready", "unready": "Not ready",
  // watch types and duty roles
  "harian": "Daily", "Harian": "Daily", "Jaga Laut": "Sea watch", "Jaga Darat": "Harbour watch", "Jaga": "Watch",
  "Perwira Jaga": "Officer of the watch", "Komandan": "Commander", "KKM": "Chief engineer",
  // PHST duty metadata keys
  "Divisi Jaga": "Watch division", "Bintara Jaga": "Duty NCO", "Caraka": "Messenger", "Tenue Jaga": "Watch uniform",
  // asset condition
  "Baik": "Good", "Perlu Perhatian": "Needs attention", "Rusak Ringan": "Minor damage", "Rusak Berat": "Major damage",
  // departments
  "OPERASI": "Operations", "MESIN": "Engineering", "SENJATA": "Weapons", "ELEKTRONIKA": "Electronics", "LOGISTIK": "Logistics",
  // units, readiness, purposes, countries
  "butir": "rounds", "liter": "litres", "unit": "unit", "Tingkat I": "Level I", "Tingkat II": "Level II", "Tingkat III": "Level III",
  "PENERIMAAN": "RECEIPT", "PENGELUARAN": "ISSUE", "SPANYOL": "SPAIN",
  // checklist template categories, roles and locations
  "Teknis": "Technical",
  "Anjungan / Navigasi": "Bridge / Navigation", "Anjungan / Ruang Komando": "Bridge / Command room", "Geladak kerja / Gudang logistik": "Work deck / Logistics store",
  "Gudang kering / Gudang dingin": "Dry store / Cold store", "Gudang kering / Gudang dingin / Dapur": "Dry store / Cold store / Galley", "Gudang logistik / Dapur": "Logistics store / Galley",
  "Kamar mesin": "Engine room", "Tangga kapal / Geladak kerja": "Gangway / Work deck",
  // checklist template titles
  "Serah terima jaga dermaga": "Harbour watch handover", "Pemeriksaan mesin induk dan genset": "Main engine and generator check", "Penerimaan bekal ulang": "Resupply receipt",
  "Pengambilan bahan makan siang": "Lunch provisions issue", "Uji radar navigasi dan radio komunikasi": "Navigation radar and radio test", "Pemeriksaan pompa bilga no. 2": "Bilge pump no. 2 check",
  "Opname stok dan suhu ruang pendingin": "Stock take and cold room temperature", "Pengambilan bahan makan malam": "Dinner provisions issue", "Serah terima jaga malam": "Night watch handover",
  "Rekap dan pengawasan kegiatan harian": "Daily activity summary and supervision",
  // checklist template descriptions
  "Pemeriksaan fungsi perangkat navigasi dan komunikasi di anjungan.": "Function check of navigation and communication equipment on the bridge.",
  "Pemeriksaan harian kamar mesin berdasarkan parameter pada sumber DIKO.": "Daily engine room check against the parameters in the DIKO source.",
  "Pemeriksaan tekanan keluaran pompa bilga dan pencatatan temuan.": "Check bilge pump discharge pressure and record findings.",
  "Pencatatan pengeluaran bahan dari gudang untuk konsumsi awak.": "Record provisions issued from the store for the crew.",
  "Pencatatan pengeluaran bahan makan malam untuk konsumsi awak.": "Record dinner provisions issued for the crew.",
  "Pencocokan stok fisik dan pemeriksaan suhu ruang pendingin.": "Reconcile physical stock and check cold room temperature.",
  "Penerimaan logistik dari dermaga dan penyimpanan di gudang kering / dingin.": "Receive logistics from the pier and store in the dry / cold store.",
  "Pengecekan jaga malam dan kondisi kapal di dermaga.": "Night watch check and ship condition at the pier.",
  "Pengecekan setelah serah terima jaga pukul 07.30. Selesaikan sebelum penetapan petugas jaga pukul 07.45.": "Check after the 07:30 watch handover. Complete before the 07:45 duty officer assignment.",
  "Tinjau penyelesaian pengecekan, temuan, dan paraf petugas.": "Review completed checks, findings and officer initials.",
  // checklist template instructions
  "Periksa kondisi tali tambat, tangga kapal, cuaca, dan kejadian menonjol.": "Check mooring lines, gangway, weather and notable events.",
  "Catat hasil aktual suhu air pendingin, tekanan oli, kondisi kebocoran, beban genset 1, dan uji start genset 2.": "Record actual cooling water temperature, oil pressure, leaks, generator 1 load and the generator 2 start test.",
  "Cocokkan jumlah fisik dengan dokumen kiriman; periksa kualitas, suhu terima ayam, dan pengisian air tawar.": "Match physical quantities with the delivery documents; check quality, chicken receiving temperature and fresh water filling.",
  "Catat jumlah beras, ayam potong, dan galon air minum yang dikeluarkan.": "Record the rice, chicken and drinking water bottles issued.",
  "Pastikan sapuan radar dan uji hubungan radio; catat hasil aktual dan gangguan jika ada.": "Confirm the radar sweep and radio link test; record actual results and any faults.",
  "Ukur tekanan aktual dan bandingkan dengan batas minimum 2,5 bar pada skenario sumber; laporkan bila di bawah batas.": "Measure actual pressure and compare it with the 2.5 bar minimum in the source scenario; report if below the limit.",
  "Cocokkan stok beras, ayam potong, dan galon dengan catatan; ukur suhu dan bandingkan dengan batas −18 °C.": "Reconcile rice, chicken and water bottle stock with the records; measure temperature and compare with the −18 °C limit.",
  "Catat jumlah bahan makan malam yang dikeluarkan dari gudang.": "Record the dinner provisions issued from the store.",
  "Periksa ulang tali tambat, penerangan dermaga, dan lampu kapal.": "Recheck mooring lines, pier lighting and ship lights.",
  "Tinjau seluruh checklist hari ini, catatan temuan terbuka, dan status penyelesaian.": "Review all of today's checklists, open findings and completion status.",
  // checklist template items
  "Ayam potong diterima; kualitas dan suhu dicatat": "Chicken received; quality and temperature recorded", "Beban genset 1 dibaca dan dicatat": "Generator 1 load read and recorded",
  "Beras diterima dan dicatat": "Rice received and recorded", "Cuaca dan kejadian menonjol dicatat": "Weather and notable events recorded",
  "Galon air minum diterima dan dicatat": "Drinking water bottles received and recorded", "Hasil dibandingkan dengan batas minimum 2,5 bar": "Result compared with the 2.5 bar minimum",
  "Jumlah ayam potong yang dikeluarkan dicatat": "Chicken issued recorded", "Jumlah bahan makan malam yang dikeluarkan dicatat": "Dinner provisions issued recorded",
  "Jumlah beras yang dikeluarkan dicatat": "Rice issued recorded", "Jumlah fisik dicocokkan dengan dokumen kiriman": "Physical quantity matched with delivery documents",
  "Jumlah galon air minum yang dikeluarkan dicatat": "Drinking water bottles issued recorded", "Kelengkapan catatan dan paraf ditinjau": "Records and initials reviewed for completeness",
  "Kondisi kebocoran oli / bahan bakar diperiksa": "Oil / fuel leaks checked", "Lampu kapal diperiksa": "Ship lights checked", "Penerangan dermaga diperiksa": "Pier lighting checked",
  "Pengisian air tawar tangki dicatat": "Fresh water tank filling recorded", "Sapuan radar diperiksa dan hasil dicatat": "Radar sweep checked and result recorded",
  "Status seluruh checklist harian ditinjau": "Status of all daily checklists reviewed", "Stok fisik ayam potong dicocokkan dengan catatan": "Physical chicken stock matched with records",
  "Stok fisik beras dicocokkan dengan catatan": "Physical rice stock matched with records", "Stok fisik galon air minum dicocokkan dengan catatan": "Physical water bottle stock matched with records",
  "Suhu air pendingin dibaca dan dicatat": "Cooling water temperature read and recorded", "Suhu ruang pendingin diukur dan dicatat; bandingkan batas −18 °C": "Cold room temperature measured and recorded; compare with the −18 °C limit",
  "Tali tambat diperiksa dan kondisinya dicatat": "Mooring lines checked and condition recorded", "Tali tambat diperiksa ulang": "Mooring lines rechecked",
  "Tangga kapal diperiksa dan kondisinya dicatat": "Gangway checked and condition recorded", "Tekanan keluaran pompa bilga no. 2 diukur dan dicatat": "Bilge pump no. 2 discharge pressure measured and recorded",
  "Tekanan oli dibaca dan dicatat": "Oil pressure read and recorded", "Temuan di bawah batas dilaporkan untuk tindak lanjut": "Findings below the limit reported for follow-up",
  "Temuan teknis terbuka ditinjau": "Open technical findings reviewed", "Uji hubungan radio dilaksanakan dan hasil dicatat": "Radio link test carried out and result recorded",
  "Uji start genset 2 dilaksanakan dan dicatat": "Generator 2 start test carried out and recorded",
  // inventory item names
  "Persediaan Air Tawar Kapal": "Ship fresh water supply", "Persediaan BBM Kapal": "Ship fuel supply", "HAMPA": "BLANK",
  // department names
  "Operasi": "Operations", "Mesin": "Engineering", "Senjata": "Weapons", "Elektronika": "Electronics",
  // checklist summaries written by the app
  "Pengecekan harian LOGBOOK": "LOGBOOK daily check", "Seluruh item wajib telah diperiksa.": "All required items have been checked.",
  "Petugas dan kesiapan jaga": "Duty officers and watch readiness"
};

/* App-generated phrases inside longer text (older records). */
const PHRASES: Array<[RegExp, string]> = [
  [/Penyesuaian stok oleh admin melalui Dashboard/g, "Stock adjustment by Admin via Dashboard"],
  [/Penyesuaian saldo bahan bakar skoci oleh Admin/g, "Rescue boat fuel balance adjustment by Admin"],
  [/Penyesuaian jumlah liter bahan bakar skoci/g, "Rescue boat fuel litre adjustment"],
  [/Hasil sounding tangki melalui Modul 3D/g, "Tank sounding via the 3D module"],
  [/Penyesuaian saldo Air Tawar/g, "Balance adjustment fresh water"],
  [/Penyesuaian saldo /g, "Balance adjustment "],
  [/^Amonisi /, "Ammunition "], [/Pistol Isyarat/g, "Flare pistol"], [/Meriam /g, "Gun "], [/ - HAMPA$/, " - BLANK"],
  [/Temuan perlu ditindaklanjuti\./g, "Finding requires follow-up."],
  [/Prioritas tinggi:/g, "High priority:"], [/Prioritas sedang:/g, "Medium priority:"], [/Prioritas rendah:/g, "Low priority:"],
  [/^Kegiatan:/gm, "Activities:"], [/Manajemen risiko:/g, "Risk management:"],
  [/RENCANA KEGIATAN:/g, "PLANNED ACTIVITY:"], [/PERALATAN \/ BAHAN YANG DIGUNAKAN:/g, "EQUIPMENT / MATERIALS:"], [/Belum ditentukan/g, "Not specified"],
  [/^Perwira Jaga:/gm, "Officer of the watch:"], [/^Divisi Jaga:/gm, "Watch division:"], [/^Bintara Jaga:/gm, "Duty NCO:"], [/^Caraka:/gm, "Messenger:"], [/^Tenue Jaga:/gm, "Watch uniform:"]
];

/** English label for a stored enumerated value; unknown values are returned unchanged. */
export function en(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v), t = s.trim();
  if (VALUES[s] !== undefined) return VALUES[s];
  if (VALUES[t] !== undefined) return VALUES[t];
  const siaga = /^Siaga\s+([IV]+)$/i.exec(t);
  if (siaga) return "Readiness level " + siaga[1].toUpperCase();
  return s;
}

/** Translates app-generated phrases inside longer stored text; user/PHST wording is left as written. */
export function enText(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (VALUES[s.trim()] !== undefined) return VALUES[s.trim()];
  for (const [re, rep] of PHRASES) s = s.replace(re, rep);
  return s;
}

/** Department code as shown to users: OPS → DEPOPS. Stored codes stay OPS/SIN/EKA/LOG. */
export function depLabel(code: unknown): string {
  const c = String(code ?? "").trim().toUpperCase();
  return c ? (c.startsWith("DEP") ? c : "DEP" + c) : "";
}
