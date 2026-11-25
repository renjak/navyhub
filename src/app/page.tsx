"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {createClient,type User} from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import DigitalLogbook from "./DigitalLogbook";
import DailyWatchArchive from "./DailyWatchArchive";
import VesselStatus from "./VesselStatus";
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
pdfjsLib.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/legacy/build/pdf.worker.mjs",import.meta.url).toString();
const menu=[
 {id:"Dashboard",label:"DASHBOARD",desc:"Pusat kendali",icon:"⌂"},
 {id:"NAVYLOG",label:"LOGBOOK",desc:"Jurnal kegiatan & serah terima",icon:"▤",table:"activity_logs"},
 {id:"NAVYMAINT",label:"MAINTENANCE",desc:"Pemeliharaan peralatan",icon:"⚙",table:"maintenance_assets"},
 {id:"NAVYSTOCK",label:"STOCK",desc:"Persediaan & logistik",icon:"▣",table:"inventory_items"},
 {id:"NAVYCREW",label:"PERSONEL",desc:"Personel & jadwal jaga",icon:"♙",table:"personnel"},
 {id:"NAVYDOCS",label:"ARCHIVE",desc:"Dokumen & arsip",icon:"▧",table:"daily_watch_reports"},
 {id:"ADMINISTRATION",label:"ADMINISTRATION",desc:"Akun, departemen & hak akses",icon:"⚿"},
];
type Profile={id:string;full_name:string;rank_title:string|null;unit_id:string|null;role:string;is_active:boolean;department_code:string|null;is_department_head:boolean;can_access_class_v:boolean};
type RowData=Record<string,any>;
type ImportedPlan={activity_date:string;activity_time:string|null;title:string;description:string;category:string};
type StockClass={id:string;title:string;name:string;description:string;defaultCategory:string;subgroups:string[]};
const stockClasses:StockClass[]=[
 {id:"I",title:"CLASS I",name:"SUBSISTENCE",description:"Bahan makanan, air minum dan kebutuhan konsumsi kapal",defaultCategory:"Class I · Subsistence",subgroups:["Air Tawar","Perbekalan kering","Cold storage","Air minum galon"]},
 {id:"III",title:"CLASS III",name:"FUEL",description:"HSD dan bahan bakar perahu penyelamat",defaultCategory:"BBM",subgroups:["HSD","BBM perahu penyelamat"]},
 {id:"IV",title:"CLASS IV",name:"DAMAGE CONTROL",description:"Perlengkapan pemadam, penanggulangan kebocoran dan perbaikan darurat",defaultCategory:"Class IV · Damage Control",subgroups:["Pemadam kebakaran","Material perbaikan darurat","Pengendalian banjir/kebocoran","Peralatan pendukung"]},
 {id:"V",title:"CLASS V",name:"AMMUNITION",description:"Inventaris amunisi dengan akses terbatas dan pencatatan akuntabilitas",defaultCategory:"Amunisi",subgroups:["Inventaris dan rekonsiliasi terbatas"]},
 {id:"VIII",title:"CLASS VIII",name:"MEDICAL STORES",description:"Obat-obatan dan perlengkapan kesehatan",defaultCategory:"Class VIII · Medical Stores",subgroups:["Obat-obatan","P3K dan wound care","Bahan medis habis pakai","Diagnostik"]},
 {id:"IX",title:"CLASS IX",name:"SPARE PARTS",description:"Suku cadang mesin, elektronika, listrik dan perlengkapan geladak",defaultCategory:"Class IX · Spare Parts",subgroups:["Mesin","Elektronika dan listrik","Tali-temali dan deck equipment","Cat dan bahan pemeliharaan"]}
];
function itemBelongsToStockClass(item:RowData,classId:string){
 if(item.supply_class)return String(item.supply_class)===classId;
 const c=String(item.category||"").toLowerCase().trim();
 if(classId==="I")return ["air tawar","class i · subsistence","subsistence","provisions"].includes(c)||c.startsWith("class i -");
 if(classId==="III")return ["bbm","class iii · fuel","fuel","hsd","bahan bakar"].includes(c)||c.startsWith("class iii -");
 if(classId==="IV")return c.includes("damage control")||c.startsWith("class iv");
 if(classId==="V")return c==="amunisi"||c.includes("class v");
 if(classId==="VIII")return c.includes("medical stores")||c.startsWith("class viii");
 if(classId==="IX")return c.includes("spare parts")||c.startsWith("class ix");
 return false;
}
const phstSectionOrder=["A. SITUASI","B. TUGAS POKOK","C. UMUM","D. KHUSUS","F. LAIN-LAIN"];
const departmentOrder=["OPS","SIN","EKA","LOG"] as const;
function normalizeDepartment(value:string):typeof departmentOrder[number]|null{const v=value.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();if(/\bOPS\b|OPERASI/.test(v))return "OPS";if(/\bSIN\b|SENJATA/.test(v))return "SIN";if(/\bEKA\b|ELEKTRONIK/.test(v))return "EKA";if(/\bLOG\b|LOGISTIK/.test(v))return "LOG";return null;}
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
  if(/^(?:E|F)\.\s*LAIN/i.test(line)){section="F. LAIN-LAIN";inGeneral=false;continue}
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
     const dept=normalizeDepartment(cells[1].replace(/^\d+\s*/,"").trim());
     if(!dept)continue;
     const activities=(cells[2]||"").split(/\s+-\s+/).map(x=>x.replace(/^[-•]\s*/,"").trim()).filter(Boolean);
     const risk=(cells[3]||"").trim();
     push(section,dept,["Kegiatan:",...activities.map(x=>"• "+x),risk?"Manajemen risiko: "+risk:""].filter(Boolean).join("\n"));
    }
   }
   continue;
  }
  if(section==="F. LAIN-LAIN"){
   const m=line.match(/^[a-z]\.?\s*(.+)$/i);const val=(m?m[1]:line).replace(/^[-•–]\s*/,"").trim();
   if(val)push(section,val);
  }
 }
 return out;
}
const titles:Record<string,string>={activity_logs:"Jurnal Kegiatan",maintenance_assets:"Daftar Aset",maintenance_records:"Riwayat Pemeliharaan",inventory_items:"Master Persediaan",stock_movements:"Transaksi Persediaan",checklists:"Template Checklist",checklist_items:"Item Checklist",checklist_runs:"Pelaksanaan Checklist",personnel:"Daftar Personel",daily_watch_reports:"Arsip Serah Terima Jaga"};
const fields:Record<string,string[]>={activity_logs:["activity_date","activity_time","title","category","description","status"],maintenance_assets:["asset_code","asset_name","category","location_label","condition_label","is_active"],maintenance_records:["report_date","issue_description","action_taken","status"],inventory_items:["item_code","item_name","category","unit_of_measure","initial_quantity","stock_ready","stock_unready","minimum_stock","brand","caliber","caliber_unit","secondary_caliber","ammo_type","lot_no","manufacture_year","country_of_origin","unit_price","capacity_liters","is_active"],stock_movements:["movement_date","movement_type","quantity","reference_no","condition_status","movement_purpose","notes"],checklists:["title","category","description","is_active"],checklist_items:["item_order","item_label","is_required"],checklist_runs:["performed_at","summary"],personnel:["sequence_no","full_name","rank_title","position","roster_period"]};
const labels:Record<string,string>={activity_date:"Tanggal",activity_time:"Waktu",title:"Judul",category:"Kategori",description:"Uraian",status:"Status",asset_code:"Kode aset",asset_name:"Nama aset",location_label:"Lokasi",condition_label:"Kondisi",is_active:"Aktif",report_date:"Tanggal laporan",issue_description:"Kerusakan",action_taken:"Tindakan",item_code:"Kode barang",item_name:"Nama barang",unit_of_measure:"Satuan",stock_ready:"Stok siap",stock_unready:"Stok tidak siap",minimum_stock:"Stok minimum",brand:"Merek",caliber:"Kaliber",caliber_unit:"Satuan kaliber",secondary_caliber:"Kaliber sekunder",ammo_type:"Jenis amunisi",lot_no:"Nomor lot",manufacture_year:"Tahun produksi",country_of_origin:"Negara asal",unit_price:"Harga satuan",initial_quantity:"Jumlah awal",capacity_liters:"Kapasitas (L)",movement_date:"Tanggal transaksi",movement_type:"Jenis transaksi",quantity:"Jumlah",reference_no:"Nomor referensi",condition_status:"Kondisi",movement_purpose:"Tujuan",notes:"Catatan",item_order:"Urutan",item_label:"Item pemeriksaan",is_required:"Wajib",performed_at:"Waktu pelaksanaan",summary:"Ringkasan",sequence_no:"No.",full_name:"Nama",rank_title:"Pangkat",nrp:"NRP",position:"Jabatan",roster_period:"Periode",remarks:"Keterangan"};
const fmt=(v:any)=>v===null||v===undefined||v===""?"—":typeof v==="boolean"?(v?"Ya":"Tidak"):typeof v==="object"?JSON.stringify(v):String(v);
function parseWatchMeta(description?:string){const values:Record<string,string>={};for(const line of (description||"").split("\n")){const i=line.indexOf(":");if(i>0)values[line.slice(0,i)]=line.slice(i+1).trim()}return values}
export default function Home(){
 const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[module,setModule]=useState("Dashboard"),[rows,setRows]=useState<RowData[]>([]),[movements,setMovements]=useState<RowData[]>([]),[search,setSearch]=useState(""),[notice,setNotice]=useState("");
 const [dbCounts,setDbCounts]=useState({personnel:"—",inventory:"—",movements:"—",logs:"—"});
 const [accountRows,setAccountRows]=useState<RowData[]>([]),[accountBusy,setAccountBusy]=useState(false),[accountError,setAccountError]=useState("");
 const [accountEditDraft,setAccountEditDraft]=useState<RowData|null>(null),[accountEditSaving,setAccountEditSaving]=useState(false);
 const [editingCell,setEditingCell]=useState<{id:string;field:string}|null>(null),[cellDraft,setCellDraft]=useState("");
 const [cellSaving,setCellSaving]=useState(false);
 const [supplyRows,setSupplyRows]=useState<RowData[]>([]);
 const [supplyDraft,setSupplyDraft]=useState<RowData|null>(null),[supplySaving,setSupplySaving]=useState(false);
 const [stockDraft,setStockDraft]=useState<RowData|null>(null),[stockSaving,setStockSaving]=useState(false);
 const [maintenanceRows,setMaintenanceRows]=useState<RowData[]>([]),[maintenanceDraft,setMaintenanceDraft]=useState<RowData|null>(null),[maintenanceSaving,setMaintenanceSaving]=useState(false);
 const [assetDraft,setAssetDraft]=useState<RowData|null>(null),[assetSaving,setAssetSaving]=useState(false),[maintSection,setMaintSection]=useState("ALL");
 const [movementDraft,setMovementDraft]=useState<RowData|null>(null),[movementSaving,setMovementSaving]=useState(false);
 const [expandedStockClass,setExpandedStockClass]=useState<string|null>("I");
 const [crewDraft,setCrewDraft]=useState<RowData|null>(null),[crewSaving,setCrewSaving]=useState(false);
 const [planDate,setPlanDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()+1);return d.toLocaleDateString("en-CA")});
 const [planTime,setPlanTime]=useState("07:00");
 const [planTitle,setPlanTitle]=useState("");
 const [planCategory,setPlanCategory]=useState("Umum");
 const [planDescription,setPlanDescription]=useState("");
 const [planResources,setPlanResources]=useState("");
 const [tomorrowPlans,setTomorrowPlans]=useState<RowData[]>([]);
 const [deptEditDraft,setDeptEditDraft]=useState<RowData|null>(null),[deptEditSaving,setDeptEditSaving]=useState(false);
 const [docPlans,setDocPlans]=useState<ImportedPlan[]>([]);
 const [docMeta,setDocMeta]=useState<Record<string,string>>({});
 const [docName,setDocName]=useState("");
 const [docBusy,setDocBusy]=useState(false);
 const refreshProfile=useCallback(async(u:User)=>{const {data,error}=await sb.from("profiles").select("id,full_name,rank_title,unit_id,role,is_active,department_code,is_department_head,can_access_class_v").eq("id",u.id).maybeSingle();if(error)throw error;setProfile(data as Profile|null)},[]);
 useEffect(()=>{let alive=true;sb.auth.getSession().then(async({data})=>{const u=data.session?.user??null;if(!alive)return;setUser(u);if(u){try{await refreshProfile(u)}catch(e){setError("Gagal memuat profil akun.")}}setLoading(false)});const {data:listener}=sb.auth.onAuthStateChange((_event,session)=>{const u=session?.user??null;setUser(u);if(!u){setProfile(null);setRows([]);setMovements([])}else{setTimeout(()=>refreshProfile(u).catch(()=>setError("Gagal memuat profil.")),0)}});return()=>{alive=false;listener.subscription.unsubscribe()}},[refreshProfile]);
 const isViewer=profile?.role==="viewer";
 const isAdmin=profile?.role==="admin";
 const canManage=profile?.role==="admin"||profile?.role==="commander";
 const canAccessClassV=canManage||profile?.can_access_class_v===true;
 const canOperate=["admin","commander","officer","operator"].includes(profile?.role||"");
 const visibleMenu=useMemo(()=>menu.filter(m=>m.id!=="ADMINISTRATION"||isAdmin),[isAdmin]);
 const selected=menu.find(m=>m.id===module);
 useEffect(()=>{if(!visibleMenu.some(m=>m.id===module))setModule("Dashboard")},[visibleMenu,module]);
 useEffect(()=>{if(module!=="ADMINISTRATION"||!isAdmin||!profile?.unit_id)return;let alive=true;setAccountBusy(true);setAccountError("");sb.from("profiles").select("id,full_name,rank_title,role,is_active,department_code,is_department_head,can_access_class_v").eq("unit_id",profile.unit_id).order("full_name",{ascending:true}).then(({data,error})=>{if(!alive)return;if(error){setAccountError("Direktori akun gagal dimuat: "+error.message);setAccountRows([])}else setAccountRows((data||[]) as RowData[]);setAccountBusy(false)});return()=>{alive=false}},[module,isAdmin,profile?.unit_id]);
 useEffect(()=>{if(!profile?.unit_id)return;let live=true;(async()=>{const names=["personnel","inventory_items","stock_movements","activity_logs"];const results=await Promise.all(names.map(table=>sb.from(table).select("*",{count:"exact",head:true}).eq("unit_id",profile.unit_id!)));if(live)setDbCounts({personnel:results[0].error?"—":String(results[0].count??0),inventory:results[1].error?"—":String(results[1].count??0),movements:results[2].error?"—":String(results[2].count??0),logs:results[3].error?"—":String(results[3].count??0)})})();return()=>{live=false}},[profile?.unit_id]);
 useEffect(()=>{if(!profile?.unit_id)return;let live=true;(async()=>{const {data,error}=await sb.from("inventory_items").select("id,item_name,category,capacity_liters,stock_ready,stock_unready,unit_of_measure").eq("unit_id",profile.unit_id!).eq("is_active",true).in("category",["Air Tawar","BBM"]);if(live)setSupplyRows(error?[]:(data||[]) as RowData[])})();return()=>{live=false}},[profile?.unit_id]);
 const loadTomorrowPlans=useCallback(async()=>{if(!profile?.unit_id)return;const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");const {data,error}=await sb.from("activity_logs").select("id,activity_date,activity_time,title,description,category,status").eq("unit_id",profile.unit_id).gte("activity_date",today).order("activity_date",{ascending:true}).order("activity_time",{ascending:true});if(error){setNotice("Agenda tersimpan tidak dapat dimuat: "+error.message);return}const rows=(data||[]) as RowData[];const nextDate=rows[0]?.activity_date;setTomorrowPlans(nextDate?rows.filter(p=>p.activity_date===nextDate):[])},[profile?.unit_id]);
 const agendaDutyMeta=useMemo(()=>parseWatchMeta(tomorrowPlans.find(p=>p.category==="PHST META")?.description),[tomorrowPlans]);
 const agendaVisibleRows=useMemo(()=>tomorrowPlans.filter(p=>p.category!=="PHST META"&&p.category!=="D. KHUSUS"&&(!p.activity_time||p.activity_time.slice(0,5)<="22:00")),[tomorrowPlans]);
 const agendaDeptRows=useMemo(()=>departmentOrder.map(code=>tomorrowPlans.find(p=>p.category==="D. KHUSUS"&&normalizeDepartment(String(p.title||""))===code)||{id:"dept-"+code,title:code,description:"",category:"D. KHUSUS",activity_date:tomorrowPlans[0]?.activity_date}),[tomorrowPlans]);
 async function saveAccountScope(){
  if(!isAdmin||!profile?.unit_id||!accountEditDraft?.id){setNotice("Hanya Admin yang dapat menetapkan departemen akun.");return}
  if(accountEditDraft.is_department_head&&!accountEditDraft.department_code){setNotice("Pilih departemen sebelum menetapkan Kepala Departemen.");return}
  if(accountEditDraft.id===profile.id){setNotice("Profil Admin utama tidak dapat diubah melalui direktori ini.");return}
  setAccountEditSaving(true);setNotice("");
  const {data,error}=await sb.from("profiles").update({department_code:accountEditDraft.department_code||null,is_department_head:!!accountEditDraft.is_department_head,can_access_class_v:!!accountEditDraft.can_access_class_v,updated_at:new Date().toISOString()}).eq("id",accountEditDraft.id).eq("unit_id",profile.unit_id).neq("role","admin").select("id,department_code,is_department_head,can_access_class_v").maybeSingle();
  if(error)setNotice("Penetapan akses gagal: "+error.message);
  else if(!data)setNotice("Tidak ada perubahan. Pastikan akun bukan Admin utama dan kebijakan Admin mengizinkan perubahan profil.");
  else{setAccountRows(old=>old.map(row=>row.id===data.id?{...row,...data}:row));setNotice("Departemen dan hak akses akun berhasil diperbarui.");setAccountEditDraft(null)}
  setAccountEditSaving(false);
 }
 async function saveDeptAgenda(){if(!canManage||!profile?.unit_id||!deptEditDraft?.id){setNotice("Hanya Admin atau Komandan yang dapat mengubah kegiatan departemen.");return}const title=normalizeDepartment(String(deptEditDraft.title||""));const description=String(deptEditDraft.description||"").trim();if(!title){setNotice("Departemen harus OPS, SIN, EKA, atau LOG.");return}setDeptEditSaving(true);const payload={title,description,category:"D. KHUSUS"};const result=deptEditDraft.id&&String(deptEditDraft.id).startsWith("dept-")?await sb.from("activity_logs").insert({unit_id:profile.unit_id,created_by:user?.id,activity_date:deptEditDraft.activity_date||tomorrowPlans[0]?.activity_date,activity_time:null,status:"draft",...payload}):await sb.from("activity_logs").update(payload).eq("id",deptEditDraft.id).eq("unit_id",profile.unit_id);if(result.error){setNotice("Kegiatan departemen gagal disimpan: "+result.error.message)}else{setNotice("Kegiatan departemen "+title+" berhasil disimpan.");setDeptEditDraft(null);await loadTomorrowPlans()}setDeptEditSaving(false)}
 useEffect(()=>{if(user&&profile?.unit_id)loadTomorrowPlans()},[user,profile?.unit_id,loadTomorrowPlans]);
 async function handlePhstUpload(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;setDocBusy(true);setNotice("");setDocName(file.name);try{const ext=file.name.toLowerCase();const lines=ext.endsWith(".docx")?await readDocxText(file):ext.endsWith(".pdf")?await readPdfText(file):(()=>{throw new Error("Gunakan dokumen Word (.docx) atau PDF (.pdf).")})();const parsed=parsePhstLines(lines);if(!parsed.length)throw new Error("Tidak ditemukan bagian A sampai E atau jadwal kegiatan. Periksa format PHST.");const meta=parsePhstHeader(lines);setDocMeta(meta);if(Object.keys(meta).length)parsed.push({activity_date:parsed[0].activity_date,activity_time:null,title:"Petugas dan kesiapan jaga",description:Object.entries(meta).map(([k,v])=>k+": "+v).join("\n"),category:"PHST META"});setDocPlans(parsed);setNotice("Dokumen berhasil dibaca. Periksa hasil ekstraksi sebelum menyimpan ke NAVYLOG.")}catch(err){setDocPlans([]);setNotice(err instanceof Error?err.message:"Dokumen gagal diproses.")}finally{setDocBusy(false);e.target.value=""}}
 async function importPhstPlans(){
  if(!profile?.unit_id||!user||!docPlans.length){setNotice("Pastikan akun, unit, dan dokumen PHST sudah tersedia.");return;}
  setBusy(true);setNotice("");
  const phstCategories=["A. SITUASI","B. TUGAS POKOK","C. UMUM","D. KHUSUS","E. LAIN-LAIN","F. LAIN-LAIN","PHST META"];
  const {data:existingRows,error:readError}=await sb.from("activity_logs").select("activity_date,activity_time,title,description,category").eq("unit_id",profile.unit_id).in("category",phstCategories);
  if(readError){setNotice("Riwayat PHST tidak dapat diverifikasi; tidak ada data yang diubah: "+readError.message);setBusy(false);return;}
  const canonicalCategory=(value:string)=>value==="E. LAIN-LAIN"?"F. LAIN-LAIN":value;
  const recordKey=(row:any)=>JSON.stringify([row.activity_date,row.activity_time||null,String(row.title||"").trim(),String(row.description||"").trim(),canonicalCategory(String(row.category||""))]);
  const existingKeys=new Set((existingRows||[]).map(recordKey));
  const newPlans=docPlans.filter(plan=>{const key=recordKey(plan);if(existingKeys.has(key))return false;existingKeys.add(key);return true;});
  if(!newPlans.length){setNotice("Seluruh isi PHST sudah tercatat. Tidak ada data yang ditambahkan dan riwayat tetap utuh.");setBusy(false);return;}
  const payload=newPlans.map(p=>({unit_id:profile.unit_id,created_by:user.id,activity_date:p.activity_date,activity_time:p.activity_time,title:p.title,description:p.description,category:canonicalCategory(p.category),status:"draft"}));
  const {error:insertError}=await sb.from("activity_logs").insert(payload);
  if(insertError){setNotice("PHST gagal disimpan. Riwayat lama tetap aman: "+insertError.message);await loadTomorrowPlans();}
  else{
   setNotice("PHST berhasil disimpan tanpa menghapus riwayat. "+newPlans.length+" data baru ditambahkan; "+(docPlans.length-newPlans.length)+" data identik dilewati.");
   setDocPlans([]);setDocMeta({});setDocName("");await loadModule();await loadTomorrowPlans();
  }
  setBusy(false);
 }
 async function savePlan(e:React.FormEvent){e.preventDefault();if(!profile?.unit_id||!user){setNotice("Akun belum terhubung ke unit.");return;}setBusy(true);setNotice("");const details=["RENCANA KEGIATAN: "+planDescription.trim(),"PERALATAN / BAHAN YANG DIGUNAKAN: "+(planResources.trim()||"Belum ditentukan")].join("\n");const {error}=await sb.from("activity_logs").insert({unit_id:profile.unit_id,created_by:user.id,activity_date:planDate,activity_time:planTime||null,title:planTitle.trim(),description:details,category:planCategory,status:"draft"});if(error)setNotice("Rencana belum tersimpan: "+error.message);else{setNotice("Rencana kegiatan berhasil disimpan sebagai draft.");setPlanTitle("");setPlanDescription("");setPlanResources("");await loadModule();await loadTomorrowPlans()}setBusy(false)}
 const loadModule=useCallback(async()=>{if(!selected?.table||!profile?.unit_id)return;setBusy(true);setNotice("");let q=selected.table==="personnel"?sb.from("personnel").select("id,unit_id,roster_period,sequence_no,full_name,rank_title,position,created_at,updated_at").eq("unit_id",profile.unit_id).limit(500):sb.from(selected.table).select("*").eq("unit_id",profile.unit_id).limit(500);if(selected.table==="inventory_items"&&!canAccessClassV)q=q.neq("supply_class","V");if(selected.table==="personnel")q=q.order("sequence_no",{ascending:true});else if(selected.table==="inventory_items")q=q.order("item_name",{ascending:true});else q=q.order("created_at",{ascending:false});const {data,error}=await q;if(error){setNotice("Data tidak dapat dimuat dengan hak akses akun ini: "+error.message);setRows([])}else setRows((data||[]) as RowData[]);if(module==="NAVYSTOCK"){const {data:m,error:me}=await sb.from("stock_movements").select("*").eq("unit_id",profile.unit_id).order("movement_date",{ascending:false}).limit(100);setMovements((m||[]) as RowData[]);if(me)setNotice("Riwayat transaksi tidak dapat dimuat: "+me.message)}else setMovements([]);if(module==="NAVYMAINT"){const {data:m,error:me}=await sb.from("maintenance_records").select("*").eq("unit_id",profile.unit_id).order("report_date",{ascending:false}).limit(200);setMaintenanceRows((m||[]) as RowData[]);if(me)setNotice("Riwayat pemeliharaan tidak dapat dimuat: "+me.message)}else setMaintenanceRows([]);setBusy(false)},[selected,profile?.unit_id,module,canManage,canAccessClassV]);
 useEffect(()=>{if(user&&profile?.unit_id&&profile.is_active)loadModule()},[user,profile,loadModule]);
 const saveInlineCell=async(row:RowData,field:string)=>{if(!canManage||!profile?.unit_id||!row.id)return;const numeric=["sequence_no","minimum_stock","initial_quantity","stock_ready","stock_unready","unit_price","capacity_liters","manufacture_year"];const dateFields=["roster_period","birth_date"];let value:any=cellDraft;if(field==="is_active")value=cellDraft==="true";else if(numeric.includes(field))value=cellDraft.trim()===""?null:Number(cellDraft);else if(dateFields.includes(field))value=cellDraft.trim()||null;else value=cellDraft.trim()||null;if(numeric.includes(field)&&value!==null&&(!Number.isFinite(value)||(field==="manufacture_year"&&!Number.isInteger(value)))){setNotice("Nilai harus berupa angka yang valid.");return}setCellSaving(true);const {data,error}=await sb.from(selected?.table||"").update({[field]:value,updated_at:new Date().toISOString()}).eq("id",row.id).eq("unit_id",profile.unit_id).select("id").maybeSingle();if(error)setNotice("Perubahan gagal disimpan: "+error.message);else if(!data)setNotice("Tidak ada baris yang diperbarui. Periksa izin edit dan unit aktif.");else{setRows(old=>old.map(x=>x.id===row.id?{...x,[field]:value}:x));setNotice("Kolom berhasil diperbarui.");}setCellSaving(false);setEditingCell(null)};
 const saveStockItem=async()=>{
  if(!canManage||!profile?.unit_id||!stockDraft){setNotice("Akun tidak memiliki hak kelola atau data unit belum tersedia.");return}
  const itemCode=String(stockDraft.item_code||"").trim();
  const itemName=String(stockDraft.item_name||"").trim();
  if(!itemCode||!itemName){setNotice("Kode dan nama barang wajib diisi.");return}
  setStockSaving(true);setNotice("");
  try{
   const numeric=["minimum_stock","unit_price","capacity_liters","manufacture_year"];
   const payload:any={};
   for(const k of ["item_code","item_name","category","unit_of_measure","brand","caliber","caliber_unit","secondary_caliber","ammo_type","lot_no","country_of_origin"]){
    const value=String(stockDraft[k]??"").trim();
    payload[k]=value||(k==="category"?"Logistik":k==="unit_of_measure"?"unit":null);
   }
   for(const k of numeric){
    const raw=stockDraft[k];
    const value=raw===""||raw===null||raw===undefined?null:Number(raw);
    if(value!==null&&(!Number.isFinite(value)||(k==="manufacture_year"&&!Number.isInteger(value)))){
     setNotice("Nilai "+k.replaceAll("_"," ")+" harus berupa angka yang valid.");return;
    }
    payload[k]=k==="minimum_stock"&&value===null?0:value;
   }
   payload.supply_class=stockDraft.supply_class||null;
   payload.department_code=stockDraft.department_code||null;
   payload.is_active=stockDraft.is_active!==false;
   payload.updated_at=new Date().toISOString();
   let result:any;
   if(stockDraft.id){
    result=await sb.from("inventory_items").update(payload).eq("id",stockDraft.id).eq("unit_id",profile.unit_id).select("id").maybeSingle();
    if(!result.error&&!result.data){setNotice("Data tidak berubah: baris tidak ditemukan pada unit ini atau akun tidak memiliki izin UPDATE. Periksa role admin/komandan dan kebijakan akses.");return}
   }else{
    result=await sb.from("inventory_items").insert({...payload,unit_id:profile.unit_id}).select("id").single();
   }
   if(result.error){setNotice("STOCK gagal disimpan: "+result.error.message);return}
   setNotice(stockDraft.id?"Perubahan data persediaan berhasil disimpan.":"Barang baru berhasil ditambahkan.");
   setStockDraft(null);
   await loadModule();
  }catch(error:any){
   setNotice("STOCK gagal disimpan: "+(error?.message||"Kesalahan tidak diketahui"));
  }finally{
   setStockSaving(false);
  }
 };
 async function saveSupplyData(){
  if(!isAdmin||!profile?.unit_id||!user||!supplyDraft){setNotice("Hanya admin yang dapat mengubah data Air Tawar dan HSD.");return}
  const current=Number(supplyDraft.stock_ready_current||0),target=Number(supplyDraft.target_stock),capacity=Number(supplyDraft.capacity_liters);
  if(!Number.isFinite(target)||target<0||!Number.isFinite(capacity)||capacity<=0){setNotice("Stok dan kapasitas harus berupa angka nol atau lebih.");return}
  if(capacity>0&&target>capacity){setNotice("Stok tersedia tidak boleh melebihi kapasitas tangki.");return}
  setSupplySaving(true);setNotice("");
  try{
   const delta=target-current;
   if(delta!==0){
    const {error}=await sb.from("stock_movements").insert({unit_id:profile.unit_id,item_id:supplyDraft.id,movement_type:delta>0?"inbound":"outbound",quantity:Math.abs(delta),movement_date:new Date().toISOString().slice(0,10),condition_status:"not_applicable",movement_purpose:"Penyesuaian stok oleh admin melalui Dashboard",notes:"Penyesuaian saldo "+(supplyDraft.category==="Air Tawar"?"Air Tawar":"HSD"),recorded_by:user.id});
    if(error)throw new Error("Penyesuaian stok gagal: "+error.message);
   }
   const {error:capacityError}=await sb.from("inventory_items").update({capacity_liters:capacity,updated_at:new Date().toISOString()}).eq("id",supplyDraft.id).eq("unit_id",profile.unit_id);
   if(capacityError)throw new Error("Stok tercatat, tetapi pembaruan kapasitas gagal: "+capacityError.message);
   const {data,error:refreshError}=await sb.from("inventory_items").select("id,item_name,category,capacity_liters,stock_ready,stock_unready,unit_of_measure").eq("unit_id",profile.unit_id).eq("is_active",true).in("category",["Air Tawar","BBM"]);
   if(refreshError)throw new Error("Data tersimpan, tetapi tampilan belum dapat diperbarui: "+refreshError.message);
   setSupplyRows((data||[]) as RowData[]);setSupplyDraft(null);setNotice("Data "+(supplyDraft.category==="Air Tawar"?"Air Tawar":"HSD")+" berhasil diperbarui. Penyesuaian saldo tercatat pada riwayat transaksi.");
  }catch(error:any){setNotice(error?.message||"Perubahan data gagal disimpan.")}
  finally{setSupplySaving(false)}
 }
 async function saveAsset(){if(!profile?.unit_id||!assetDraft){setNotice("Data aset atau unit belum tersedia.");return;}const code=String(assetDraft.asset_code||"").trim(),name=String(assetDraft.asset_name||"").trim();if(!code||!name){setNotice("Kode dan nama aset wajib diisi.");return}setAssetSaving(true);const payload={asset_code:code,asset_name:name,category:String(assetDraft.category||"Peralatan"),location_label:String(assetDraft.location_label||"").trim()||null,condition_label:String(assetDraft.condition_label||"Baik"),is_active:assetDraft.is_active!==false,unit_id:profile.unit_id};const result=assetDraft.id?await sb.from("maintenance_assets").update(payload).eq("id",assetDraft.id).eq("unit_id",profile.unit_id):await sb.from("maintenance_assets").insert(payload);setNotice(result.error?"Data aset gagal disimpan: "+result.error.message:"Data aset berhasil disimpan.");if(!result.error){setAssetDraft(null);await loadModule()}setAssetSaving(false)}
 async function saveMaintenance(){if(!profile?.unit_id||!user||!maintenanceDraft){setNotice("Data laporan atau akun belum tersedia.");return;}const issue=String(maintenanceDraft.issue_description||"").trim();if(!issue){setNotice("Uraian kerusakan wajib diisi.");return}setMaintenanceSaving(true);const {error}=await sb.from("maintenance_records").insert({unit_id:profile.unit_id,asset_id:maintenanceDraft.asset_id||null,report_date:maintenanceDraft.report_date||new Date().toISOString().slice(0,10),issue_description:issue,action_taken:String(maintenanceDraft.action_taken||"").trim()||null,status:"reported",reported_by:user.id});setNotice(error?"Laporan pemeliharaan gagal disimpan: "+error.message:"Laporan kerusakan berhasil dicatat.");if(!error){setMaintenanceDraft(null);await loadModule()}setMaintenanceSaving(false)}
 async function updateMaintenanceStatus(row:RowData,status:string){if(!["admin","commander"].includes(profile?.role||"")){setNotice("Hanya pengelola unit yang dapat mengubah status pemeliharaan.");return}const payload:any={status,updated_at:new Date().toISOString()};if(status==="completed")payload.completed_at=new Date().toISOString();const {error}=await sb.from("maintenance_records").update(payload).eq("id",row.id).eq("unit_id",profile?.unit_id);setNotice(error?"Status pemeliharaan gagal diperbarui: "+error.message:"Status pemeliharaan diperbarui.");if(!error)await loadModule()}
 async function saveMovement(){if(!profile?.unit_id||!user||!movementDraft){setNotice("Data transaksi atau akun belum tersedia.");return;}const item=String(movementDraft.item_id||"");const qty=Number(movementDraft.quantity);if(!item||!Number.isFinite(qty)||qty<=0){setNotice("Pilih barang dan masukkan jumlah transaksi lebih dari nol.");return}setMovementSaving(true);const {error}=await sb.from("stock_movements").insert({unit_id:profile.unit_id,item_id:item,movement_type:movementDraft.movement_type,quantity:qty,movement_date:movementDraft.movement_date||new Date().toISOString().slice(0,10),reference_no:String(movementDraft.reference_no||"").trim()||null,condition_status:movementDraft.condition_status||"ready",movement_purpose:String(movementDraft.movement_purpose||"").trim()||null,notes:String(movementDraft.notes||"").trim()||null,recorded_by:user.id});setNotice(error?"Transaksi stok ditolak: "+error.message:"Transaksi berhasil dicatat dan saldo diperbarui oleh database.");if(!error){setMovementDraft(null);await loadModule()}setMovementSaving(false)}
 async function saveCrew(){
  if(!profile?.unit_id||!crewDraft){setNotice("Data personel atau unit belum tersedia.");return;}
  const sequence=Number(crewDraft.sequence_no);
  const fullName=String(crewDraft.full_name||"").trim();
  if(!fullName||!Number.isInteger(sequence)||sequence<1){setNotice("Nomor urut bilangan bulat positif dan nama personel wajib diisi.");return;}
  const payload:any={sequence_no:sequence,full_name:fullName,rank_title:String(crewDraft.rank_title||"").trim()||null,position:String(crewDraft.position||"").trim()||null,roster_period:String(crewDraft.roster_period||"").trim()||new Date().toISOString().slice(0,10)};
  setCrewSaving(true);
  const result=crewDraft.id?await sb.from("personnel").update(payload).eq("id",crewDraft.id).eq("unit_id",profile.unit_id):await sb.from("personnel").insert({...payload,unit_id:profile.unit_id});
  setNotice(result.error?"Data personel gagal disimpan: "+result.error.message:"Data personel berhasil disimpan. Kolom pribadi tidak diubah.");
  if(!result.error){setCrewDraft(null);await loadModule();}
  setCrewSaving(false);
 }
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const {error}=await sb.auth.signInWithPassword({email:email.trim(),password});if(error)setError("Login gagal. Periksa email/kata sandi atau hubungi administrator.");setBusy(false)}
 const dashboard=useMemo(()=>({personnel:39,stock:rows.length}),[rows.length]);
 const maintRows=useMemo(()=>module!=="NAVYMAINT"||maintSection==="ALL"?rows:rows.filter(r=>{const c=String(r.category||"").toUpperCase();return maintSection==="PLATFORM"?c.includes("PLATFORM"):c.includes("SEWACO")||(!c.includes("PLATFORM")&&!c.includes("SEWACO"))}),[rows,module,maintSection]);const filtered=useMemo(()=>maintRows.filter(r=>Object.values(r).some(v=>fmt(v).toLowerCase().includes(search.toLowerCase()))),[maintRows,search]);
 const waterItem=supplyRows.find(r=>r.category==="Air Tawar"),fuelItem=supplyRows.find(r=>r.category==="BBM");
 const waterStock=Number(waterItem?.stock_ready||0),waterCapacity=Number(waterItem?.capacity_liters||0),waterPct=waterCapacity>0?Math.min(100,Math.round(waterStock/waterCapacity*100)):0;
 const fuelStock=Number(fuelItem?.stock_ready||0),fuelCapacity=Number(fuelItem?.capacity_liters||0),fuelPct=fuelCapacity>0?Math.min(100,Math.round(fuelStock/fuelCapacity*100)):0;
 if(loading)return <main className="loading"><div className="loaderglass">ALNAV DMS <span>INITIALIZING</span></div></main>;
 if(!user)return <main className="login"><section className="loginbox"><div className="crest">N</div><small>SHIP MANAGEMENT SYSTEM</small><h1>ALNAV DMS</h1><p>Integrated ship administration and operational logbook</p><div className="ship">KRI ALAMANG-644 <span>● SECURE ACCESS</span></div><form onSubmit={login}><label>Email akun terdaftar</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label>Kata sandi</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?"Memeriksa…":"Masuk ke ALNAV DMS"}</button></form><footer>Akses terbatas untuk pengguna terotorisasi.</footer></section></main>;
 if(!profile?.unit_id||!profile.is_active)return <main className="login"><section className="loginbox"><div className="crest">N</div><small>ACCOUNT ACCESS</small><h1>ALNAV DMS</h1><p>Akun berhasil masuk, tetapi belum diaktifkan atau belum ditautkan ke unit.</p><button onClick={()=>sb.auth.signOut()}>Keluar</button></section></main>;
 return <div className="shell">
<aside>
<div className="brand">
<div className="crest smallcrest">N</div>

<div>
<b>ALNAV DMS</b>
<small>COMMAND & LOGBOOK SYSTEM</small>
</div>

</div>

<button type="button" className="ship ship-dashboard" aria-label="Buka Dashboard KRI Alamang-644" onClick={()=>{setModule("Dashboard");setSearch("");setNotice("")}}>KRI ALAMANG-644<small>SATUAN KAPAL CEPAT · KOARMADA I</small>
</button>

<nav>
<label>COMMAND CENTER</label>{visibleMenu.filter(m=>m.id!=="Dashboard").map(m=>
<button key={m.id} className={module===m.id?"selected":""} onClick={()=>{setModule(m.id);setSearch("");setNotice("")}}>
<span className="navicon">{m.icon}</span>
<span>{m.label||m.id}<small>{m.desc}</small>
</span>
<i>›</i>
</button>)}</nav>
<div className="asidefoot">
<span className="live-dot"/> SECURE CONNECTION<small>SUPABASE AUTHENTICATED</small>
</div>

</aside>
<main className="main">
<header>
<div>
<small>FLEET OPERATIONS / {selected?.label||"DASHBOARD"}</small>
<h2>{module==="Dashboard"?"Command Center":selected?.label||module}</h2>
</div>

<div className="user">
<span>{profile.rank_title&&profile.rank_title.toLowerCase()!==profile.role.toLowerCase()?profile.rank_title+" · ":""}{profile.full_name&&profile.full_name.toLowerCase()!==profile.role.toLowerCase()?profile.full_name:(profile.rank_title&&profile.rank_title.toLowerCase()!==profile.role.toLowerCase()?profile.rank_title:"Pengguna")}{isViewer?" · VIEWER":" · "+profile.role.toUpperCase()}</span>
<button className="logout" onClick={()=>sb.auth.signOut()}>Sign out</button>
</div>

</header>
 {module==="Dashboard" && <div className="dashboard-view">
 {isViewer&&<div className="viewer-notice">
<b>MODE VIEWER · READ ONLY</b>
<span>{ "Anda dapat memantau informasi kapal, tetapi tidak dapat mengubah atau menghapus data."}</span>
</div>
}
 <VesselStatus supabase={sb} unitId={profile.unit_id} userId={user.id} canManage={isAdmin}/>
 <section className="hero">
<div>
<small>INTEGRATED SHIP MANAGEMENT</small>
<h1>Welcome aboard, {(profile.full_name||"Operator").split(" ")[0]}.</h1>
<p>Operational records, maintenance, logistics and personnel in one command environment.</p>
</div>

<div className="hero-orb"><img src="/alamang-emblem.jpg" alt="Emblem KRI Alamang-644"/></div>

</section>

 
 <div className="section-title">
<span>LIVE DATABASE OVERVIEW</span>
<small>REAL SUPABASE RECORDS</small>
</div>

 <div className="stats">
  <article>
<small>PERSONNEL REGISTER</small>
<b>{dbCounts.personnel}</b>
<span>Personel terdaftar</span>
</article>
  <article>
<small>INVENTORY MASTER</small>
<b>{dbCounts.inventory}</b>
<span>Item persediaan</span>
</article>
  <article>
<small>STOCK MOVEMENTS</small>
<b>{dbCounts.movements}</b>
<span>Recorded transactions</span>
</article>
  <article>
<small>ACTIVITY LOGS</small>
<b>{dbCounts.logs}</b>
<span>Current database records</span>
</article>
 </div>

 <div className="section-title">
<span>SHIP CONSUMABLES</span>
<small>LIVE INVENTORY · LITER</small>
</div>

 <div className="supply-grid">
  <article className={"supply-card"+(isAdmin&&waterItem?" supply-card-editable":"")} onClick={()=>{if(isAdmin&&waterItem)setSupplyDraft({...waterItem,target_stock:String(waterStock),stock_ready_current:waterStock})}} role={isAdmin&&waterItem?"button":undefined} tabIndex={isAdmin&&waterItem?0:undefined} onKeyDown={e=>{if(isAdmin&&waterItem&&(e.key==="Enter"||e.key===" ")){e.preventDefault();setSupplyDraft({...waterItem,target_stock:String(waterStock),stock_ready_current:waterStock})}}}>
<div className="supply-top">
<small>FRESH WATER</small>
<span>{waterItem?"LIVE DATA":"NO DATA"}</span>
</div>

<h3>Air Tawar</h3>
<div className="supply-amount">{waterItem?waterStock.toLocaleString("id-ID"):"—"} <small>Liter tersedia</small>
</div>

<div className="supply-progress-label"><b>{waterItem?waterPct+"%":"—"}</b><span>TINGKAT KETERSEDIAAN</span></div>
<div className="supply-track">
<i style={{width:waterPct+"%"}}/>
</div>
<div className="supply-meta"><span>Kapasitas {waterItem?waterCapacity.toLocaleString("id-ID"):"—"} L</span></div>

</article>
  <article className={"supply-card"+(isAdmin&&fuelItem?" supply-card-editable":"")} onClick={()=>{if(isAdmin&&fuelItem)setSupplyDraft({...fuelItem,target_stock:String(fuelStock),stock_ready_current:fuelStock})}} role={isAdmin&&fuelItem?"button":undefined} tabIndex={isAdmin&&fuelItem?0:undefined} onKeyDown={e=>{if(isAdmin&&fuelItem&&(e.key==="Enter"||e.key===" ")){e.preventDefault();setSupplyDraft({...fuelItem,target_stock:String(fuelStock),stock_ready_current:fuelStock})}}}>
<div className="supply-top">
<small>FUEL · DIESEL</small>
<span>{fuelItem?"LIVE DATA":"NO DATA"}</span>
</div>

<h3>HSD</h3>
<div className="supply-amount">{fuelItem?fuelStock.toLocaleString("id-ID"):"—"} <small>Liter tersedia</small>
</div>

<div className="supply-progress-label"><b>{fuelItem?fuelPct+"%":"—"}</b><span>TINGKAT KETERSEDIAAN</span></div>
<div className="supply-track">
<i style={{width:fuelPct+"%"}}/>
</div>
<div className="supply-meta"><span>Kapasitas {fuelItem?fuelCapacity.toLocaleString("id-ID"):"—"} L</span></div>

</article>
 </div>

 {isAdmin&&supplyDraft&&<div className="supply-modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!supplySaving)setSupplyDraft(null)}}><section className="supply-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="supply-editor-title"><header><div><small>ADMIN CONTROL · SHIP CONSUMABLES</small><h3 id="supply-editor-title">Ubah data {supplyDraft.category==="Air Tawar"?"Air Tawar":"HSD"}</h3><p>Perubahan saldo dicatat sebagai transaksi agar riwayat persediaan tetap terlacak.</p></div><button type="button" aria-label="Tutup" disabled={supplySaving} onClick={()=>setSupplyDraft(null)}>×</button></header><div className="supply-modal-grid"><label>Stok tersedia (liter)<input type="number" min="0" step="any" value={supplyDraft.target_stock??""} onChange={e=>setSupplyDraft((v:any)=>({...v,target_stock:e.target.value}))}/><small>Saldo saat ini: {Number(supplyDraft.stock_ready_current||0).toLocaleString("id-ID")} L</small></label><label>Kapasitas tangki (liter)<input type="number" min="0" step="any" value={supplyDraft.capacity_liters??""} onChange={e=>setSupplyDraft((v:any)=>({...v,capacity_liters:e.target.value}))}/></label></div><footer><button className="outline" type="button" disabled={supplySaving} onClick={()=>setSupplyDraft(null)}>Batal</button><button type="button" disabled={supplySaving} onClick={saveSupplyData}>{supplySaving?"Menyimpan…":"Simpan perubahan"}</button></footer></section></div>}
<section className="panel">
<div className="panelhead">
<div>
<h3>Operational modules</h3>
<p>Open a module to access its live records</p>
</div>

<span className="glass-chip">UNIT · KRI ALAMANG-644</span>
</div>

<div className="module-grid">{visibleMenu.filter(m=>m.id!=="Dashboard").map(m=>
<button key={m.id} onClick={()=>setModule(m.id)}>
<span>{m.icon}</span>
<b>{m.label||m.id}</b>
<small>{m.desc}</small>
<i>OPEN ↗</i>
</button>)}</div>

</section>

</div>
}
{module!=="Dashboard" && <div className="module-view">{isViewer&&<div className="viewer-notice">
<b>MODE VIEWER · READ ONLY</b>
<span>{ "Akun ini hanya dapat melihat data. Perubahan dan pengelolaan data tidak tersedia."}</span>
</div>
}
{module!=="NAVYLOG"&&module!=="NAVYMAINT"&&<section className="module-hero">
<div>
<small>OPERATIONAL MODULE</small>
<h1>{selected?.label||module}</h1>
<p>{selected?.desc||"Operational management"}</p>
</div>

<div className="record-count">{selected?.table?rows.length:"—"}<small>RECORDS</small>
</div>

</section>
}
{module==="NAVYMAINT"&&<section className="maint-overview"><div className="maint-title"><small>VESSEL ENGINEERING</small><h1>SHIP MAINTENANCE</h1><p>Pengelolaan pemeliharaan dan kesiapan teknis kapal</p></div><div className="maint-overview-cards" aria-label="Ship maintenance categories"><button className={"maint-overview-card "+(maintSection==="SEWACO"?"active":"")} onClick={()=>{setMaintSection("SEWACO");setSearch("")}}><small>SENSOR · WEAPON · COMMAND</small><b>SEWACO</b><span>Sistem senjata, sensor, dan kendali</span><strong>{rows.filter(r=>String(r.category||"").toUpperCase().includes("SEWACO")||(!String(r.category||"").toUpperCase().includes("PLATFORM")&&!String(r.category||"").toUpperCase().includes("SEWACO"))).length} ASET</strong></button><button className={"maint-overview-card "+(maintSection==="PLATFORM"?"active":"")} onClick={()=>{setMaintSection("PLATFORM");setSearch("")}}><small>HULL · PROPULSION · AUXILIARY</small><b>PLATFORM</b><span>Struktur, mesin, dan sistem pendukung kapal</span><strong>{rows.filter(r=>String(r.category||"").toUpperCase().includes("PLATFORM")).length} ASET</strong></button></div></section>}
{selected?.table && <>{module==="NAVYLOG"&&<div className="navylog-board">
<section className="panel plan-panel">
<div className="panelhead">
<div>
<h3>Agenda Kegiatan Berikutnya</h3>
<p>Satu tampilan untuk memahami kegiatan, penugasan, dan kesiagaan kapal.</p>
</div>

<span className="glass-chip">PHST · AGENDA HARI BERIKUTNYA</span>
</div>
{!isViewer&&<>
<div className="phst-upload">
<label className="upload-label">Pilih dokumen agenda<input type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={handlePhstUpload}/>
</label>{docBusy&&<span>Memproses dokumen…</span>}
{docName&&<small>File: {docName}</small>}</div>
{docPlans.length>0&&<>
<div className="agenda-preview">
<div className="agenda-preview-head">
<div>
<b>Agenda kegiatan hari berikutnya</b>
<small>Hasil pembacaan dokumen · periksa sebelum disimpan</small>
</div>

<span>{docPlans.length} KEGIATAN</span>
</div>

{Object.keys(docMeta).length>0&&<section className="agenda-duty-strip"><div className="agenda-duty-heading"><small>PERSONEL & POSISI JAGA</small><span>PHST · KESIAGAAN</span></div><div className="agenda-duty-grid">{Object.entries(docMeta).map(([role,name])=><div className="agenda-duty-item" key={role}><small>{role}</small><b>{name||"—"}</b></div>)}</div></section>}<div className="agenda-sections">{phstSectionOrder.map(section=>{const items=docPlans.filter(p=>p.category===section&&(section!=="C. UMUM"||!p.activity_time||p.activity_time.slice(0,5)<="22:00"));if(!items.length)return null;return <section className={"agenda-section "+section.charAt(0).toLowerCase()} key={section}>
<div className="agenda-section-title">
<span>{section}</span>
<small>{items.length} {section==="C. UMUM"?"JADWAL":section==="D. KHUSUS"?"DEPARTEMEN":"INFORMASI"}</small>
</div>

<div className="agenda-cards">{items.map((p,i)=>
<article className="agenda-card" key={section+"-"+i}>
<div className="agenda-time">{p.activity_time||"•"}</div>

<div className="agenda-content">
<h4>{p.title}</h4>{p.description&&<p>{p.description}</p>}</div>

</article>)}</div>

</section>
})}</div>

<div className="plan-actions">
<small>Agenda disimpan sebagai DRAFT. Peralatan hanya ditampilkan bila tertulis di dokumen.</small>
<button onClick={importPhstPlans} disabled={busy}>{busy?"Menyimpan…":"Simpan agenda ke LOGBOOK"}</button>
</div>

</div>

</>
}</>
}</section>

<DigitalLogbook supabase={sb} unitId={profile.unit_id} userId={user.id} viewer={isViewer}/> <DailyWatchArchive supabase={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} viewer={isViewer} title="Arsip LOGBOOK"/>
<section className="panel data-panel">
<div className="panelhead">
<div>
<h3>Agenda esok hari</h3>
<p>Rencana kegiatan tersimpan untuk tanggal kegiatan berikutnya</p>
</div>

<span className="glass-chip">{tomorrowPlans.length} KEGIATAN</span>
</div>

{Object.keys(agendaDutyMeta).length>0&&<section className="agenda-duty-strip"><div className="agenda-duty-heading"><small>PERSONEL & POSISI JAGA</small><span>PHST · KESIAGAAN</span></div><div className="agenda-duty-grid">{Object.entries(agendaDutyMeta).map(([role,name])=><div className="agenda-duty-item" key={role}><small>{role}</small><b>{name||"—"}</b></div>)}</div></section>}
<div className="agenda-list">{agendaVisibleRows.length>0?agendaVisibleRows.map(p=>
<article className="agenda-card agenda-card-compact" key={p.id}>
<div className="agenda-time">{p.activity_time?p.activity_time.slice(0,5):"—"}</div>
<div className="agenda-content"><h4>{p.title}</h4>{p.description&&<p>{p.description}</p>}<small className="agenda-status">{p.status==="draft"?"AGENDA · DRAFT":p.status}</small></div>
</article>):<div className="empty">Belum ada kegiatan terjadwal sampai pukul 22.00. Unggah dokumen PHST untuk menampilkan agenda.</div>}</div>
<section className="agenda-departments"><div className="agenda-departments-head"><div><small>KEGIATAN TAMBAHAN</small><h4>Rencana tiap Departemen</h4></div><span>4 DEPARTEMEN</span></div><div className="agenda-department-list">{agendaDeptRows.map(p=><article className="agenda-department-card" key={p.id}><button type="button" className="agenda-department-open" onClick={()=>canManage&&setDeptEditDraft({...p})} disabled={!canManage}><span><small>DEPARTEMEN</small><b>{normalizeDepartment(String(p.title||""))||p.title}</b></span><i>{canManage?"EDIT ↗":"TAMBAHAN"}</i></button>{p.description&&<p>{p.description}</p>}</article>)}</div></section>
{deptEditDraft&&<section className="agenda-dept-editor"><div className="agenda-dept-editor-head"><div><small>EDIT KEGIATAN DEPARTEMEN</small><h4>{deptEditDraft.title||"Departemen"}</h4></div><button type="button" className="outline" onClick={()=>setDeptEditDraft(null)} disabled={deptEditSaving}>Tutup</button></div><label>Nama departemen<input value={deptEditDraft.title||""} onChange={e=>setDeptEditDraft(v=>v?({...v,title:e.target.value}):v)}/></label><label>Kegiatan tambahan / uraian<textarea rows={4} value={deptEditDraft.description||""} onChange={e=>setDeptEditDraft(v=>v?({...v,description:e.target.value}):v)}/></label><div className="agenda-dept-editor-actions"><button type="button" className="outline" onClick={()=>setDeptEditDraft(null)} disabled={deptEditSaving}>Batal</button><button type="button" onClick={saveDeptAgenda} disabled={deptEditSaving}>{deptEditSaving?"Menyimpan…":"Simpan perubahan"}</button></div></section>}

</section>

</div>
}
{module==="NAVYDOCS"&&<DailyWatchArchive supabase={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} viewer={isViewer} title="ARCHIVE · Pusat Arsip"/>}
{module!=="NAVYLOG"&&module!=="NAVYDOCS"&&<section className="panel data-panel">
<div className="panelhead">
<div>
<h3>{module==="NAVYMAINT"?(maintSection==="ALL"?"SHIP MAINTENANCE":maintSection):(titles[selected.table]||module)}</h3>
<p>Live data from Supabase · RLS protected</p>
</div>

<div className="panelhead-actions">{module==="NAVYSTOCK"&&canOperate&&<button onClick={()=>setMovementDraft({item_id:"",movement_type:"inbound",quantity:"",movement_date:new Date().toISOString().slice(0,10),condition_status:"ready"})}>+ Catat transaksi</button>}{module==="NAVYSTOCK"&&canManage&&<button className="outline" onClick={()=>setStockDraft({item_code:"",item_name:"",category:"Logistik",unit_of_measure:"unit",initial_quantity:0,stock_ready:0,stock_unready:0,minimum_stock:0,is_active:true})}>+ Tambah barang</button>}{module==="NAVYMAINT"&&canOperate&&<button onClick={()=>setMaintenanceDraft({report_date:new Date().toISOString().slice(0,10),asset_id:"",issue_description:"",action_taken:""})}>+ Laporkan kerusakan</button>}{module==="NAVYMAINT"&&canManage&&<button className="outline" onClick={()=>setAssetDraft({asset_code:"",asset_name:"",category:maintSection,location_label:"",condition_label:"Baik",is_active:true})}>+ Tambah aset {maintSection}</button>}{module==="NAVYCREW"&&canManage&&<button onClick={()=>setCrewDraft({sequence_no:"",full_name:"",rank_title:"",position:"",roster_period:new Date().toISOString().slice(0,10)})}>+ Tambah personel</button>}<button className="outline" onClick={()=>loadModule()} disabled={busy}>{busy?"Loading…":"↻ Refresh"}</button>
</div>

</div>

<div className="toolbar">
<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={module==="NAVYSTOCK"?"Cari item dalam kelas inventaris…":"Search records…"}/>
<span>{filtered.length} / {rows.length} records</span>
</div>
{module==="NAVYSTOCK"&&<section className="stock-class-workspace">
 <div className="stock-class-heading"><div><small>LOGISTICS COMMAND · SUPPLY CLASSIFICATION</small><h3>INVENTARIS PER KELAS</h3><p>Enam kelas logistik kapal dalam satu struktur. Buka kartu untuk melihat inventaris aktual, stok, dan transaksi pada kelas tersebut.</p></div><span className="stock-class-live">LIVE SUPABASE DATA</span></div>
 <div className="stock-class-grid">{stockClasses.map(stockClass=>{
  const classItems=rows.filter(item=>itemBelongsToStockClass(item,stockClass.id));
  const restricted=stockClass.id==="V"&&!canAccessClassV;
  const hasCritical=classItems.some(item=>Number(item.minimum_stock||0)>0&&Number(item.stock_ready||0)<=Number(item.minimum_stock||0));
  const isOpen=expandedStockClass===stockClass.id;
  const state=restricted?"AKSES TERBATAS":classItems.length?(hasCritical?"PERLU PERHATIAN":"TERSEDIA"):"BELUM TERISI";
  return <article className={"stock-class-card"+(isOpen?" expanded":"")} key={stockClass.id}>
   <button type="button" className="stock-class-trigger" aria-expanded={isOpen} onClick={()=>setExpandedStockClass(isOpen?null:stockClass.id)}>
    <span className="stock-class-number">{stockClass.id}</span><span className="stock-class-copy"><small>{stockClass.title}</small><b>{stockClass.name}</b><i>{stockClass.description}</i></span><span className="stock-class-metrics"><b>{restricted?"•••":classItems.length}</b><small>{restricted?"RESTRICTED":"ITEM"}</small><em className={hasCritical?"critical":classItems.length?"ready":"empty"}>{state}</em></span><span className="stock-class-chevron">{isOpen?"−":"+"}</span>
   </button>
   {isOpen&&<div className="stock-class-detail">
    <div className="stock-class-detail-head"><div><small>CLASS INVENTORY · {stockClass.title}</small><p>{stockClass.subgroups.join(" · ")}</p></div>{canManage&&<button type="button" onClick={()=>setStockDraft({item_code:"",item_name:"",category:stockClass.defaultCategory,supply_class:stockClass.id,department_code:stockClass.id==="V"?"SIN":"LOG",unit_of_measure:stockClass.id==="I"||stockClass.id==="III"?"liter":"unit",minimum_stock:0,is_active:true})}>+ Tambah item kelas ini</button>}</div>
    {restricted?<div className="stock-class-restricted"><b>INVENTARIS KELAS V DIBATASI</b><span>Rincian hanya ditampilkan kepada akun yang memiliki kewenangan sesuai kebijakan satuan. Hubungi Admin untuk penetapan hak akses.</span></div>:
     classItems.length?<div className="stock-class-table-wrap"><table><thead><tr><th>KODE</th><th>NAMA ITEM</th><th>STOK TERSEDIA</th><th>TIDAK SIAP</th><th>MINIMUM</th><th>STATUS</th>{canManage&&<th>AKSI</th>}</tr></thead><tbody>{classItems.filter(item=>!search||[item.item_code,item.item_name,item.category].some(value=>String(value||"").toLowerCase().includes(search.toLowerCase()))).map(item=><tr key={item.id}><td>{item.item_code||"—"}</td><td><b>{item.item_name}</b><small>{item.category}</small></td><td>{Number(item.stock_ready||0).toLocaleString("id-ID")} {item.unit_of_measure}</td><td>{Number(item.stock_unready||0).toLocaleString("id-ID")} {item.unit_of_measure}</td><td>{Number(item.minimum_stock||0).toLocaleString("id-ID")} {item.unit_of_measure}</td><td><span className={"stock-item-status"+(Number(item.minimum_stock||0)>0&&Number(item.stock_ready||0)<=Number(item.minimum_stock||0)?" critical":"")}>{Number(item.minimum_stock||0)>0&&Number(item.stock_ready||0)<=Number(item.minimum_stock||0)?"LOW STOCK":"TERCATAT"}</span></td>{canManage&&<td><button type="button" className="outline stock-edit-button" onClick={()=>setStockDraft({...item})}>EDIT</button></td>}</tr>)}</tbody></table></div>:
     <div className="stock-class-empty"><b>Belum ada item inventaris pada kelas ini.</b><span>Ini adalah kategori kosong, bukan stok nol. Tambahkan item sesuai data fisik dan dokumen inventaris kapal melalui akun yang berwenang.</span></div>}
   </div>}
  </article>
 })}</div>
 <p className="stock-class-note">Catatan: jumlah item dan saldo ditarik dari data Supabase yang sudah ada. Kategori kelas yang belum memiliki data tidak diisi dengan angka atau item contoh. Kelas V memakai pembatasan tampilan sementara; kebijakan RLS khusus kelas V tetap harus diselesaikan sebelum akses produksi dinyatakan aman.</p>
</section>}
{module==="NAVYMAINT"&&maintenanceDraft&&<section className="editor-panel"><h3>Pelaporan kerusakan / pemeliharaan</h3><div className="editor-grid"><label>Aset terkait<select value={maintenanceDraft.asset_id||""} onChange={e=>setMaintenanceDraft((v:any)=>({...v,asset_id:e.target.value}))}><option value="">Pilih aset (opsional)</option>{rows.map(r=><option key={r.id} value={r.id}>{r.asset_code} · {r.asset_name}</option>)}</select></label><label>Tanggal laporan<input type="date" value={maintenanceDraft.report_date||""} onChange={e=>setMaintenanceDraft((v:any)=>({...v,report_date:e.target.value}))}/></label><label className="wide">Uraian kerusakan / temuan<textarea value={maintenanceDraft.issue_description||""} onChange={e=>setMaintenanceDraft((v:any)=>({...v,issue_description:e.target.value}))} rows={3}/></label><label className="wide">Tindakan awal (jika ada)<textarea value={maintenanceDraft.action_taken||""} onChange={e=>setMaintenanceDraft((v:any)=>({...v,action_taken:e.target.value}))} rows={2}/></label></div><div className="editor-actions"><button className="outline" onClick={()=>setMaintenanceDraft(null)}>Batal</button><button disabled={maintenanceSaving} onClick={saveMaintenance}>{maintenanceSaving?"Menyimpan…":"Simpan laporan"}</button></div></section>}
{module==="NAVYMAINT"&&assetDraft&&<section className="editor-panel"><h3>{assetDraft.id?"Edit aset":"Tambah aset pemeliharaan"}</h3><div className="editor-grid">{[["asset_code","Kode aset"],["asset_name","Nama aset"],["location_label","Lokasi"]].map(([k,l])=><label key={k}>{l}<input value={assetDraft[k]??""} onChange={e=>setAssetDraft((v:any)=>({...v,[k]:e.target.value}))}/></label>)}<label>Sub-sistem<select value={String(assetDraft.category||maintSection).toUpperCase().includes("PLATFORM")?"PLATFORM":"SEWACO"} onChange={e=>setAssetDraft((v:any)=>({...v,category:e.target.value}))}><option value="SEWACO">SEWACO</option><option value="PLATFORM">PLATFORM</option></select></label><label>Kondisi<select value={assetDraft.condition_label||"Baik"} onChange={e=>setAssetDraft((v:any)=>({...v,condition_label:e.target.value}))}>{["Baik","Perlu Perhatian","Rusak Ringan","Rusak Berat"].map(x=><option key={x}>{x}</option>)}</select></label></div><div className="editor-actions"><button className="outline" onClick={()=>setAssetDraft(null)}>Batal</button><button disabled={assetSaving} onClick={saveAsset}>{assetSaving?"Menyimpan…":"Simpan aset"}</button></div></section>}
{module==="NAVYSTOCK"&&movementDraft&&<section className="editor-panel"><h3>Catat transaksi persediaan</h3><p>Saldo stok dihitung otomatis oleh database. BBM/Air Tawar menggunakan kondisi “Tidak berlaku”; kategori lain memilih stok siap atau tidak siap.</p><div className="editor-grid"><label>Barang<select value={movementDraft.item_id||""} onChange={e=>{const chosen=rows.find(r=>r.id===e.target.value);setMovementDraft((v:any)=>({...v,item_id:e.target.value,condition_status:["BBM","Air Tawar"].includes(chosen?.category)?"not_applicable":"ready"}))}}><option value="">Pilih barang</option>{rows.filter(r=>r.is_active).map(r=><option key={r.id} value={r.id}>{r.item_code} · {r.item_name} ({r.stock_ready} {r.unit_of_measure})</option>)}</select></label><label>Jenis transaksi<select value={movementDraft.movement_type} onChange={e=>setMovementDraft((v:any)=>({...v,movement_type:e.target.value}))}><option value="inbound">Barang masuk</option><option value="outbound">Barang keluar</option></select></label><label>Jumlah<input type="number" min="0.01" step="any" value={movementDraft.quantity} onChange={e=>setMovementDraft((v:any)=>({...v,quantity:e.target.value}))}/></label><label>Tanggal<input type="date" value={movementDraft.movement_date} onChange={e=>setMovementDraft((v:any)=>({...v,movement_date:e.target.value}))}/></label><label>Kondisi stok<select value={movementDraft.condition_status} onChange={e=>setMovementDraft((v:any)=>({...v,condition_status:e.target.value}))}><option value="ready">Siap</option><option value="unready">Tidak siap</option><option value="not_applicable">Tidak berlaku (BBM/Air)</option></select></label><label>No. referensi<input value={movementDraft.reference_no||""} onChange={e=>setMovementDraft((v:any)=>({...v,reference_no:e.target.value}))}/></label><label>Tujuan<input value={movementDraft.movement_purpose||""} onChange={e=>setMovementDraft((v:any)=>({...v,movement_purpose:e.target.value}))}/></label><label>Catatan<input value={movementDraft.notes||""} onChange={e=>setMovementDraft((v:any)=>({...v,notes:e.target.value}))}/></label></div><div className="editor-actions"><button className="outline" onClick={()=>setMovementDraft(null)}>Batal</button><button disabled={movementSaving} onClick={saveMovement}>{movementSaving?"Menyimpan…":"Simpan transaksi"}</button></div></section>}
{module==="NAVYCREW"&&crewDraft&&<section className="editor-panel"><h3>{crewDraft.id?"Edit personel":"Tambah personel"}</h3><div className="editor-grid">{[["sequence_no","Nomor urut","number"],["full_name","Nama lengkap","text"],["rank_title","Pangkat","text"],["position","Jabatan","text"],["roster_period","Periode roster","date"]].map(([k,l,t])=><label key={k}>{l}<input type={t} value={crewDraft[k]??""} onChange={e=>setCrewDraft((v:any)=>({...v,[k]:e.target.value}))}/></label>)}</div><div className="editor-actions"><button className="outline" onClick={()=>setCrewDraft(null)}>Batal</button><button disabled={crewSaving} onClick={saveCrew}>{crewSaving?"Menyimpan…":"Simpan personel"}</button></div></section>}
{notice&&<div className="notice">{notice}</div>
}
{module==="NAVYSTOCK"?null:busy?<div className="empty">Loading secured records…</div>:filtered.length>0?<div className={"table-wrap"+(module==="NAVYCREW"?" navycrew-table-wrap":"")}><table className={module==="NAVYCREW"?"navycrew-fit-table":undefined}><thead><tr>{(fields[selected.table]||Object.keys(filtered[0])).map(k=><th key={k}>{labels[k]||k.replaceAll("_"," ")}</th>)}{(module==="NAVYSTOCK"&&canManage||module==="NAVYCREW"&&canManage||module==="NAVYMAINT"&&canManage)&&<th>Aksi</th>}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id||i}>{(fields[selected.table]||Object.keys(r)).map(k=><td key={k} className={module==="NAVYSTOCK"&&canManage&&!["initial_quantity","stock_ready","stock_unready"].includes(k)?"editable-stock-cell":""} onClick={()=>{if(module==="NAVYSTOCK"&&canManage&&!cellSaving&&!["initial_quantity","stock_ready","stock_unready"].includes(k)){setEditingCell({id:r.id,field:k});setCellDraft(r[k]===null||r[k]===undefined?"":String(r[k]))}}}>{module==="NAVYSTOCK"&&canManage&&!["initial_quantity","stock_ready","stock_unready"].includes(k)&&editingCell?.id===r.id&&editingCell?.field===k?<input autoFocus type={["minimum_stock","unit_price","capacity_liters","manufacture_year"].includes(k)?"number":"text"} value={cellDraft} disabled={cellSaving} onClick={e=>e.stopPropagation()} onChange={e=>setCellDraft(e.target.value)} onBlur={()=>saveInlineCell(r,k)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();if(e.key==="Escape")setEditingCell(null)}} aria-label={"Edit "+(labels[k]||k)}/>:fmt(r[k])}</td>)}{module==="NAVYSTOCK"&&canManage&&<td><button className="outline stock-edit-button" onClick={()=>setStockDraft({...r})}>Edit data</button></td>}{module==="NAVYCREW"&&canManage&&<td><button className="outline stock-edit-button" onClick={()=>setCrewDraft({...r})}>Edit</button></td>}{module==="NAVYMAINT"&&canManage&&<td><button className="outline stock-edit-button" onClick={()=>setAssetDraft({...r})}>Edit</button></td>}</tr>)}</tbody></table></div>:<div className="empty">Tidak ada data pada tabel ini atau akun tidak memiliki akses baca.</div>}{module==="NAVYSTOCK"&&canManage&&stockDraft&&<section className="stock-editor">
<div>
<small>ADMIN CONTROL · STOCK</small>
<h3>{stockDraft.id?"Edit data persediaan":"Tambah data persediaan"}</h3>
</div>

<div className="stock-editor-grid"><p className="wide">Saldo awal dan saldo berjalan hanya dapat berubah melalui transaksi barang masuk/keluar agar riwayat dan perhitungan stok tetap konsisten.</p>{["item_code","item_name","category","unit_of_measure","minimum_stock","brand","caliber","caliber_unit","secondary_caliber","ammo_type","lot_no","manufacture_year","country_of_origin","unit_price","capacity_liters"].map(k=>
<label key={k}>{labels[k]||k.replaceAll("_"," ")}<input type={["initial_quantity","stock_ready","stock_unready","minimum_stock","unit_price","capacity_liters","manufacture_year"].includes(k)?"number":"text"} step={["unit_price","capacity_liters","initial_quantity","stock_ready","stock_unready","minimum_stock"].includes(k)?"any":"1"} value={stockDraft[k]??""} onChange={e=>setStockDraft((v:any)=>({...v,[k]:e.target.value}))}/>
</label>)}<label>Status<select value={stockDraft.is_active?"true":"false"} onChange={e=>setStockDraft((v:any)=>({...v,is_active:e.target.value==="true"}))}>
<option value="true">Aktif</option>
<option value="false">Nonaktif</option>
</select>
</label>
</div>

<div className="stock-editor-actions">
<button className="outline" onClick={()=>setStockDraft(null)} disabled={stockSaving}>Batal</button>
<button onClick={saveStockItem} disabled={stockSaving}>{stockSaving?"Menyimpan...":"Simpan data"}</button>
</div>

</section>
}</section>
}
{module==="NAVYMAINT"&&<section className="panel data-panel"><div className="panelhead"><div><h3>Riwayat pemeliharaan</h3><p>Laporan kerusakan, tindak lanjut dan status pekerjaan</p></div><span className="glass-chip">{maintenanceRows.length} LAPORAN</span></div>{maintenanceRows.length?<div className="table-wrap"><table><thead><tr>{["report_date","issue_description","action_taken","status"].map(k=><th key={k}>{labels[k]||k}</th>)}{canManage&&<th>Perbarui status</th>}</tr></thead><tbody>{maintenanceRows.filter(r=>!r.asset_id||maintRows.some(a=>a.id===r.asset_id)).map(r=><tr key={r.id}><td>{fmt(r.report_date)}</td><td>{fmt(r.issue_description)}</td><td>{fmt(r.action_taken)}</td><td>{fmt(r.status)}</td>{canManage&&<td><select value={r.status} onChange={e=>updateMaintenanceStatus(r,e.target.value)}><option value="reported">Dilaporkan</option><option value="in_progress">Dalam proses</option><option value="completed">Selesai</option><option value="deferred">Ditunda</option></select></td>}</tr>)}</tbody></table></div>:<div className="empty">Belum ada laporan pemeliharaan.</div>}</section>}
{module==="NAVYSTOCK"&&<section className="panel data-panel">
<div className="panelhead">
<div>
<h3>Riwayat transaksi stok</h3>
<p>Movement history · latest 100</p>
</div>

<span className="glass-chip">{movements.length} TRANSACTIONS</span>
</div>
{movements.length?<div className="table-wrap">
<table>
<thead>
<tr>{["movement_date","movement_type","quantity","reference_no","condition_status","movement_purpose","notes"].map(k=>
<th key={k}>{labels[k]}</th>)}</tr>
</thead>
<tbody>{movements.map(r=>
<tr key={r.id}>{["movement_date","movement_type","quantity","reference_no","condition_status","movement_purpose","notes"].map(k=>
<td key={k}>{fmt(r[k])}</td>)}</tr>)}</tbody>
</table>
</div>
:<div className="empty">Belum ada transaksi atau tidak ada akses baca.</div>
}</section>
}
</>}
{module==="ADMINISTRATION"&&isAdmin&&<section className="admin-access-board">
 <header className="admin-access-heading"><div><small>SECURITY · IDENTITY · ACCESS GOVERNANCE</small><h1>ADMINISTRATION</h1><p>Direktori akun ALNAV DMS dan kontrol akses unit KRI ALAMANG-644.</p></div><span>ADMIN MASTER CONTROL</span></header>
 <div className="admin-access-summary">
  <article><small>ACCOUNT DIRECTORY</small><b>{accountRows.length}</b><span>Akun pada unit aktif</span></article>
  <article><small>ACTIVE ACCOUNTS</small><b>{accountRows.filter(a=>a.is_active).length}</b><span>Memiliki akses aktif</span></article>
  <article><small>DEPARTMENT SCOPE</small><b>NOT SET</b><span>Menunggu migrasi departemen + RLS</span></article>
 </div>
 <section className="panel data-panel admin-account-panel"><div className="panelhead"><div><h3>Direktori Pengguna & Hak Departemen</h3><p>Tetapkan departemen, status Kepala Departemen dan otorisasi Class V untuk setiap akun.</p></div><span className="glass-chip">ADMIN ONLY</span></div>
  {accountError&&<div className="notice">{accountError}</div>}
  {accountBusy?<div className="empty">Memuat direktori akun…</div>:accountRows.length?<div className="table-wrap"><table><thead><tr><th>NAMA</th><th>PANGKAT</th><th>ROLE</th><th>STATUS</th><th>DEPARTEMEN</th><th>KEPALA DEPT.</th><th>AKSES CLASS V</th><th>AKSI</th></tr></thead><tbody>{accountRows.map(account=><tr key={account.id}><td><b>{account.full_name}</b></td><td>{account.rank_title||"—"}</td><td><span className="admin-role-chip">{String(account.role||"").toUpperCase()}</span></td><td>{account.is_active?"AKTIF":"NONAKTIF"}</td><td>{account.department_code||"BELUM DITETAPKAN"}</td><td>{account.is_department_head?"YA":"TIDAK"}</td><td>{account.can_access_class_v?"DIIZINKAN":"TIDAK"}</td><td><button type="button" className="outline stock-edit-button" disabled={account.id===profile?.id||!account.is_active} onClick={()=>setAccountEditDraft({...account})}>ATUR AKSES</button></td></tr>)}</tbody></table></div>:<div className="empty">Belum ada akun pada unit ini.</div>}
  {accountEditDraft&&<div className="admin-account-editor"><div><small>ACCOUNT ACCESS CONTROL</small><b>{accountEditDraft.full_name}</b></div><label>Departemen<select value={accountEditDraft.department_code||""} onChange={e=>setAccountEditDraft((v:any)=>v?({...v,department_code:e.target.value||null,is_department_head:e.target.value? v.is_department_head:false}):v)}><option value="">Belum ditetapkan</option><option value="OPS">OPS — Operasi</option><option value="SIN">SIN — Senjata</option><option value="EKA">EKA — Elektronika</option><option value="LOG">LOG — Logistik</option></select></label><label className="admin-access-check"><input type="checkbox" checked={!!accountEditDraft.is_department_head} disabled={!accountEditDraft.department_code} onChange={e=>setAccountEditDraft((v:any)=>v?({...v,is_department_head:e.target.checked}):v)}/> Kepala Departemen</label><label className="admin-access-check"><input type="checkbox" checked={!!accountEditDraft.can_access_class_v} onChange={e=>setAccountEditDraft((v:any)=>v?({...v,can_access_class_v:e.target.checked}):v)}/> Otorisasi akses Class V</label><div className="admin-account-actions"><button type="button" className="outline" onClick={()=>setAccountEditDraft(null)} disabled={accountEditSaving}>BATAL</button><button type="button" onClick={saveAccountScope} disabled={accountEditSaving}>{accountEditSaving?"MENYIMPAN…":"SIMPAN AKSES"}</button></div></div>}
 </section>
 <section className="admin-access-roadmap"><div><small>DEPARTMENTAL RBAC · NEXT CONTROL LAYER</small><h3>Struktur akses departemen</h3><p>Semua personel aktif dapat membaca informasi kapal yang bersifat umum. Hak input, edit dan persetujuan dibatasi berdasarkan departemen dan tingkat kewenangan.</p></div><div className="admin-department-grid">{[["OPS","OPERASI"],["SIN","SENJATA"],["EKA","ELEKTRONIKA"],["LOG","LOGISTIK"]].map(([code,name])=><article key={code}><b>{code}</b><span>{name}</span><small>KEPALA DEPARTEMEN · AKSES TERTENTU</small></article>)}</div><div className="admin-access-warning"><b>Identitas departemen sudah tersedia di database.</b><span>Admin dapat menetapkan departemen dan kepala departemen pada direktori akun. Pembatasan tulis lintas departemen untuk modul operasional masih dalam tahap pengaktifan dan pengujian RLS; penetapan ini belum otomatis memberikan hak edit sebelum kebijakan modul selesai.</span></div></section>
</section>}
{!selected?.table&&module!=="ADMINISTRATION" && <section className="panel coming">
<div className="coming-icon">◇</div>

<small>MODULE FOUNDATION</small>
<h3>{module} is not yet connected to an operational database</h3>
<p>Modul ini belum memiliki tabel khusus pada schema Supabase yang diaudit. Tidak ada data contoh yang ditampilkan. Struktur data, alur kerja, dan hak akses harus ditetapkan sebelum modul diaktifkan.</p>
<span className="glass-chip">NO MOCK DATA · SECURE BY DESIGN</span>
</section>
}</div>
}
</main>
</div>

}
