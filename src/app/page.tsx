"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const sb = createClient(supabaseUrl, supabaseKey);
const previewReadOnly = process.env.NEXT_PUBLIC_NAVYHUB_PREVIEW === "true";

type Profile = { id: string; full_name: string; rank_title: string | null; unit_id: string | null; role: string; is_active: boolean };
type Unit = { id: string; code: string; name: string };
type Log = { id: string; activity_date: string; title: string; category: string; status: string };
type Asset = { id: string; asset_code: string; asset_name: string; category: string; location_label: string | null; condition_label: string; is_active: boolean };
type Maintenance = { id: string; report_date: string; issue_description: string; action_taken: string | null; status: string; asset_id: string | null };
type Crew = { id: string; full_name: string; rank_title: string | null; nrp: string | null; position: string | null; remarks: string | null };
type Stock = { id: string; item_code: string; item_name: string; category: string; unit_of_measure: string; minimum_stock: number; stock_ready: number; stock_unready: number; brand: string | null; caliber: string | null };
type Gps = { unit_id: string; latitude: number; longitude: number; position_at: string; received_at: string; source: string; speed_knots: number | null; course_degrees: number | null; satellites: number | null; accuracy_m: number | null };

declare global { interface Window { L?: any } }

function EditableCell({ value, editable, onSave, numeric = false }: { value: string | number | null; editable: boolean; onSave: (v: string) => Promise<void>; numeric?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!editing) setDraft(value == null ? "" : String(value)); }, [value, editing]);
  async function commit() {
    if (!editing || saving) return;
    const next = draft.trim();
    if (next !== (value == null ? "" : String(value))) {
      setSaving(true);
      await onSave(next);
      setSaving(false);
    }
    setEditing(false);
  }
  if (!editable) return <span>{value == null || value === "" ? "—" : value}</span>;
  if (editing) return <input className="cell-editor" autoFocus type={numeric ? "number" : "text"} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } if (e.key === "Escape") { setDraft(value == null ? "" : String(value)); setEditing(false); } }} disabled={saving} />;
  return <button className="cell-edit" title="Klik untuk mengedit" onClick={() => setEditing(true)}>{value == null || value === "" ? "—" : value}<span>✎</span></button>;
}

function IndonesiaMap({ position }: { position: Gps | null }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled || !element.current || !window.L || map.current) return;
      const L = window.L;
      map.current = L.map(element.current, { zoomControl: true, scrollWheelZoom: true, minZoom: 3, maxZoom: 18 }).setView([-2.5, 118], 4.4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map.current);
      if (position) {
        marker.current = L.marker([position.latitude, position.longitude]).addTo(map.current).bindPopup("Posisi GPS kapal");
        map.current.setView([position.latitude, position.longitude], 8);
      }
    };
    if (window.L) start();
    else {
      if (!document.querySelector('link[data-leaflet="true"]')) {
        const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; link.dataset.leaflet = "true"; document.head.appendChild(link);
      }
      const existing = document.querySelector('script[data-leaflet="true"]') as HTMLScriptElement | null;
      if (existing) existing.addEventListener("load", start);
      else {
        const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.async = true; script.dataset.leaflet = "true"; script.onload = start; document.body.appendChild(script);
      }
    }
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!map.current || !window.L || !position) return;
    const L = window.L;
    const coords = [position.latitude, position.longitude];
    if (!marker.current) marker.current = L.marker(coords).addTo(map.current);
    else marker.current.setLatLng(coords);
    marker.current.bindPopup("Posisi GPS terbaru");
    map.current.setView(coords, Math.max(map.current.getZoom(), 7));
  }, [position?.latitude, position?.longitude, position?.position_at]);
  useEffect(() => () => { if (map.current) { map.current.remove(); map.current = null; marker.current = null; } }, []);
  return <div ref={element} className="indonesia-map" aria-label="Peta Indonesia dengan posisi GPS kapal" />;
}

const modules = [
  ["NAVYLOG", "Jurnal kegiatan", "▤"], ["NAVYMAINT", "Pemeliharaan SEWACO & PLATFORM", "⚙"],
  ["NAVYSTOCK", "Persediaan & logistik", "▣"], ["NAVYCREW", "Data personel", "♙"],
  ["NAVYCHECK", "Pemeriksaan & checklist", "☑"], ["NAVYROSTER", "Personel & jadwal jaga", "♧"],
  ["NAVYMEAL", "Bekal & konsumsi", "◉"], ["NAVYDOCS", "Dokumen & arsip", "▧"], ["NAVYFIT", "Latihan & kebugaran", "⌁"]
] as const;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [gps, setGps] = useState<Gps | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [module, setModule] = useState("Dashboard");
  const [modal, setModal] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("Umum");
  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetCategory, setAssetCategory] = useState<"SEWACO" | "PLATFORM">("SEWACO");
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [lastGpsUpdate, setLastGpsUpdate] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const canManage = profile?.role === "admin" || profile?.role === "commander";
  const canWrite = !previewReadOnly && canManage;
  const gpsFresh = !!gps && Date.now() - new Date(gps.received_at).getTime() <= 120000;

  const loadData = useCallback(async (u: User, p: Profile) => {
    if (!p.unit_id || !p.is_active) return;
    const unitResult = await sb.from("units").select("id,code,name").eq("id", p.unit_id).maybeSingle();
    setUnit(unitResult.data as Unit | null);
    const [l, a, m, c, s, g] = await Promise.all([
      sb.from("activity_logs").select("id,activity_date,title,category,status").order("activity_date", { ascending: false }).limit(8),
      sb.from("maintenance_assets").select("id,asset_code,asset_name,category,location_label,condition_label,is_active").eq("unit_id", p.unit_id).eq("is_active", true).order("asset_code"),
      sb.from("maintenance_records").select("id,report_date,issue_description,action_taken,status,asset_id").eq("unit_id", p.unit_id).order("report_date", { ascending: false }).limit(30),
      sb.from("personnel").select("id,full_name,rank_title,nrp,position,remarks").eq("unit_id", p.unit_id).order("sequence_no", { ascending: true, nullsFirst: false }).order("full_name"),
      sb.from("inventory_items").select("id,item_code,item_name,category,unit_of_measure,minimum_stock,stock_ready,stock_unready,brand,caliber").eq("unit_id", p.unit_id).eq("is_active", true).order("item_name"),
      sb.from("vessel_gps_positions").select("unit_id,latitude,longitude,position_at,received_at,source,speed_knots,course_degrees,satellites,accuracy_m").eq("unit_id", p.unit_id).maybeSingle()
    ]);
    if (l.error) setError(l.error.message); else setLogs((l.data || []) as Log[]);
    if (a.error) setError(a.error.message); else setAssets((a.data || []) as Asset[]);
    if (m.error) setError(m.error.message); else setMaintenance((m.data || []) as Maintenance[]);
    if (c.error) setError(c.error.message); else setCrew((c.data || []) as Crew[]);
    if (s.error) setError(s.error.message); else setStock((s.data || []) as Stock[]);
    if (g.error) setError(g.error.message); else setGps(g.data as Gps | null);
  }, []);

  const refresh = useCallback(async (u: User) => {
    const { data, error: profileError } = await sb.from("profiles").select("id,full_name,rank_title,unit_id,role,is_active").eq("id", u.id).maybeSingle();
    if (profileError) { setError(profileError.message); return; }
    const p = data as Profile | null;
    setProfile(p);
    if (p) await loadData(u, p);
  }, [loadData]);

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      const current = data.session?.user || null;
      setUser(current);
      if (current) await refresh(current);
      setLoading(false);
    });
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      const current = session?.user || null;
      setUser(current);
      if (!current) { setProfile(null); setUnit(null); setLogs([]); setAssets([]); setMaintenance([]); setCrew([]); setStock([]); setGps(null); setLoading(false); }
      else { setLoading(true); window.setTimeout(() => refresh(current).finally(() => setLoading(false)), 0); }
    });
    return () => listener.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!user || !profile?.unit_id) return;
    const channel = sb.channel("navyhub-live-gps")
      .on("postgres_changes", { event: "*", schema: "public", table: "vessel_gps_positions", filter: `unit_id=eq.${profile.unit_id}` }, payload => {
        if (payload.new && Object.keys(payload.new).length) setGps(payload.new as Gps);
        if (payload.eventType === "DELETE") setGps(null);
      }).subscribe();
    const poll = window.setInterval(async () => {
      const { data } = await sb.from("vessel_gps_positions").select("unit_id,latitude,longitude,position_at,received_at,source,speed_knots,course_degrees,satellites,accuracy_m").eq("unit_id", profile.unit_id!).maybeSingle();
      setGps(data as Gps | null);
    }, 15000);
    return () => { window.clearInterval(poll); sb.removeChannel(channel); };
  }, [user, profile?.unit_id]);

  const writeGps = useCallback(async (latitude: number, longitude: number, source: string) => {
    if (!user || !profile?.unit_id || !isAdmin || previewReadOnly) return;
    const { data: sessionData } = await sb.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { setGpsError("Sesi admin berakhir. Silakan masuk kembali."); return; }
    const response = await fetch("/api/gps", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ latitude, longitude, source, position_at: new Date().toISOString() })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setGpsError("Gagal memperbarui GPS: " + (result.error || response.statusText)); return; }
    setGpsError("");
    setLastGpsUpdate(new Date().toISOString());
    const { data } = await sb.from("vessel_gps_positions").select("unit_id,latitude,longitude,position_at,received_at,source,speed_knots,course_degrees,satellites,accuracy_m").eq("unit_id", profile.unit_id).maybeSingle();
    setGps(data as Gps | null);
  }, [user, profile?.unit_id, isAdmin]);

  useEffect(() => {
    if (!gpsEnabled || !isAdmin || module !== "GPS") return;
    if (!navigator.geolocation) { setGpsError("Perangkat ini tidak mendukung geolocation."); return; }
    const update = () => navigator.geolocation.getCurrentPosition(
      pos => writeGps(pos.coords.latitude, pos.coords.longitude, "admin_device_gps"),
      err => setGpsError(err.code === 1 ? "Izin lokasi ditolak. Aktifkan Location untuk browser ini." : "GPS belum tersedia. Periksa layanan lokasi dan koneksi perangkat."),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [gpsEnabled, isAdmin, module, writeGps]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const { error: loginError } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (loginError) setError("Login gagal. Periksa email/kata sandi atau hubungi administrator.");
    setBusy(false);
  }

  async function saveLog(e: React.FormEvent) {
    e.preventDefault(); if (!user || !profile?.unit_id || previewReadOnly) return;
    setBusy(true);
    const { error: saveError } = await sb.from("activity_logs").insert({ unit_id: profile.unit_id, created_by: user.id, title: title.trim(), description: desc.trim(), category, status: "draft" });
    if (saveError) setError("Gagal menyimpan jurnal: " + saveError.message);
    else { setTitle(""); setDesc(""); setModal(""); await refresh(user); }
    setBusy(false);
  }

  async function saveAsset(e: React.FormEvent) {
    e.preventDefault(); if (!profile?.unit_id || !user) return;
    setBusy(true);
    const { error: saveError } = await sb.from("maintenance_assets").insert({ unit_id: profile.unit_id, asset_code: assetCode.trim(), asset_name: assetName.trim(), category: assetCategory });
    if (saveError) setError("Gagal menambah aset: " + saveError.message);
    else { setAssetCode(""); setAssetName(""); setModal(""); await refresh(user); }
    setBusy(false);
  }

  async function editRow(table: "personnel" | "inventory_items", id: string, field: string, value: string) {
    if (!canWrite) return;
    const numericFields = ["minimum_stock", "stock_ready", "stock_unready"];
    const payload: Record<string, unknown> = { [field]: numericFields.includes(field) ? (value === "" ? 0 : Number(value)) : (value || null), updated_at: new Date().toISOString() };
    const { error: updateError } = await sb.from(table).update(payload).eq("id", id);
    if (updateError) { setError("Perubahan tidak tersimpan: " + updateError.message); return; }
    if (user && profile) await loadData(user, profile);
  }

  if (loading) return <main className="loading">Menyiapkan NAVYHUB…</main>;
  if (!user) return <main className="login"><section className="loginbox"><div className="crest">N</div><small>SISTEM MANAJEMEN TERINTEGRASI</small><h1>NAVYHUB</h1><p>Portal administrasi dan pencatatan kegiatan satuan kapal</p><div className="ship">● &nbsp; KRI ALAMANG-644 · SATUAN KAPAL CEPAT</div><form onSubmit={login}><label>Email akun terdaftar</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required/><label>Kata sandi</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required/>{error && <div className="error">{error}</div>}<button disabled={busy}>{busy ? "Memeriksa…" : "Masuk ke NAVYHUB"}</button></form><footer>Akses terbatas untuk pengguna yang telah diotorisasi.<br/>Hubungi administrator satuan untuk aktivasi akun.</footer></section></main>;
  if (!profile?.unit_id || !profile.is_active) return <main className="login"><section className="loginbox"><div className="crest">N</div><small>AKUN BELUM DIAKTIFKAN</small><h1>NAVYHUB</h1><p>Akun berhasil masuk, tetapi belum ditautkan ke unit dan peran pengguna.</p><div className="notice">Administrator harus menetapkan unit dan peran akses pada profil akun.</div><button onClick={() => sb.auth.signOut()}>Keluar</button></section></main>;

  return <div className="shell">
    <aside><div className="brand"><div className="crest smallcrest">N</div><div><b>NAVYHUB</b><small>SHIP MANAGEMENT SYSTEM</small></div></div>
      <div className="ship">● &nbsp; {unit?.code || "KRI ALAMANG-644"}<small>{unit?.name || "SATUAN KAPAL CEPAT"}</small></div>
      <nav><label>MENU UTAMA</label><button className={module === "Dashboard" ? "selected" : ""} onClick={() => setModule("Dashboard")}>▦ &nbsp; Dashboard</button><label>MODUL OPERASIONAL</label>
        {modules.map(([name, detail, icon]) => <button key={name} className={module === name ? "selected" : ""} onClick={() => setModule(name)}>{icon} &nbsp; {name}<small>{detail}</small></button>)}
        <label>MONITORING</label><button className={module === "GPS" ? "selected" : ""} onClick={() => setModule("GPS")}>⌖ &nbsp; GPS TRACKING<small>Posisi kapal terkini</small></button>
      </nav><div className="asidefoot">● KONEKSI TERLINDUNGI<small>{profile.role.toUpperCase()} · Versi 0.4</small></div>
    </aside>
    <main className="main"><header><div><small>NAVYHUB / {module.toUpperCase()}</small><h2>{module}</h2></div><div className="user"><span>{profile.full_name || user.email} · {profile.role}</span><button className="logout" onClick={() => sb.auth.signOut()}>Keluar</button></div></header>
      {previewReadOnly && <div className="preview-banner">PREVIEW MODE — data hanya dapat dilihat, perubahan dinonaktifkan.</div>}
      {error && <div className="error global-error">{error}<button onClick={() => setError("")}>Tutup</button></div>}
      {module === "Dashboard" && <>
        <section className="hero"><small>PUSAT KENDALI ADMINISTRASI</small><h1>Welcome aboard, {(profile.full_name || "Pengguna").split(" ")[0]}.</h1><p>Seluruh pencatatan kegiatan dan administrasi satuan dalam satu sistem terintegrasi.</p></section>
        <section className="map-panel"><div className="panelhead"><div><h3>INDONESIA · LIVE VESSEL POSITION</h3><p>Posisi terakhir yang dikirim oleh master GPS admin</p></div><button className="outline" onClick={() => setModule("GPS")}>Buka GPS ↗</button></div><IndonesiaMap position={gps}/><div className="gps-summary">{gps ? <><b>{gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}</b><span>{gpsFresh ? "Live · " : "Terakhir terlihat · "}{new Date(gps.position_at).toLocaleString("id-ID")}</span></> : <span>Belum ada posisi GPS yang diterima.</span>}</div></section>
        <h3>Ringkasan sistem</h3><div className="stats"><article><small>JURNAL KEGIATAN</small><b>{logs.length}</b><span>Catatan terbaru</span></article><article><small>PEMELIHARAAN</small><b>{assets.length}</b><span>Aset terdaftar</span></article><article><small>PERSEDIAAN</small><b>{stock.length}</b><span>Jenis inventaris</span></article><article><small>PERSONEL</small><b>{crew.length}</b><span>Data personel</span></article></div>
        <section className="panel"><div className="panelhead"><div><h3>Aktivitas terbaru</h3><p>Catatan yang tersimpan di database</p></div><button className="add" disabled={previewReadOnly} onClick={() => setModal("log")}>＋ Catat kegiatan</button></div>
          {logs.length ? logs.map(x => <div className="log" key={x.id}><div><b>{x.title}</b><small>{x.category} · {new Date(x.activity_date + "T00:00:00").toLocaleDateString("id-ID")}</small></div><span>{x.status === "draft" ? "Draft" : x.status}</span></div>) : <div className="empty">Belum ada catatan kegiatan.</div>}
        </section>
      </>}
      {module === "NAVYLOG" && <section className="panel ship-layout"><div className="ship-layout-head"><div><h3>Digital Logbook · {unit?.code || "KRI ALAMANG-644"}</h3><p>Visualisasi tata letak kapal dan area kegiatan</p></div><span className="ship-layout-tag">SHIP OVERVIEW</span></div><div className="ship-image-frame"><img src="/images/navylog-kri-alamang-cutaway.webp" alt="Ilustrasi potongan samping KRI Alamang-644 dengan penanda area kapal"/></div><p className="ship-image-caption">Ilustrasi tata letak KRI Alamang-644</p><button className="add" disabled={previewReadOnly} onClick={() => setModal("log")}>＋ Catat kegiatan</button></section>}
      {module === "NAVYMAINT" && <section className="panel"><div className="panelhead"><div><h3>Daftar aset pemeliharaan</h3><p>Kategori NAVYMAINT dibatasi menjadi SEWACO dan PLATFORM</p></div><button className="add" disabled={!canWrite} onClick={() => setModal("asset")}>＋ Tambah aset</button></div>
        <div className="category-cards"><div><b>SEWACO</b><span>Sensor, senjata, komunikasi, navigasi, dan sistem kendali</span><strong>{assets.filter(a => a.category === "SEWACO").length} aset</strong></div><div><b>PLATFORM</b><span>Mesin, kelistrikan, lambung, dan sistem pendukung kapal</span><strong>{assets.filter(a => a.category === "PLATFORM").length} aset</strong></div></div>
        <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Nama aset</th><th>Kategori</th><th>Lokasi</th><th>Kondisi</th></tr></thead><tbody>{assets.map(a => <tr key={a.id}><td>{a.asset_code}</td><td>{a.asset_name}</td><td><span className="pill">{a.category === "SEWACO" ? "SEWACO" : "PLATFORM"}</span></td><td>{a.location_label || "—"}</td><td>{a.condition_label}</td></tr>)}</tbody></table>{!assets.length && <div className="empty">Belum ada aset. Tambahkan aset pertama untuk memulai pendataan.</div>}</div>
        <h3 className="section-title">Laporan pemeliharaan</h3><div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Uraian gangguan</th><th>Tindakan</th><th>Status</th></tr></thead><tbody>{maintenance.map(m => <tr key={m.id}><td>{m.report_date}</td><td>{m.issue_description}</td><td>{m.action_taken || "Belum ada tindakan"}</td><td>{m.status}</td></tr>)}</tbody></table>{!maintenance.length && <div className="empty">Belum ada laporan pemeliharaan.</div>}</div>
      </section>}
      {module === "NAVYSTOCK" && <section className="panel"><div className="panelhead"><div><h3>Master inventaris & persediaan</h3><p>Klik kolom untuk mengedit langsung. Perubahan disimpan ke database.</p></div><span className="pill">{stock.length} item</span></div><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Nama barang</th><th>Kategori</th><th>Satuan</th><th>Stok siap</th><th>Stok tidak siap</th><th>Stok minimum</th></tr></thead><tbody>{stock.map(s => <tr key={s.id}><td><EditableCell value={s.item_code} editable={canWrite} onSave={v => editRow("inventory_items", s.id, "item_code", v)}/></td><td><EditableCell value={s.item_name} editable={canWrite} onSave={v => editRow("inventory_items", s.id, "item_name", v)}/></td><td><EditableCell value={s.category} editable={canWrite} onSave={v => editRow("inventory_items", s.id, "category", v)}/></td><td><EditableCell value={s.unit_of_measure} editable={canWrite} onSave={v => editRow("inventory_items", s.id, "unit_of_measure", v)}/></td><td><EditableCell value={s.stock_ready} numeric editable={canWrite} onSave={v => editRow("inventory_items", s.id, "stock_ready", v)}/></td><td><EditableCell value={s.stock_unready} numeric editable={canWrite} onSave={v => editRow("inventory_items", s.id, "stock_unready", v)}/></td><td><EditableCell value={s.minimum_stock} numeric editable={canWrite} onSave={v => editRow("inventory_items", s.id, "minimum_stock", v)}/></td></tr>)}</tbody></table>{!stock.length && <div className="empty">Belum ada data inventaris.</div>}</div><p className="hint">Tip: klik nilai pada tabel, ubah, lalu tekan Enter atau klik di luar kolom untuk menyimpan.</p></section>}
      {module === "NAVYCREW" && <section className="panel"><div className="panelhead"><div><h3>Daftar personel kapal</h3><p>Klik kolom yang ingin diedit. Hak edit mengikuti peran administrator/komandan.</p></div><span className="pill">{crew.length} personel</span></div><div className="table-wrap"><table><thead><tr><th>No.</th><th>Nama lengkap</th><th>Pangkat</th><th>NRP</th><th>Jabatan</th><th>Keterangan</th></tr></thead><tbody>{crew.map((c, i) => <tr key={c.id}><td>{i + 1}</td><td><EditableCell value={c.full_name} editable={canWrite} onSave={v => editRow("personnel", c.id, "full_name", v)}/></td><td><EditableCell value={c.rank_title} editable={canWrite} onSave={v => editRow("personnel", c.id, "rank_title", v)}/></td><td><EditableCell value={c.nrp} editable={canWrite} onSave={v => editRow("personnel", c.id, "nrp", v)}/></td><td><EditableCell value={c.position} editable={canWrite} onSave={v => editRow("personnel", c.id, "position", v)}/></td><td><EditableCell value={c.remarks} editable={canWrite} onSave={v => editRow("personnel", c.id, "remarks", v)}/></td></tr>)}</tbody></table>{!crew.length && <div className="empty">Belum ada data personel.</div>}</div><p className="hint">Klik sel untuk mengedit · Enter menyimpan · Esc membatalkan.</p></section>}
      {module === "GPS" && <section className="panel gps-panel"><div className="panelhead"><div><h3>MASTER GPS KAPAL</h3><p>Admin mengendalikan sumber posisi. Seluruh pengguna unit melihat posisi yang sama.</p></div><span className={gpsFresh ? "status-online" : "status-offline"}>{gpsFresh ? "● POSISI LIVE" : gps ? "● POSISI TIDAK MUTAKHIR" : "● MENUNGGU GPS"}</span></div>
        <IndonesiaMap position={gps}/><div className="gps-details">{gps ? <><div><small>LATITUDE</small><b>{gps.latitude.toFixed(6)}</b></div><div><small>LONGITUDE</small><b>{gps.longitude.toFixed(6)}</b></div><div><small>SUMBER</small><b>{gps.source}</b></div><div><small>UPDATE TERAKHIR</small><b>{new Date(gps.position_at).toLocaleString("id-ID")}</b></div></> : <p>Belum ada koordinat. Admin dapat mengaktifkan GPS perangkat atau mengisi koordinat secara manual.</p>}</div>
        {isAdmin ? <div className="gps-admin"><h3>Kontrol MASTER GPS · ADMIN</h3>{previewReadOnly ? <div className="notice">Kontrol GPS dinonaktifkan di preview agar tidak mengubah data operasional.</div> : <><p>GPS perangkat admin dikirim otomatis setiap 60 detik selama halaman ini aktif dan izin lokasi diberikan.</p><label className="toggle"><input type="checkbox" checked={gpsEnabled} onChange={e => setGpsEnabled(e.target.checked)}/> Aktifkan pengiriman GPS otomatis</label><div className="gps-actions"><input type="number" step="any" placeholder="Latitude" value={manualLat} onChange={e => setManualLat(e.target.value)}/><input type="number" step="any" placeholder="Longitude" value={manualLon} onChange={e => setManualLon(e.target.value)}/><button className="add" onClick={() => { const lat = Number(manualLat), lon = Number(manualLon); if (!manualLat || !manualLon || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { setGpsError("Masukkan koordinat yang valid."); return; } writeGps(lat, lon, "admin_manual"); }}>Kirim posisi manual</button></div><small className="hint">Pastikan GPS perangkat admin berada di kapal atau gunakan koordinat dari perangkat GPS kapal yang benar. Jangan gunakan lokasi perkiraan.</small></>}{gpsError && <div className="error">{gpsError}</div>}{lastGpsUpdate && <p className="success-note">Pengiriman terakhir: {new Date(lastGpsUpdate).toLocaleTimeString("id-ID")}</p>}</div> : <div className="notice">Mode pemantauan. Hanya ADMIN yang dapat mengendalikan master GPS.</div>}
        <p className="hint">Satu kapal = satu posisi aktif. Setiap update menggantikan koordinat sebelumnya; tidak ada histori track yang disimpan. Jika tidak ada update baru selama 2 menit, posisi ditandai tidak mutakhir.</p>
      </section>}
      {["NAVYCHECK", "NAVYROSTER", "NAVYMEAL", "NAVYDOCS", "NAVYFIT"].includes(module) && <section className="panel placeholder"><h3>{module}</h3><p>Modul ini tetap tersedia dalam navigasi dan menunggu implementasi alur kerja khusus. Modul yang sudah aktif: NAVYLOG, NAVYMAINT, NAVYSTOCK, NAVYCREW, dan GPS.</p><button className="outline" onClick={() => setModule("Dashboard")}>Kembali ke dashboard</button></section>}
      <footer>© 2026 NAVYHUB · {unit?.code || "KRI ALAMANG-644"} · SATUAN KAPAL CEPAT</footer>
    </main>
    {modal && <div className="overlay"><form className="modal" onSubmit={modal === "asset" ? saveAsset : saveLog}><h2>{modal === "asset" ? "Tambah aset NAVYMAINT" : "Catat kegiatan NAVYLOG"}</h2>{modal === "asset" ? <><label>Kode aset</label><input value={assetCode} onChange={e => setAssetCode(e.target.value)} required maxLength={60}/><label>Nama aset</label><input value={assetName} onChange={e => setAssetName(e.target.value)} required maxLength={180}/><label>Kategori</label><select value={assetCategory} onChange={e => setAssetCategory(e.target.value as "SEWACO" | "PLATFORM")}><option value="SEWACO">SEWACO</option><option value="PLATFORM">PLATFORM</option></select></> : <><label>Judul kegiatan</label><input value={title} onChange={e => setTitle(e.target.value)} required maxLength={180}/><label>Kategori</label><select value={category} onChange={e => setCategory(e.target.value)}><option>Umum</option><option>Personel</option><option>Logistik</option><option>Pemeliharaan</option><option>Administrasi</option></select><label>Uraian kegiatan</label><textarea rows={4} value={desc} onChange={e => setDesc(e.target.value)}/></>}{error && <div className="error">{error}</div>}<div className="actions"><button type="button" className="outline" onClick={() => setModal("")}>Batal</button><button disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button></div></form></div>}
  </div>;
}
