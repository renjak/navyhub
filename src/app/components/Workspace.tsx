"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import VesselStatus from "../VesselStatus";

type Props={supabase:any;user:any;profile:any;module:string;setModule:(v:string)=>void};
type ModuleDef={id:string;label:string;icon:string;table?:string;select?:string;dateColumn?:string;description:string};
const modules:ModuleDef[]=[
 {id:"Dashboard",label:"Pusat kendali",icon:"⌂",description:"Ringkasan operasional kapal."},
 {id:"NAVYLOG",label:"Jurnal kegiatan & serah terima",icon:"▤",table:"activity_logs",select:"id,activity_date,activity_time,title,category,description,status,created_at",dateColumn:"activity_date",description:"Jurnal kegiatan harian KRI."},
 {id:"NAVYMAINT",label:"Pemeliharaan peralatan",icon:"⚙",table:"maintenance_records",select:"id,report_date,issue_description,action_taken,status,reported_by,created_at",dateColumn:"report_date",description:"Laporan gangguan dan tindak lanjut pemeliharaan."},
 {id:"NAVYSTOCK",label:"Persediaan & logistik",icon:"▣",table:"inventory_items",select:"id,item_code,item_name,category,unit_of_measure,initial_quantity,stock_ready,stock_unready,minimum_stock,is_active",description:"Daftar persediaan logistik unit."},
 {id:"NAVYCHECK",label:"Pemeriksaan & checklist",icon:"☑",table:"checklists",select:"id,title,description,category,assigned_role,scheduled_time,location_label,instructions,is_active,sequence_no",description:"Daftar checklist pemeriksaan kapal."},
 {id:"NAVYROSTER",label:"Personel & jadwal jaga",icon:"♙",table:"personnel",select:"id,roster_period,sequence_no,full_name,rank_title,nrp,position,remarks",dateColumn:"roster_period",description:"Daftar personel dan data roster unit."},
 {id:"NAVYMEAL",label:"Bekal & konsumsi",icon:"◉",table:"daily_watch_reports",select:"id,duty_date,report_data,additional_notes,status,created_at",dateColumn:"duty_date",description:"Laporan harian yang tersedia pada database unit. Data khusus menu/bekal belum tersedia pada skema yang diperiksa."},
 {id:"NAVYDOCS",label:"Dokumen & arsip",icon:"▧",description:"Repositori dokumen belum tersedia pada skema database yang diperiksa."},
 {id:"NAVYFIT",label:"Latihan & kebugaran",icon:"⌁",description:"Tabel latihan dan kebugaran belum tersedia pada skema database yang diperiksa."},
 {id:"NAVYMAP",label:"Peta wilayah Indonesia",icon:"⌖",description:"Peta geografis nasional."}
];
const humanize=(s:string)=>s.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
export default function Workspace({supabase,user,profile,module,setModule}:Props){
 const [rows,setRows]=useState<any[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[search,setSearch]=useState(""),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[category,setCategory]=useState("Umum");
 const isAdmin=profile?.role==="admin",isViewer=profile?.role==="viewer";
 const selected=modules.find(x=>x.id===module)||modules[0];
 const load=useCallback(async()=>{
  if(!selected.table||!profile?.unit_id)return;
  setBusy(true);setNotice("");
  let q=supabase.from(selected.table).select(selected.select||"*").eq("unit_id",profile.unit_id).limit(250);
  if(selected.dateColumn)q=q.order(selected.dateColumn,{ascending:false});
  else q=q.order("created_at",{ascending:false});
  const {data,error}=await q;
  setRows(error?[]:data||[]);
  if(error)setNotice("Data gagal dimuat. Periksa izin akses atau koneksi database.");
  setBusy(false);
 },[supabase,selected,profile?.unit_id]);
 useEffect(()=>{setRows([]);setSearch("");setNotice("");if(selected.table)load()},[module,load,selected.table]);
 const filtered=useMemo(()=>rows.filter(r=>Object.values(r).some(v=>String(v??"").toLowerCase().includes(search.toLowerCase()))),[rows,search]);
 const saveLog=async(e:any)=>{
  e.preventDefault();if(!title.trim()||!profile?.unit_id||isViewer||!user?.id)return;
  setBusy(true);setNotice("");
  const {error}=await supabase.from("activity_logs").insert({unit_id:profile.unit_id,created_by:user.id,title:title.trim(),description:description.trim(),category,status:"draft"});
  if(error)setNotice("Gagal menyimpan catatan. Pastikan akun memiliki izin membuat jurnal.");
  else{setTitle("");setDescription("");setNotice("Catatan berhasil disimpan sebagai draft.");}
  await load();setBusy(false);
 };
 if(module==="Dashboard")return <div className="workspace">
  <section className="welcome-panel"><div><small>INTEGRATED SHIP MANAGEMENT</small><h1>Welcome aboard, {(profile?.full_name||"Operator").split(" ")[0]}.</h1><p>Pencatatan kegiatan, pemeliharaan, logistik, personel, dan administrasi kapal dalam satu command environment.</p></div><div className="ship-mark">N<span>644</span></div></section>
  <VesselStatus supabase={supabase} unitId={profile?.unit_id} userId={user?.id} isAdmin={isAdmin}/>
  <div className="section-heading"><div><small>OPERATIONAL MODULES</small><h3>Modul NAVYHUB</h3></div></div>
  <div className="module-grid">{modules.filter(x=>x.id!=="Dashboard").map(m=><button key={m.id} onClick={()=>setModule(m.id)}><span>{m.icon}</span><b>{m.id}</b><small>{m.label}</small><i>Buka modul ↗</i></button>)}</div>
 </div>;
 if(module==="NAVYMAP")return <section className="content-panel"><div className="section-heading"><div><small>NAVYMAP · INDONESIA</small><h2>Peta wilayah Indonesia</h2><p>Peta geografis nasional.</p></div></div><iframe className="national-map" title="Peta wilayah Indonesia" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=93.5%2C-12.5%2C142.5%2C7.5&layer=mapnik"/></section>;
 if(!selected.table)return <div className="workspace"><section className="page-heading"><div><small>OPERATIONAL MODULE / {module}</small><h1>{module}</h1><p>{selected.label}</p></div><span className="status-pill muted">MENUNGGU SKEMA DATA</span></section><section className="content-panel module-pending"><div className="pending-icon">{selected.icon}</div><h3>{selected.label}</h3><p>{selected.description} Modul tetap ditampilkan, tetapi belum dihubungkan ke tabel yang belum tersedia agar tidak membuat atau mengubah struktur database secara sepihak.</p><button className="secondary-button" onClick={()=>setModule("Dashboard")}>Kembali ke Dashboard</button></section></div>;
 return <div className="workspace"><section className="page-heading"><div><small>OPERATIONAL MODULE / {module}</small><h1>{module}</h1><p>{selected.description}</p></div><span className="status-pill good">UNIT · KRI ALAMANG-644</span></section>
 {module==="NAVYLOG"&&<section className="content-panel ship-layout"><div className="section-heading"><div><h3>Digital Logbook · KRI ALAMANG-644</h3><p>Ilustrasi tata letak kapal sebagai referensi pencatatan area kegiatan.</p></div></div><div className="ship-image-frame"><img src="/images/navylog-kri-alamang-cutaway.webp" alt="Ilustrasi potongan samping KRI Alamang-644"/></div></section>}
 {module==="NAVYLOG"&&!isViewer&&<form className="content-panel log-form" onSubmit={saveLog}><div className="section-heading"><div><h3>Catat kegiatan</h3><p>Catatan akan tersimpan sebagai draft pada jurnal unit kapal.</p></div></div><label>Judul kegiatan<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3} maxLength={180}/></label><label>Kategori<select value={category} onChange={e=>setCategory(e.target.value)}><option>Umum</option><option>Personel</option><option>Logistik</option><option>Pemeliharaan</option><option>Administrasi</option></select></label><label>Uraian<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label><button className="primary-button" disabled={busy}>Simpan sebagai draft</button></form>}
 <section className="content-panel"><div className="section-heading"><div><h3>{module==="NAVYLOG"?"Jurnal kegiatan":selected.label}</h3><p>Data unit dari database NAVYHUB.</p></div><button className="secondary-button" onClick={load} disabled={busy}>↻ Refresh</button></div>{notice&&<p className="notice">{notice}</p>}<div className="table-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari data…"/><span>{filtered.length} / {rows.length} data</span></div>{busy?<p className="empty-state">Memuat data…</p>:filtered.length?<div className="table-scroll"><table><thead><tr>{Object.keys(filtered[0]).filter(k=>k!=="id").map(k=><th key={k}>{humanize(k)}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id||i}>{Object.keys(r).filter(k=>k!=="id").map(k=><td key={k}>{r[k]===null||r[k]===undefined||r[k]===""?"—":typeof r[k]==="object"?JSON.stringify(r[k]):String(r[k])}</td>)}</tr>)}</tbody></table></div>:<p className="empty-state">Belum ada data atau akun tidak memiliki akses baca.</p>}</section></div>;
}
