"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {createClient,type User} from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import DigitalLogbook from "./DigitalLogbook";
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
pdfjsLib.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/legacy/build/pdf.worker.mjs",import.meta.url).toString();
const menu=[
 {id:"Dashboard",desc:"Pusat kendali",icon:"⌂"},
 {id:"NAVYLOG",desc:"Jurnal kegiatan",icon:"▤",table:"activity_logs"},
 {id:"NAVYMAINT",desc:"Pemeliharaan peralatan",icon:"⚙",table:"maintenance_assets"},
 {id:"NAVYSTOCK",desc:"Persediaan & logistik",icon:"▣",table:"inventory_items"},
 {id:"NAVYCHECK",desc:"Pemeriksaan & checklist",icon:"☑",table:"checklists"},
 {id:"NAVYROSTER",desc:"Personel & jadwal jaga",icon:"♙",table:"personnel"},
 {id:"NAVYMEAL",desc:"Bekal & konsumsi",icon:"◉"},
 {id:"NAVYDOCS",desc:"Dokumen & arsip",icon:"▧"},
 {id:"NAVYFIT",desc:"Latihan & kebugaran",icon:"⌁"}
];
type Profile={id:string;full_name:string;rank_title:string|null;unit_id:string|null;role:string;is_active:boolean};
type RowData=Record<string,any>;
type ImportedPlan={activity_date:string;activity_time:string|null;title:string;description:string;category:string};
const phstSectionOrder=["A. SITUASI","B. TUGAS POKOK","C. UMUM","D. KHUSUS","E. LAIN-LAIN"];
const monthMap:Record<string,string>={januari:"01",februari:"02",maret:"03",april:"04",mei:"05",juni:"06",juli:"07",agustus:"08",september:"09",oktober:"10",november:"11",desember:"12"};
async function readPdfText(file:File):Promise<string[]>{
 const data=new Uint8Array(await file.arrayBuffer());
 const task=pdfjsLib.getDocument({data});
 const pdf=await task.promise;const lines:string[]=[];
 for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
  const page=await pdf.getPage(pageNo);const content=await page.getTextContent();
  const items=content.items.filter((x:any)=>typeof x.str==="string"&&x.str.trim()).map((x:any)=>({text:x.str.trim(),y:Math.round(x.transform?.[5]||0)}));
  const rows=new Map<number,string[]>();
  for(const item of items){const arr=rows.get(item.y)||[];arr.push(item.text);rows.set(item.y,arr)}
  const sorted=[...rows.entries()].sort((a,b)=>b[0]-a[0]);
  for(const [,parts] of sorted){const line=parts.join(" ").replace(/\\s+/g," ").trim();if(line)lines.push(line)}
 }
 if(!lines.length)throw new Error("Teks PDF tidak ditemukan. Jika PDF berupa hasil scan, diperlukan OCR.");
 return lines;
}
async function readDocxText(file:File):Promise<string[]>{
 const bytes=await file.arrayBuffer(),view=new DataView(bytes);let eocd=-1;
 for(let i=bytes.byteLength-22;i>=Math.max(0,bytes.byteLength-65558);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break}}
 if(eocd<0)throw new Error("File bukan DOCX yang valid.");
 const count=view.getUint16(eocd+10,true),central=view.getUint32(eocd+16,true);let off=central,xml="";
 for(let n=0;n<count;n++){if(view.getUint32(off,true)!==0x02014b50)break;const method=view.getUint16(off+10,true),size=view.getUint32(off+20,true),nl=view.getUint16(off+28,true),el=view.getUint16(off+30,true),cl=view.getUint16(off+32,true),local=view.getUint32(off+42,true),name=new TextDecoder().decode(new Uint8Array(bytes,off+46,nl));if(name==="word/document.xml"){const ln=view.getUint16(local+26,true),le=view.getUint16(local+28,true),start=local+30+ln+le,compressed=bytes.slice(start,start+size);if(method===0)xml=new TextDecoder().decode(compressed);else if(method===8){const ds=new DecompressionStream("deflate-raw");xml=await new Response(new Blob([compressed]).stream().pipeThrough(ds)).text()}else throw new Error("Format kompresi DOCX tidak didukung.");break}off+=46+nl+el+cl}
 if(!xml)throw new Error("Isi dokumen Word tidak ditemukan.");
 const doc=new DOMParser().parseFromString(xml,"application/xml");const body=doc.getElementsByTagName("w:body")[0];if(!body)throw new Error("Struktur dokumen Word tidak terbaca.");
 const out:string[]=[];for(const node of Array.from(body.children)){if(node.localName==="p")out.push(Array.from(node.getElementsByTagName("w:t")).map(x=>x.textContent||"").join(""));else if(node.localName==="tbl"){for(const tr of Array.from(node.getElementsByTagName("w:tr"))){out.push(Array.from(tr.getElementsByTagName("w:tc")).map(tc=>Array.from(tc.getElementsByTagName("w:t")).map(x=>x.textContent||"").join(" ")).join(" | "))}}}
 return out.map(s=>s.replace(/\s+/g," ").trim()).filter(Boolean)
}
function parsePhstHeader(lines:string[]):Record<string,string>{
 const out:Record<string,string>={};
 const keys:[string,RegExp][]=[
 ["Perwira Jaga",/Perwira\s+jaga\s*:?\s*(.+)/i],
 ["Divisi Jaga",/Divisi\s+jaga\s*:?\s*(.+)/i],
 ["Bintara Jaga",/Bintara\s+jaga\s*:?\s*(.+)/i],
 ["Caraka",/Caraka\s*:?\s*(.+)/i],
 ["Tenue Jaga",/Tenue\s+jaga\s*:?\s*(.+)/i]
 ];
 for(const raw of lines){const line=raw.replace(/\s+/g," ").trim();for(const [key,re] of keys){const m=line.match(re);if(m&&!out[key])out[key]=m[1].trim()}}
 return out;
}
function parsePhstLines(lines:string[]):ImportedPlan[]{
 const out:ImportedPlan[]=[];let date="";let section="";let inGeneral=false;
 const push=(category:string,title:string,description="",time:string|null=null)=>{if(date&&title.trim())out.push({activity_date:date,activity_time:time,title:title.trim(),description:description.trim(),category})};
 for(const raw of lines){
  const line=raw.replace(/\s+/g," ").trim();if(!line)continue;
  const dm=line.match(/(?:Hari\s*\/\s*tanggal\s*:?\s*)?(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)?\s*,?\s*(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i);
  if(dm){date=dm[4]+"-"+monthMap[dm[3].toLowerCase()]+"-"+dm[2].padStart(2,"0");section="";inGeneral=false;continue}
  if(!date)continue;
  if(/^A\.\s*SITUASI/i.test(line)){section="A. SITUASI";inGeneral=false;continue}
  if(/^B\.\s*TUGAS\s+POKOK/i.test(line)){section="B. TUGAS POKOK";inGeneral=false;const val=line.replace(/^B\.\s*TUGAS\s+POKOK\s*:?/i,"").trim();if(val)push(section,"Tugas Pokok",val);continue}
  if(/^C\.\s*UMUM/i.test(line)){section="C. UMUM";inGeneral=true;continue}
  if(/^D\.\s*KHUSUS/i.test(line)){section="D. KHUSUS";inGeneral=false;continue}
  if(/^E\.\s*LAIN/i.test(line)){section="E. LAIN-LAIN";inGeneral=false;continue}
  if(/^F\./i.test(line)){section="";inGeneral=false;continue}
  if(section==="A. SITUASI"){
   const m=line.match(/^[a-b]\.?\s*([^:|]+?)\s*:\s*(.+)$/i);
   if(m)push(section,m[1].replace(/\s+/g," ").trim(),m[2]);
   else if(/\|/.test(line)){const cells=line.split("|").map(x=>x.trim()).filter(Boolean);if(cells.length>=2)push(section,cells[0],cells.slice(1).join(" "))}
   continue;
  }
  if(section==="B. TUGAS POKOK"){
   const val=line.replace(/^B\.\s*TUGAS\s+POKOK\s*:?/i,"").replace(/^:\s*/,"").trim();
   if(val)push(section,"Tugas Pokok",val);continue;
  }
  if(section==="C. UMUM"){
   const clean=line.replace(/^[-•–]\s*/,"").trim();
   const tm=clean.match(/^(\d{1,2})[.:](\d{2})\s*:\s*(.+)$/);
   if(tm)push(section,tm[3], "",tm[1].padStart(2,"0")+":"+tm[2]);
   continue;
  }
  if(section==="D. KHUSUS"){
   if(/^N\s*O\s*\|/i.test(line)||/DEPARTEMEN.*KEGIATAN/i.test(line)||/^NO\s*\|/i.test(line))continue;
   if(/^\d+\s*\|/.test(line)){
    const cells=line.split("|").map(x=>x.trim());
    if(cells.length>=3){
     const dept=cells[1].replace(/^\d+\s*/,"").trim();
     const activities=(cells[2]||"").split(/\s+-\s+/).map(x=>x.replace(/^[-•]\s*/,"").trim()).filter(Boolean);
     const risk=(cells[3]||"").trim();
     push(section,dept,["Kegiatan:",...activities.map(x=>"• "+x),risk?"Manajemen risiko: "+risk:""].filter(Boolean).join("\n"));
    }
   }
   continue;
  }
  if(section==="E. LAIN-LAIN"){
   const m=line.match(/^[a-z]\.?\s*(.+)$/i);const val=(m?m[1]:line).replace(/^[-•–]\s*/,"").trim();
   if(val)push(section,val);
  }
 }
 return out;
}
const titles:Record<string,string>={activity_logs:"Jurnal Kegiatan",maintenance_assets:"Daftar Aset",maintenance_records:"Riwayat Pemeliharaan",inventory_items:"Master Persediaan",stock_movements:"Transaksi Persediaan",checklists:"Template Checklist",checklist_items:"Item Checklist",checklist_runs:"Pelaksanaan Checklist",personnel:"Daftar Personel"};
const fields:Record<string,string[]>={activity_logs:["activity_date","activity_time","title","category","description","status"],maintenance_assets:["asset_code","asset_name","category","location_label","condition_label","is_active"],maintenance_records:["report_date","issue_description","action_taken","status"],inventory_items:["item_code","item_name","category","unit_of_measure","stock_ready","stock_unready","minimum_stock","brand","caliber","secondary_caliber","ammo_type","lot_no","capacity_liters","is_active"],stock_movements:["movement_date","movement_type","quantity","reference_no","condition_status","movement_purpose","notes"],checklists:["title","category","description","is_active"],checklist_items:["item_order","item_label","is_required"],checklist_runs:["performed_at","summary"],personnel:["sequence_no","full_name","rank_title","position","roster_period","remarks"]};
const labels:Record<string,string>={activity_date:"Tanggal",activity_time:"Waktu",title:"Judul",category:"Kategori",description:"Uraian",status:"Status",asset_code:"Kode aset",asset_name:"Nama aset",location_label:"Lokasi",condition_label:"Kondisi",is_active:"Aktif",report_date:"Tanggal laporan",issue_description:"Kerusakan",action_taken:"Tindakan",item_code:"Kode barang",item_name:"Nama barang",unit_of_measure:"Satuan",stock_ready:"Stok siap",stock_unready:"Stok tidak siap",minimum_stock:"Stok minimum",brand:"Merek",caliber:"Kaliber",secondary_caliber:"Kaliber sekunder",ammo_type:"Jenis amunisi",lot_no:"Nomor lot",capacity_liters:"Kapasitas (L)",movement_date:"Tanggal transaksi",movement_type:"Jenis transaksi",quantity:"Jumlah",reference_no:"Nomor referensi",condition_status:"Kondisi",movement_purpose:"Tujuan",notes:"Catatan",item_order:"Urutan",item_label:"Item pemeriksaan",is_required:"Wajib",performed_at:"Waktu pelaksanaan",summary:"Ringkasan",sequence_no:"No.",full_name:"Nama",rank_title:"Pangkat",position:"Jabatan",roster_period:"Periode",remarks:"Keterangan"};
const fmt=(v:any)=>v===null||v===undefined||v===""?"—":typeof v==="boolean"?(v?"Ya":"Tidak"):typeof v==="object"?JSON.stringify(v):String(v);
export default function Home(){
 const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[module,setModule]=useState("Dashboard"),[rows,setRows]=useState<RowData[]>([]),[movements,setMovements]=useState<RowData[]>([]),[search,setSearch]=useState(""),[notice,setNotice]=useState("");
 const [dbCounts,setDbCounts]=useState({personnel:"—",inventory:"—",movements:"—",logs:"—"});
 const [supplyRows,setSupplyRows]=useState<RowData[]>([]);
 const [planDate,setPlanDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()+1);return d.toLocaleDateString("en-CA")});
 const [planTime,setPlanTime]=useState("07:00");
 const [planTitle,setPlanTitle]=useState("");
 const [planCategory,setPlanCategory]=useState("Umum");
 const [planDescription,setPlanDescription]=useState("");
 const [planResources,setPlanResources]=useState("");
 const [tomorrowPlans,setTomorrowPlans]=useState<RowData[]>([]);
 const [docPlans,setDocPlans]=useState<ImportedPlan[]>([]);
 const [docMeta,setDocMeta]=useState<Record<string,string>>({});
 const [docName,setDocName]=useState("");
 const [docBusy,setDocBusy]=useState(false);
 const refreshProfile=useCallback(async(u:User)=>{const {data,error}=await sb.from("profiles").select("id,full_name,rank_title,unit_id,role,is_active").eq("id",u.id).maybeSingle();if(error)throw error;setProfile(data as Profile|null)},[]);
 useEffect(()=>{let alive=true;sb.auth.getSession().then(async({data})=>{const u=data.session?.user??null;if(!alive)return;setUser(u);if(u){try{await refreshProfile(u)}catch(e){setError("Gagal memuat profil akun.")}}setLoading(false)});const {data:listener}=sb.auth.onAuthStateChange((_event,session)=>{const u=session?.user??null;setUser(u);if(!u){setProfile(null);setRows([]);setMovements([])}else{setTimeout(()=>refreshProfile(u).catch(()=>setError("Gagal memuat profil.")),0)}});return()=>{alive=false;listener.subscription.unsubscribe()}},[refreshProfile]);
 const isViewer=profile?.role==="viewer";
 const visibleMenu=isViewer?menu.filter(m=>["Dashboard","NAVYLOG","NAVYMAINT","NAVYSTOCK","NAVYCHECK","NAVYROSTER"].includes(m.id)):menu;
 const selected=menu.find(m=>m.id===module);
 useEffect(()=>{if(isViewer&&!visibleMenu.some(m=>m.id===module))setModule("Dashboard")},[isViewer,module]);
 useEffect(()=>{if(!profile?.unit_id)return;let live=true;(async()=>{const names=["personnel","inventory_items","stock_movements","activity_logs"];const results=await Promise.all(names.map(table=>sb.from(table).select("*",{count:"exact",head:true}).eq("unit_id",profile.unit_id!)));if(live)setDbCounts({personnel:results[0].error?"—":String(results[0].count??0),inventory:results[1].error?"—":String(results[1].count??0),movements:results[2].error?"—":String(results[2].count??0),logs:results[3].error?"—":String(results[3].count??0)})})();return()=>{live=false}},[profile?.unit_id]);
 useEffect(()=>{if(!profile?.unit_id)return;let live=true;(async()=>{const {data,error}=await sb.from("inventory_items").select("id,item_name,category,capacity_liters,stock_ready,stock_unready,unit_of_measure").eq("unit_id",profile.unit_id!).eq("is_active",true).in("category",["Air Tawar","BBM"]);if(live)setSupplyRows(error?[]:(data||[]) as RowData[])})();return()=>{live=false}},[profile?.unit_id]);
 const loadTomorrowPlans=useCallback(async()=>{if(!profile?.unit_id)return;const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");const {data,error}=await sb.from("activity_logs").select("id,activity_date,activity_time,title,description,category,status").eq("unit_id",profile.unit_id).gte("activity_date",today).order("activity_date",{ascending:true}).order("activity_time",{ascending:true});if(error){setNotice("Agenda tersimpan tidak dapat dimuat: "+error.message);return}const rows=(data||[]) as RowData[];const nextDate=rows[0]?.activity_date;setTomorrowPlans(nextDate?rows.filter(p=>p.activity_date===nextDate):[])},[profile?.unit_id]);
 useEffect(()=>{if(user&&profile?.unit_id)loadTomorrowPlans()},[user,profile?.unit_id,loadTomorrowPlans]);
 async function handlePhstUpload(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;setDocBusy(true);setNotice("");setDocName(file.name);try{const ext=file.name.toLowerCase();const lines=ext.endsWith(".docx")?await readDocxText(file):ext.endsWith(".pdf")?await readPdfText(file):(()=>{throw new Error("Gunakan dokumen Word (.docx) atau PDF (.pdf).")})();const parsed=parsePhstLines(lines);if(!parsed.length)throw new Error("Tidak ditemukan bagian A sampai E atau jadwal kegiatan. Periksa format PHST.");const meta=parsePhstHeader(lines);setDocMeta(meta);if(Object.keys(meta).length)parsed.push({activity_date:parsed[0].activity_date,activity_time:null,title:"Petugas dan kesiapan jaga",description:Object.entries(meta).map(([k,v])=>k+": "+v).join("\n"),category:"PHST META"});setDocPlans(parsed);setNotice("Dokumen berhasil dibaca. Periksa hasil ekstraksi sebelum menyimpan ke NAVYLOG.")}catch(err){setDocPlans([]);setNotice(err instanceof Error?err.message:"Dokumen gagal diproses.")}finally{setDocBusy(false);e.target.value=""}}
 async function importPhstPlans(){if(!profile?.unit_id||!user||!docPlans.length)return;setBusy(true);setNotice("");const phstCategories=["A. SITUASI","B. TUGAS POKOK","C. UMUM","D. KHUSUS","E. LAIN-LAIN","PHST META"];const {error:deleteError}=await sb.from("activity_logs").delete().eq("unit_id",profile.unit_id).in("category",phstCategories);if(deleteError){setNotice("Agenda lama belum dapat diganti: "+deleteError.message);setBusy(false);return}const payload=docPlans.map(p=>({unit_id:profile.unit_id,created_by:user.id,activity_date:p.activity_date,activity_time:p.activity_time,title:p.title,description:p.description,category:p.category,status:"draft"}));const {error}=await sb.from("activity_logs").insert(payload);if(error){setNotice("Agenda lama sudah dibersihkan, tetapi penyimpanan file terbaru gagal: "+error.message+". Silakan unggah ulang file.");await loadTomorrowPlans()}else{setNotice("File PHST terbaru berhasil disimpan. "+docPlans.length+" informasi ditampilkan; agenda PHST sebelumnya telah digantikan.");setDocPlans([]);setDocMeta({});setDocName("");await loadModule();await loadTomorrowPlans()}setBusy(false)}
 async function savePlan(e:React.FormEvent){e.preventDefault();if(!profile?.unit_id||!user)return;setBusy(true);setNotice("");const details=["RENCANA KEGIATAN: "+planDescription.trim(),"PERALATAN / BAHAN YANG DIGUNAKAN: "+(planResources.trim()||"Belum ditentukan")].join("\n");const {error}=await sb.from("activity_logs").insert({unit_id:profile.unit_id,created_by:user.id,activity_date:planDate,activity_time:planTime||null,title:planTitle.trim(),description:details,category:planCategory,status:"draft"});if(error)setNotice("Rencana belum tersimpan: "+error.message);else{setNotice("Rencana kegiatan berhasil disimpan sebagai draft.");setPlanTitle("");setPlanDescription("");setPlanResources("");await loadModule();await loadTomorrowPlans()}setBusy(false)}
 const loadModule=useCallback(async()=>{if(!selected?.table||!profile?.unit_id)return;setBusy(true);setNotice("");let q=sb.from(selected.table).select("*").eq("unit_id",profile.unit_id).limit(300);if(selected.table==="personnel")q=q.order("sequence_no",{ascending:true});else if(selected.table==="inventory_items")q=q.order("item_name",{ascending:true});else q=q.order("created_at",{ascending:false});const {data,error}=await q;if(error){setNotice("Data tidak dapat dimuat dengan hak akses akun ini: "+error.message);setRows([])}else setRows((data||[]) as RowData[]);if(module==="NAVYSTOCK"){const {data:m,error:me}=await sb.from("stock_movements").select("*").eq("unit_id",profile.unit_id).order("movement_date",{ascending:false}).limit(100);setMovements((m||[]) as RowData[]);if(me)setNotice("Riwayat transaksi tidak dapat dimuat: "+me.message)}else setMovements([]);setBusy(false)},[selected,profile?.unit_id,module]);
 useEffect(()=>{if(user&&profile?.unit_id&&profile.is_active)loadModule()},[user,profile,loadModule]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const {error}=await sb.auth.signInWithPassword({email:email.trim(),password});if(error)setError("Login gagal. Periksa email/kata sandi atau hubungi administrator.");setBusy(false)}
 const dashboard=useMemo(()=>({personnel:39,stock:rows.length}),[rows.length]);
 const filtered=useMemo(()=>rows.filter(r=>Object.values(r).some(v=>fmt(v).toLowerCase().includes(search.toLowerCase()))),[rows,search]);
 if(loading)return <main className="loading"><div className="loaderglass">NAVYHUB <span>INITIALIZING</span></div></main>;
 if(!user)return <main className="login"><section className="loginbox"><div className="crest">N</div><small>SHIP MANAGEMENT SYSTEM</small><h1>NAVYHUB</h1><p>Integrated ship administration and operational logbook</p><div className="ship">KRI ALAMANG-644 <span>● SECURE ACCESS</span></div><form onSubmit={login}><label>Email akun terdaftar</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label>Kata sandi</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?"Memeriksa…":"Masuk ke NAVYHUB"}</button></form><footer>Akses terbatas untuk pengguna terotorisasi.</footer></section></main>;
 if(!profile?.unit_id||!profile.is_active)return <main className="login"><section className="loginbox"><div className="crest">N</div><small>ACCOUNT ACCESS</small><h1>NAVYHUB</h1><p>Akun berhasil masuk, tetapi belum diaktifkan atau belum ditautkan ke unit.</p><button onClick={()=>sb.auth.signOut()}>Keluar</button></section></main>;
 return <div className="shell"><aside><div className="brand"><div className="crest smallcrest">N</div><div><b>NAVYHUB</b><small>COMMAND & LOGBOOK SYSTEM</small></div></div><div className="ship">KRI ALAMANG-644<small>SATUAN KAPAL CEPAT · KOARMADA I</small></div><nav><label>COMMAND CENTER</label>{visibleMenu.map(m=><button key={m.id} className={module===m.id?"selected":""} onClick={()=>{setModule(m.id);setSearch("");setNotice("")}}><span className="navicon">{m.icon}</span><span>{m.id}<small>{m.desc}</small></span><i>›</i></button>)}</nav><div className="asidefoot"><span className="live-dot"/> SECURE CONNECTION<small>SUPABASE AUTHENTICATED</small></div></aside><main className="main"><header><div><small>FLEET OPERATIONS / {module}</small><h2>{module==="Dashboard"?"Command Center":module}</h2></div><div className="user"><span>{profile.rank_title||""} {profile.full_name||user.email} {isViewer?"· VIEWER":""}</span><button className="logout" onClick={()=>sb.auth.signOut()}>Sign out</button></div></header>
 {module==="Dashboard"?<>{isViewer&&<div className="viewer-notice"><b>MODE VIEWER · READ ONLY</b><span>Anda dapat memantau informasi kapal, tetapi tidak dapat mengubah atau menghapus data.</span></div>}<section className="hero"><div><small>INTEGRATED SHIP MANAGEMENT</small><h1>Welcome aboard, {(profile.full_name||"Operator").split(" ")[0]}.</h1><p>Operational records, maintenance, logistics and personnel in one command environment.</p></div><div className="hero-orb">N<span>644</span></div></section><div className="section-title"><span>LIVE DATABASE OVERVIEW</span><small>REAL SUPABASE RECORDS</small></div><div className="stats"><article><small>PERSONNEL REGISTER</small><b>{dbCounts.personnel}</b><span>Records in NAVYROSTER</span></article><article><small>INVENTORY MASTER</small><b>{dbCounts.inventory}</b><span>Items in NAVYSTOCK</span></article><article><small>STOCK MOVEMENTS</small><b>{dbCounts.movements}</b><span>Recorded transactions</span></article><article><small>ACTIVITY LOGS</small><b>{dbCounts.logs}</b><span>Current database records</span></article></div><div className="section-title"><span>SHIP CONSUMABLES</span><small>LIVE INVENTORY · LITER</small></div><div className="supply-grid">{["Air Tawar","BBM"].map(kind=>{const item=supplyRows.find(r=>r.category===kind);const stock=Number(item?.stock_ready||0);const capacity=Number(item?.capacity_liters||0);const pct=capacity>0?Math.min(100,Math.round(stock/capacity*100)):0;return <article className="supply-card" key={kind}><div className="supply-top"><small>{kind==="Air Tawar"?"FRESH WATER":"FUEL · BBM"}</small><span>{item?"LIVE DATA":"NO DATA"}</span></div><h3>{kind}</h3><div className="supply-amount">{item?stock.toLocaleString("id-ID"):"—"} <small>Liter tersedia</small></div><div className="supply-track"><i style={{width:pct+"%"}}/></div><div className="supply-meta"><span>Kapasitas {item?capacity.toLocaleString("id-ID"):"—"} L</span><b>{item?pct+"%":"—"}</b></div></article>})}</div><section className="panel"><div className="panelhead"><div><h3>Operational modules</h3><p>Open a module to access its live records</p></div><span className="glass-chip">UNIT · KRI ALAMANG-644</span></div><div className="module-grid">{visibleMenu.filter(m=>m.id!=="Dashboard").map(m=><button key={m.id} onClick={()=>setModule(m.id)}><span>{m.icon}</span><b>{m.id}</b><small>{m.desc}</small><i>OPEN ↗</i></button>)}</div></section><footer>NAVYHUB · KRI ALAMANG-644 · KOARMADA I</footer></>:<>{isViewer&&<div className="viewer-notice"><b>MODE VIEWER · READ ONLY</b><span>Akun ini hanya dapat melihat data. Perubahan dan pengelolaan data tidak tersedia.</span></div>}{module!=="NAVYLOG"&&<section className="module-hero"><div><small>OPERATIONAL MODULE</small><h1>{module}</h1><p>{selected?.desc||"Operational management"}</p></div><div className="record-count">{selected?.table?rows.length:"—"}<small>RECORDS</small></div></section>}{selected?.table?<>{module==="NAVYLOG"&&<div className="navylog-board"><section className="panel plan-panel"><div className="panelhead"><div><h3>Agenda Kegiatan Berikutnya</h3><p>Satu tampilan untuk memahami kegiatan, penugasan, dan kesiagaan kapal.</p></div><span className="glass-chip">PHST · AGENDA HARI BERIKUTNYA</span></div>{!isViewer&&<><div className="phst-upload"><label className="upload-label">Pilih dokumen agenda<input type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={handlePhstUpload}/></label>{docBusy&&<span>Memproses dokumen…</span>}{docName&&<small>File: {docName}</small>}</div>{docPlans.length>0&&<><div className="agenda-preview"><div className="agenda-preview-head"><div><b>Agenda kegiatan hari berikutnya</b><small>Hasil pembacaan dokumen · periksa sebelum disimpan</small></div><span>{docPlans.length} KEGIATAN</span></div><div className="agenda-sections">{phstSectionOrder.map(section=>{const items=docPlans.filter(p=>p.category===section);if(!items.length)return null;return <section className={"agenda-section "+section.charAt(0).toLowerCase()} key={section}><div className="agenda-section-title"><span>{section}</span><small>{items.length} {section==="C. UMUM"?"JADWAL":section==="D. KHUSUS"?"DEPARTEMEN":"INFORMASI"}</small></div><div className="agenda-cards">{items.map((p,i)=><article className="agenda-card" key={section+"-"+i}><div className="agenda-time">{p.activity_time||"•"}</div><div className="agenda-content"><h4>{p.title}</h4>{p.description&&<p>{p.description}</p>}</div></article>)}</div></section>})}</div><div className="plan-actions"><small>Agenda disimpan sebagai DRAFT. Peralatan hanya ditampilkan bila tertulis di dokumen.</small><button onClick={importPhstPlans} disabled={busy}>{busy?"Menyimpan…":"Simpan agenda ke NAVYLOG"}</button></div></div></>}</>}</section><section className="panel data-panel"><div className="panelhead"><div><h3>Agenda esok hari</h3><p>Rencana kegiatan yang telah dicatat untuk hari berikutnya</p></div><span className="glass-chip">{tomorrowPlans.length} KEGIATAN</span></div>{tomorrowPlans.length?<><div className="watch-strip">{Object.entries((()=>{const row=tomorrowPlans.find(p=>p.category==="PHST META");const values:Record<string,string>={};(row?.description||"").split("\n").forEach((line:string)=>{const i=line.indexOf(":");if(i>0)values[line.slice(0,i)]=line.slice(i+1).trim()});return values})()).map(([k,v])=><div className="watch-item" key={k}><small>{k}</small><b>{v}</b></div>)}</div><div className="agenda-sections">{phstSectionOrder.map(section=>{const items=tomorrowPlans.filter(p=>p.category===section).sort((a,b)=>(a.activity_time||"99:99").localeCompare(b.activity_time||"99:99"));if(!items.length)return null;return <section className={"agenda-section "+section.charAt(0).toLowerCase()} key={section}><div className="agenda-section-title"><span>{section}</span><small>{items.length} INFORMASI</small></div><div className="agenda-cards">{items.map(p=><article className="agenda-card" key={p.id}><div className="agenda-time">{p.activity_time?.slice(0,5)||"•"}</div><div className="agenda-content"><h4>{p.title}</h4>{p.description&&<p>{p.description}</p>}<small className="agenda-status">{p.status==="draft"?"AGENDA · DRAFT":p.status}</small></div></article>)}</div></section>})}{tomorrowPlans.filter(p=>p.category!=="PHST META"&&!phstSectionOrder.includes(p.category)).length>0&&<section className="agenda-section"><div className="agenda-section-title"><span>AGENDA LAINNYA</span></div><div className="agenda-cards">{tomorrowPlans.filter(p=>p.category!=="PHST META"&&!phstSectionOrder.includes(p.category)).map(p=><article className="agenda-card" key={p.id}><div className="agenda-time">{p.activity_time?.slice(0,5)||"•"}</div><div className="agenda-content"><h4>{p.title}</h4><p>{p.description}</p><small className="agenda-status">AGENDA · DRAFT</small></div></article>)}</div></section>}</div></>:<div className="empty">Belum ada agenda untuk besok. Unggah dokumen Word/PDF dan simpan hasilnya untuk menampilkannya di sini.</div>}</section></div>}{module==="NAVYLOG"&&<DigitalLogbook supabase={sb} unitId={profile.unit_id} userId={user.id} viewer={isViewer}/>}{module!=="NAVYLOG"&&<section className="panel data-panel"><div className="panelhead"><div><h3>{titles[selected.table]||module}</h3><p>Live data from Supabase · RLS protected</p></div><button className="outline" onClick={()=>loadModule()} disabled={busy}>{busy?"Loading…":"↻ Refresh"}</button></div><div className="toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records…"/><span>{filtered.length} / {rows.length} records</span></div>{notice&&<div className="notice">{notice}</div>}{busy?<div className="empty">Loading secured records…</div>:filtered.length?<div className="table-wrap"><table><thead><tr>{(fields[selected.table]||Object.keys(filtered[0])).map(k=><th key={k}>{labels[k]||k.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id||i}>{(fields[selected.table]||Object.keys(r)).map(k=><td key={k}>{fmt(r[k])}</td>)}</tr>)}</tbody></table></div>:<div className="empty">Tidak ada data pada tabel ini atau akun tidak memiliki akses baca.</div>}</section>}{module==="NAVYSTOCK"&&<section className="panel data-panel"><div className="panelhead"><div><h3>Riwayat transaksi stok</h3><p>Movement history · latest 100</p></div><span className="glass-chip">{movements.length} TRANSACTIONS</span></div>{movements.length?<div className="table-wrap"><table><thead><tr>{["movement_date","movement_type","quantity","reference_no","condition_status","movement_purpose","notes"].map(k=><th key={k}>{labels[k]}</th>)}</tr></thead><tbody>{movements.map(r=><tr key={r.id}>{["movement_date","movement_type","quantity","reference_no","condition_status","movement_purpose","notes"].map(k=><td key={k}>{fmt(r[k])}</td>)}</tr>)}</tbody></table></div>:<div className="empty">Belum ada transaksi atau tidak ada akses baca.</div>}</section>}</>:<section className="panel coming"><div className="coming-icon">◇</div><small>MODULE FOUNDATION</small><h3>{module} is not yet connected to an operational database</h3><p>Modul ini belum memiliki tabel khusus pada schema Supabase yang diaudit. Tidak ada data contoh yang ditampilkan. Struktur data, alur kerja, dan hak akses harus ditetapkan sebelum modul diaktifkan.</p><span className="glass-chip">NO MOCK DATA · SECURE BY DESIGN</span></section>}</>}
 <footer className="main-footer">© 2026 NAVYHUB · BLACK SMOKE / SILVER CRYSTAL INTERFACE</footer></main></div>
}
