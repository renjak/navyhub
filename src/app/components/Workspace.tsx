"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import VesselStatus from "../VesselStatus";

type Props={supabase:any;user:any;profile:any;module:string;setModule:(v:string)=>void};
const modules=[
 {id:"Dashboard",label:"Pusat kendali",icon:"⌂"},
 {id:"NAVYLOG",label:"Jurnal kegiatan & serah terima",icon:"▤",table:"activity_logs"},
 {id:"NAVYMAINT",label:"Pemeliharaan peralatan",icon:"⚙"},
 {id:"NAVYSTOCK",label:"Persediaan & logistik",icon:"▣"},
 {id:"NAVYCHECK",label:"Pemeriksaan & checklist",icon:"☑"},
 {id:"NAVYROSTER",label:"Personel & jadwal jaga",icon:"♙"},
 {id:"NAVYMEAL",label:"Bekal & konsumsi",icon:"◉"},
 {id:"NAVYDOCS",label:"Dokumen & arsip",icon:"▧"},
 {id:"NAVYFIT",label:"Latihan & kebugaran",icon:"⌁"},
 {id:"NAVYMAP",label:"Peta wilayah Indonesia",icon:"⌖"}
];
const columns=["activity_date","activity_time","title","category","description","status"];
const labels:any={activity_date:"Tanggal",activity_time:"Waktu",title:"Judul",category:"Kategori",description:"Uraian",status:"Status"};

export default function Workspace({supabase,user,profile,module,setModule}:Props){
 const [rows,setRows]=useState<any[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[search,setSearch]=useState(""),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[category,setCategory]=useState("Umum");
 const isAdmin=profile?.role==="admin",isViewer=profile?.role==="viewer";
 const selected=modules.find(x=>x.id===module);
 const load=useCallback(async()=>{
  if(module!=="NAVYLOG"||!profile?.unit_id)return;
  setBusy(true);
  const {data,error}=await supabase.from("activity_logs").select("id,activity_date,activity_time,title,category,description,status").eq("unit_id",profile.unit_id).order("activity_date",{ascending:false}).limit(250);
  setRows(error?[]:data||[]);
  setNotice(error?"Data NAVYLOG gagal dimuat. Periksa koneksi dan kebijakan akses database.":"");
  setBusy(false);
 },[supabase,module,profile?.unit_id]);
 useEffect(()=>{setRows([]);setSearch("");setNotice("");if(module==="NAVYLOG")load()},[module,load]);
 const filtered=useMemo(()=>rows.filter(r=>Object.values(r).some(v=>String(v??"").toLowerCase().includes(search.toLowerCase()))),[rows,search]);
 const saveLog=async(e:any)=>{
  e.preventDefault();if(!title.trim()||!profile?.unit_id||isViewer)return;
  setBusy(true);setNotice("");
  const {error}=await supabase.from("activity_logs").insert({unit_id:profile.unit_id,created_by:user.id,title:title.trim(),description:description.trim(),category,status:"draft",activity_date:new Date().toLocaleDateString("en-CA")});
  if(error)setNotice("Gagal menyimpan catatan. Periksa hak akses database.");
  else{setTitle("");setDescription("");setNotice("Catatan berhasil disimpan sebagai draft.");}
  await load();setBusy(false);
 };
 if(module==="Dashboard")return <div className="workspace">
  <section className="welcome-panel"><div><small>INTEGRATED SHIP MANAGEMENT</small><h1>Welcome aboard, {(profile.full_name||"Operator").split(" ")[0]}.</h1><p>Seluruh pencatatan kegiatan, pemeliharaan, logistik, personel, dan administrasi kapal dalam satu command environment.</p></div><div className="ship-mark">N<span>644</span></div></section>
  <VesselStatus supabase={supabase} unitId={profile.unit_id} userId={user.id} isAdmin={isAdmin}/>
  <div className="section-heading"><div><small>OPERATIONAL MODULES</small><h3>Modul NAVYHUB</h3></div></div>
  <div className="module-grid">{modules.filter(x=>x.id!=="Dashboard").map(m=><button key={m.id} onClick={()=>setModule(m.id)}><span>{m.icon}</span><b>{m.id}</b><small>{m.label}</small><i>Buka modul ↗</i></button>)}</div>
 </div>;
 if(module==="NAVYMAP")return <section className="content-panel"><div className="section-heading"><div><small>NAVYMAP · INDONESIA</small><h2>Peta wilayah Indonesia</h2><p>Peta geografis nasional.</p></div></div><iframe className="national-map" title="Peta wilayah Indonesia" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=93.5%2C-12.5%2C142.5%2C7.5&layer=mapnik"/></section>;
 if(module!=="NAVYLOG")return <div className="workspace"><section className="page-heading"><div><small>OPERATIONAL MODULE / {module}</small><h1>{module}</h1><p>{selected?.label}</p></div><span className="status-pill muted">MENUNGGU VALIDASI DATABASE</span></section><section className="content-panel module-pending"><div className="pending-icon">{selected?.icon}</div><h3>{selected?.label}</h3><p>Modul ini tetap dipertahankan dalam navigasi NAVYHUB. Integrasi data dan formulirnya akan diaktifkan setelah struktur tabel, kolom, serta hak akses Supabase diverifikasi agar tidak salah membaca atau mengubah data operasional.</p><button className="secondary-button" onClick={()=>setModule("Dashboard")}>Kembali ke Dashboard</button></section></div>;
 return <div className="workspace"><section className="page-heading"><div><small>OPERATIONAL MODULE / NAVYLOG</small><h1>NAVYLOG</h1><p>Jurnal kegiatan harian dan pencatatan operasional KRI Alamang-644.</p></div><span className="status-pill good">UNIT · KRI ALAMANG-644</span></section>
 <section className="content-panel ship-layout"><div className="section-heading"><div><h3>Digital Logbook · KRI ALAMANG-644</h3><p>Ilustrasi tata letak kapal sebagai referensi pencatatan area kegiatan.</p></div></div><div className="ship-image-frame"><img src="/images/navylog-kri-alamang-cutaway.webp" alt="Ilustrasi potongan samping KRI Alamang-644"/></div></section>
 {!isViewer&&<form className="content-panel log-form" onSubmit={saveLog}><div className="section-heading"><div><h3>Catat kegiatan</h3><p>Catatan akan tersimpan sebagai draft pada jurnal unit kapal.</p></div></div><label>Judul kegiatan<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={180}/></label><label>Kategori<select value={category} onChange={e=>setCategory(e.target.value)}><option>Umum</option><option>Personel</option><option>Logistik</option><option>Pemeliharaan</option><option>Administrasi</option></select></label><label>Uraian<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label><button className="primary-button" disabled={busy}>Simpan sebagai draft</button></form>}
 <section className="content-panel"><div className="section-heading"><div><h3>Jurnal kegiatan</h3><p>Data jurnal dari database unit kapal.</p></div><button className="secondary-button" onClick={load} disabled={busy}>↻ Refresh</button></div>{notice&&<p className="notice">{notice}</p>}<div className="table-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari data jurnal…"/><span>{filtered.length} / {rows.length} data</span></div>{busy?<p className="empty-state">Memuat data…</p>:filtered.length?<div className="table-scroll"><table><thead><tr>{columns.map(k=><th key={k}>{labels[k]}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id||i}>{columns.map(k=><td key={k}>{r[k]===null||r[k]===undefined||r[k]===""?"—":String(r[k])}</td>)}</tr>)}</tbody></table></div>:<p className="empty-state">Belum ada catatan kegiatan atau akun tidak memiliki akses baca.</p>}</section></div>;
}
