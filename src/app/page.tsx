"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createClient,type User} from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import DigitalLogbook from "./DigitalLogbook";
import {LogbookSummary,LogTabs,type LogTab} from "./LogbookParts";
import {stockClasses,itemBelongsToStockClass} from "./stockClasses";
import StockWorkspace from "./StockWorkspace";
import {en,enText,depLabel} from "./displayEn";
import MaintenanceWorkspace from "./MaintenanceWorkspace";
import PHSTLogbook from "./PHSTLogbook";
import DailyWatchArchive from "./DailyWatchArchive";
import {NavRuntimeProvider,NavRunningChips,useNav} from "./NavRuntime";
import NavMapButton from "./NavMap";
import IntroSplash from "./intro/IntroSplash";
import DashboardHome from "./DashboardHome";
import {useMfa,MfaChallenge,MfaEnrollRequired,SecurityDialog,IdleGuard,mfaRequiredFor} from "./Security";
import dynamic from "next/dynamic";
const VesselModel3D=dynamic(()=>import("./VesselModel3D"),{ssr:false,loading:()=><div className="dg-3d-loading">Loading 3D model…</div>});
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
pdfjsLib.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/legacy/build/pdf.worker.mjs",import.meta.url).toString();
const menu=[
 {id:"Dashboard",title:"Dashboard",label:"DASHBOARD",desc:"Command centre",icon:"⌂"},
 {id:"NAVYLOG",title:"PHST Logbook",label:"LOGBOOK",desc:"Activity journal & handover",icon:"▤",table:"activity_logs"},
 {id:"NAVYSTOCK",title:"Stock",label:"STOCK",desc:"Inventory & logistics",icon:"▣",table:"inventory_items"},
 {id:"NAVYCREW",title:"Personnel",label:"PERSONNEL",desc:"Personnel & watch roster",icon:"♙",table:"personnel"},
 {id:"NAVYMAINT",title:"Maintenance",label:"MAINTENANCE",desc:"Equipment maintenance",icon:"⚙",table:"maintenance_assets"},
 {id:"NAVYDOCS",title:"Archive",label:"ARCHIVE",desc:"Documents & archive",icon:"▧",table:"daily_watch_reports"},
 {id:"ADMINISTRATION",title:"Administration",label:"ADMINISTRATION",desc:"Accounts, departments & access rights",icon:"⚿"},
];
const menuGroups=[
 {label:"Operations",ids:["Dashboard","NAVYLOG"]},
 {label:"Logistics & personnel",ids:["NAVYSTOCK","NAVYCREW"]},
 {label:"Engineering & archive",ids:["NAVYMAINT","NAVYDOCS","ADMINISTRATION"]},
];
const navIconPaths:Record<string,React.ReactNode>={
 Dashboard:<><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></>,
 NAVYNAV:<><circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M15.5 8.5l-2 5-5 2 2-5z"/></>,
 NAVY3D:<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></>,
 NAVYLOG:<><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11M9 8h6"/></>,
 NAVYSTOCK:<><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/></>,
 NAVYCREW:<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14.5a6 6 0 013.5 5.5"/></>,
 NAVYMAINT:<><path d="M14.5 6.5a4 4 0 005 5L13 18a2.1 2.1 0 01-3-3z"/><path d="M9 15l-5 5"/></>,
 NAVYDOCS:<><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/></>,
 ADMINISTRATION:<><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></>,
};
function NavIcon({id}:{id:string}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{navIconPaths[id]}</svg>}
const roleNames:Record<string,string>={admin:"Master GPS · full access",commander:"Commander",officer:"Officer",operator:"Operator",viewer:"Viewer · read only"};
type Profile={id:string;full_name:string;rank_title:string|null;unit_id:string|null;role:string;is_active:boolean;department_code:string|null;is_department_head:boolean;can_access_class_v:boolean};
type RowData=Record<string,any>;
type ImportedPlan={activity_date:string;activity_time:string|null;title:string;description:string;category:string};
const phstSectionOrder=["A. SITUASI","B. TUGAS POKOK","C. UMUM","D. KHUSUS","F. LAIN-LAIN"];
const departmentOrder=["OPS","SIN","EKA","LOG"] as const;
function normalizeDepartment(value:string):typeof departmentOrder[number]|null{const v=value.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();if(/\bOPS\b|DEPOPS|OPERASI/.test(v))return "OPS";if(/\bSIN\b|DEPSIN|MESIN/.test(v))return "SIN";if(/\bEKA\b|DEPEKA|ELEKTRONIK/.test(v))return "EKA";if(/\bLOG\b|DEPLOG|LOGISTIK/.test(v))return "LOG";return null;}
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
function parsePhstDailyMeta(lines:string[]):Array<{activity_date:string;meta:Record<string,string>}>{
 const out:Array<{activity_date:string;meta:Record<string,string>}>=[];let date="",meta:Record<string,string>={},inHeader=false;
 const flush=()=>{if(date&&Object.keys(meta).length)out.push({activity_date:date,meta:{...meta}})};
 for(const raw of lines){
  const line=raw.replace(/\s+/g," ").trim();if(!line)continue;
  const dm=line.match(/(?:Hari\s*\/\s*tanggal\s*:?\s*)?(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)?\s*,?\s*(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i);
  if(dm){flush();date=dm[4]+"-"+monthMap[dm[3].toLowerCase()]+"-"+dm[2].padStart(2,"0");meta={};inHeader=true;continue}
  if(!date||!inHeader)continue;
  if(/^A\.\s*SITUASI/i.test(line)){inHeader=false;continue}
  const labels:[string,RegExp][]=[["Perwira Jaga",/Perwira\s+jaga\s*:?\s*(.+)/i],["Divisi Jaga",/Divisi\s+jaga\s*:?\s*(.+)/i],["Bintara Jaga",/Bintara\s+jaga\s*:?\s*(.+)/i],["Caraka",/Caraka\s*:?\s*(.+)/i],["Tenue Jaga",/Tenue\s+jaga\s*:?\s*(.+)/i]];
  for(const [key,re] of labels){const m=line.match(re);if(m)meta[key]=m[1].trim()}
 }
 flush();return out;
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
const titles:Record<string,string>={activity_logs:"Activity Journal",maintenance_assets:"Asset Register",maintenance_records:"Maintenance History",inventory_items:"Inventory Master",stock_movements:"Stock Transactions",checklists:"Checklist Templates",checklist_items:"Checklist Items",checklist_runs:"Checklist Runs",personnel:"Personnel Register",daily_watch_reports:"Watch Handover Archive"};
const fields:Record<string,string[]>={activity_logs:["activity_date","activity_time","title","category","description","status"],maintenance_assets:["asset_code","asset_name","category","location_label","condition_label","is_active"],maintenance_records:["report_date","issue_description","action_taken","status"],inventory_items:["item_code","item_name","category","unit_of_measure","initial_quantity","stock_ready","stock_unready","minimum_stock","brand","caliber","caliber_unit","secondary_caliber","ammo_type","lot_no","manufacture_year","country_of_origin","unit_price","capacity_liters","is_active"],stock_movements:["movement_date","movement_type","quantity","reference_no","condition_status","movement_purpose","notes"],checklists:["title","category","description","is_active"],checklist_items:["item_order","item_label","is_required"],checklist_runs:["performed_at","summary"],personnel:["sequence_no","full_name","rank_title","nrp","position","roster_period"]};
const labels:Record<string,string>={activity_date:"Date",activity_time:"Time",title:"Title",category:"Category",description:"Description",status:"Status",asset_code:"Asset code",asset_name:"Asset name",location_label:"Location",condition_label:"Condition",is_active:"Active",report_date:"Report date",issue_description:"Fault",action_taken:"Action taken",item_code:"Item code",item_name:"Item name",unit_of_measure:"Unit",stock_ready:"Ready stock",stock_unready:"Not-ready stock",minimum_stock:"Minimum stock",brand:"Brand",caliber:"Calibre",caliber_unit:"Calibre unit",secondary_caliber:"Secondary calibre",ammo_type:"Ammunition type",lot_no:"Lot number",manufacture_year:"Year of manufacture",country_of_origin:"Country of origin",unit_price:"Unit price",initial_quantity:"Initial quantity",capacity_liters:"Capacity (L)",movement_date:"Transaction date",movement_type:"Transaction type",quantity:"Quantity",reference_no:"Reference number",condition_status:"Condition",movement_purpose:"Purpose",notes:"Notes",item_order:"Order",item_label:"Inspection item",is_required:"Required",performed_at:"Performed at",summary:"Summary",sequence_no:"No.",full_name:"Name",rank_title:"Rank",nrp:"NRP",position:"Position",roster_period:"Period",remarks:"Remarks"};
const fmt=(v:any)=>v===null||v===undefined||v===""?"—":typeof v==="boolean"?(v?"Yes":"No"):typeof v==="object"?JSON.stringify(v):String(v);
function parseWatchMeta(description?:string){const values:Record<string,string>={};for(const line of (description||"").split("\n")){const i=line.indexOf(":");if(i>0)values[line.slice(0,i)]=line.slice(i+1).trim()}return values}
function LogShip3D({sb,unitId,userId,role,canAccessClassV,modes}:{sb:any;unitId:string;userId:string;role:string;canAccessClassV:boolean;modes:Array<"jaga"|"putar-ulang"|"latihan">}){const nav=useNav();return <VesselModel3D lang="id" supabase={sb} unitId={unitId} userId={userId} role={role} canAccessClassV={canAccessClassV} modes={modes} nav={{gps:nav.gps,sim:null}} className="dg-3d"/>}
export default function Home(){
 const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[module,setModule]=useState("Dashboard"),[rows,setRows]=useState<RowData[]>([]),[movements,setMovements]=useState<RowData[]>([]),[search,setSearch]=useState(""),[notice,setNotice]=useState("");
 const [dbCounts,setDbCounts]=useState({personnel:"—",inventory:"—",movements:"—",logs:"—"});
 const [accountRows,setAccountRows]=useState<RowData[]>([]),[accountBusy,setAccountBusy]=useState(false),[accountError,setAccountError]=useState("");
 const [accountEditDraft,setAccountEditDraft]=useState<RowData|null>(null),[accountEditSaving,setAccountEditSaving]=useState(false);
 const [accountInviteDraft,setAccountInviteDraft]=useState<RowData|null>(null),[accountInviteSaving,setAccountInviteSaving]=useState(false);
 const [editingCell,setEditingCell]=useState<{id:string;field:string}|null>(null),[cellDraft,setCellDraft]=useState("");
 const [cellSaving,setCellSaving]=useState(false);
 const [supplyRows,setSupplyRows]=useState<RowData[]>([]),[supplyTick,setSupplyTick]=useState(0);
 const [supplyDraft,setSupplyDraft]=useState<RowData|null>(null),[supplySaving,setSupplySaving]=useState(false);
 const [skiffFuelDraft,setSkiffFuelDraft]=useState<RowData|null>(null),[skiffFuelSaving,setSkiffFuelSaving]=useState(false);
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
 const [docDailyMeta,setDocDailyMeta]=useState<Array<{activity_date:string;meta:Record<string,string>}>>([]);
 const [docName,setDocName]=useState("");
 const [docBusy,setDocBusy]=useState(false);
 const refreshProfile=useCallback(async(u:User)=>{const {data,error}=await sb.from("profiles").select("id,full_name,rank_title,unit_id,role,is_active,department_code,is_department_head,can_access_class_v").eq("id",u.id).maybeSingle();if(error)throw error;setProfile(data as Profile|null)},[]);
 useEffect(()=>{let alive=true;sb.auth.getSession().then(async({data})=>{const u=data.session?.user??null;if(!alive)return;setUser(u);if(u){try{await refreshProfile(u)}catch(e){setError("Failed to load account profile.")}}setLoading(false)});const {data:listener}=sb.auth.onAuthStateChange((_event,session)=>{const u=session?.user??null;setUser(u);if(!u){setProfile(null);setRows([]);setMovements([])}else{setTimeout(()=>refreshProfile(u).catch(()=>setError("Failed to load profile.")),0)}});return()=>{alive=false;listener.subscription.unsubscribe()}},[refreshProfile]);
 const isViewer=profile?.role==="viewer";
 const isAdmin=profile?.role==="admin";
 const mfa=useMfa(sb,user);const [secOpen,setSecOpen]=useState(false),[mfaSkip,setMfaSkip]=useState(false);
 const canManage=profile?.role==="admin"||profile?.role==="commander";
 const canAccessClassV=canManage||profile?.can_access_class_v===true;
 const canOperate=["admin","commander","officer","operator"].includes(profile?.role||"");
 const visibleMenu=useMemo(()=>menu.filter(m=>m.id!=="ADMINISTRATION"||isAdmin),[isAdmin]);
 const selected=menu.find(m=>m.id===module);
 useEffect(()=>{if(!visibleMenu.some(m=>m.id===module))setModule("Dashboard")},[visibleMenu,module]);
 useEffect(()=>{if(module!=="ADMINISTRATION"||!isAdmin||!profile?.unit_id)return;let alive=true;setAccountBusy(true);setAccountError("");sb.from("profiles").select("id,full_name,rank_title,role,is_active,department_code,is_department_head,can_access_class_v").eq("unit_id",profile.unit_id).order("full_name",{ascending:true}).then(({data,error})=>{if(!alive)return;if(error){setAccountError("Account directory failed to load: "+error.message);setAccountRows([])}else setAccountRows((data||[]) as RowData[]);setAccountBusy(false)});return()=>{alive=false}},[module,isAdmin,profile?.unit_id]);
 useEffect(()=>{if(!profile?.unit_id)return;let live=true;(async()=>{const names=["inventory_items","stock_movements","activity_logs"];const results=await Promise.all([sb.rpc("personnel_directory",{},{count:"exact",head:true}),...names.map(table=>sb.from(table).select("*",{count:"exact",head:true}).eq("unit_id",profile.unit_id!))]);if(live)setDbCounts({personnel:results[0].error?"—":String(results[0].count??0),inventory:results[1].error?"—":String(results[1].count??0),movements:results[2].error?"—":String(results[2].count??0),logs:results[3].error?"—":String(results[3].count??0)})})();return()=>{live=false}},[profile?.unit_id]);
 useEffect(()=>{if(!profile?.unit_id)return;let live=true;(async()=>{const {data,error}=await sb.from("inventory_items").select("id,item_name,category,capacity_liters,stock_ready,stock_unready,unit_of_measure").eq("unit_id",profile.unit_id!).eq("is_active",true).in("category",["Air Tawar","BBM"]);if(live)setSupplyRows(error?[]:(data||[]) as RowData[])})();return()=>{live=false}},[profile?.unit_id,supplyTick]);
 const loadTomorrowPlans=useCallback(async()=>{if(!profile?.unit_id)return;const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");const {data,error}=await sb.from("activity_logs").select("id,activity_date,activity_time,title,description,category,status").eq("unit_id",profile.unit_id).gte("activity_date",today).order("activity_date",{ascending:true}).order("activity_time",{ascending:true});if(error){setNotice("Agenda tersimpan tidak dapat dimuat: "+error.message);return}const rows=(data||[]) as RowData[];const nextDate=rows[0]?.activity_date;setTomorrowPlans(nextDate?rows.filter(p=>p.activity_date===nextDate):[])},[profile?.unit_id]);
 const agendaDutyMeta=useMemo(()=>parseWatchMeta(tomorrowPlans.find(p=>p.category==="PHST META")?.description),[tomorrowPlans]);
 const agendaVisibleRows=useMemo(()=>tomorrowPlans.filter(p=>p.category!=="PHST META"&&p.category!=="D. KHUSUS"&&(!p.activity_time||p.activity_time.slice(0,5)<="22:00")),[tomorrowPlans]);
 const agendaDeptRows=useMemo(()=>departmentOrder.map(code=>tomorrowPlans.find(p=>p.category==="D. KHUSUS"&&normalizeDepartment(String(p.title||""))===code)||{id:"dept-"+code,title:code,description:"",category:"D. KHUSUS",activity_date:tomorrowPlans[0]?.activity_date}),[tomorrowPlans]);
 async function inviteDepartmentAccount(){
  if(!isAdmin||!accountInviteDraft){setNotice("Only the Admin can invite personnel.");return}
  const payload={email:String(accountInviteDraft.email||"").trim(),full_name:String(accountInviteDraft.full_name||"").trim(),rank_title:String(accountInviteDraft.rank_title||"").trim(),role:String(accountInviteDraft.role||"viewer"),department_code:String(accountInviteDraft.department_code||""),is_department_head:!!accountInviteDraft.is_department_head,can_access_class_v:!!accountInviteDraft.can_access_class_v};
  if(!payload.email||!payload.full_name){setNotice("Name and email are required.");return}
  if(payload.is_department_head&&!payload.department_code){setNotice("A Head of Department needs a department.");return}
  if(payload.can_access_class_v&&payload.department_code!=="OPS"){setNotice("Class V authorisation can only be given to DEPOPS accounts.");return}
  setAccountInviteSaving(true);setNotice("");
  const {data,error}=await sb.functions.invoke("admin-invite-user",{body:payload});
  if(error||!data?.success){setNotice("Invitation failed: "+(data?.error||error?.message||"Unknown error"));setAccountInviteSaving(false);return}
  setAccountRows(old=>[...old.filter(x=>x.id!==data.profile.id),data.profile]);setAccountInviteDraft(null);setNotice("Invitation sent to "+payload.email+". The person must complete activation via email.");setAccountInviteSaving(false);
 }
 async function saveAccountScope(){
  if(!isAdmin||!profile?.unit_id||!accountEditDraft?.id){setNotice("Only the Admin can assign account departments.");return}
  if(accountEditDraft.is_department_head&&!accountEditDraft.department_code){setNotice("A Head of Department needs a department. Command staff (Commander, Palaksa) have no department.");return}
  if(accountEditDraft.can_access_class_v&&accountEditDraft.department_code!=="OPS"){setNotice("Class V authorisation can only be given to DEPOPS accounts.");return}
  if(accountEditDraft.id===profile.id){setNotice("The main Admin profile cannot be changed from this directory.");return}
  setAccountEditSaving(true);setNotice("");
  const {data,error}=await sb.from("profiles").update({department_code:accountEditDraft.department_code||null,is_department_head:!!accountEditDraft.is_department_head,can_access_class_v:!!accountEditDraft.can_access_class_v,updated_at:new Date().toISOString()}).eq("id",accountEditDraft.id).eq("unit_id",profile.unit_id).neq("role","admin").select("id,department_code,is_department_head,can_access_class_v").maybeSingle();
  if(error)setNotice("Access assignment failed: "+error.message);
  else if(!data)setNotice("No changes. Make sure the account is not the main Admin and Admin policy allows profile changes.");
  else{setAccountRows(old=>old.map(row=>row.id===data.id?{...row,...data}:row));setNotice("Account department and access rights updated.");setAccountEditDraft(null)}
  setAccountEditSaving(false);
 }
 async function saveDeptAgenda(){if(!canManage||!profile?.unit_id||!deptEditDraft?.id){setNotice("Hanya Admin atau Komandan yang dapat mengubah kegiatan departemen.");return}const title=normalizeDepartment(String(deptEditDraft.title||""));const description=String(deptEditDraft.description||"").trim();if(!title){setNotice("Departemen harus DEPOPS, DEPSIN, DEPEKA, atau DEPLOG.");return}setDeptEditSaving(true);const payload={title,description,category:"D. KHUSUS"};const result=deptEditDraft.id&&String(deptEditDraft.id).startsWith("dept-")?await sb.from("activity_logs").insert({unit_id:profile.unit_id,created_by:user?.id,activity_date:deptEditDraft.activity_date||tomorrowPlans[0]?.activity_date,activity_time:null,status:"draft",...payload}):await sb.from("activity_logs").update(payload).eq("id",deptEditDraft.id).eq("unit_id",profile.unit_id);if(result.error){setNotice("Kegiatan departemen gagal disimpan: "+result.error.message)}else{setNotice("Kegiatan departemen "+title+" berhasil disimpan.");setDeptEditDraft(null);await loadTomorrowPlans()}setDeptEditSaving(false)}
 useEffect(()=>{if(user&&profile?.unit_id)loadTomorrowPlans()},[user,profile?.unit_id,loadTomorrowPlans]);
 async function handlePhstUpload(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;setDocBusy(true);setNotice("");setDocName(file.name);try{const ext=file.name.toLowerCase();const lines=ext.endsWith(".docx")?await readDocxText(file):ext.endsWith(".pdf")?await readPdfText(file):(()=>{throw new Error("Gunakan dokumen Word (.docx) atau PDF (.pdf).")})();const parsed=parsePhstLines(lines);if(!parsed.length)throw new Error("Tidak ditemukan bagian A sampai E atau jadwal kegiatan. Periksa format PHST.");const meta=parsePhstHeader(lines);setDocMeta(meta);setDocDailyMeta(parsePhstDailyMeta(lines));if(Object.keys(meta).length)parsed.push({activity_date:parsed[0].activity_date,activity_time:null,title:"Petugas dan kesiapan jaga",description:Object.entries(meta).map(([k,v])=>k+": "+v).join("\n"),category:"PHST META"});setDocPlans(parsed);setNotice("Dokumen berhasil dibaca. Periksa hasil ekstraksi sebelum menyimpan ke Logbook.")}catch(err){setDocPlans([]);setNotice(err instanceof Error?err.message:"Dokumen gagal diproses.")}finally{setDocBusy(false);e.target.value=""}}
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
  // Import every dated duty roster independently; only C. UMUM rows become the officer checklist.
  for(const dailyMeta of docDailyMeta){
   const meta=dailyMeta.meta,officer=meta["Perwira Jaga"]||"";
   const officerNrp=(officer.match(/NRP\s*([\w/.-]+)/i)||[])[1]||null;
   const cleanOfficer=officer.replace(/\s*NRP\s*[\w/.-]+/i,"").trim();
   const {data:daily,error:dailyError}=await sb.from("phst_daily_orders").upsert({unit_id:profile.unit_id,activity_date:dailyMeta.activity_date,duty_officer:cleanOfficer,duty_officer_nrp:officerNrp,duty_division:meta["Divisi Jaga"]||"",duty_nco:meta["Bintara Jaga"]||"",duty_messenger:meta["Caraka"]||"",duty_attire:meta["Tenue Jaga"]||"",source_file:docName,source_verified:true},{onConflict:"unit_id,activity_date"}).select("id").single();
   if(dailyError){setNotice("Data personel PHST "+dailyMeta.activity_date+" gagal disimpan: "+dailyError.message);setBusy(false);return;}
   const checklist=docPlans.filter(p=>p.activity_date===dailyMeta.activity_date&&p.category==="C. UMUM"&&p.activity_time).map((p,i)=>({unit_id:profile.unit_id,daily_order_id:daily.id,sequence_no:i+1,scheduled_time:p.activity_time,activity_text:p.title}));
   if(checklist.length){const {error:checkError}=await sb.from("phst_checklist_items").upsert(checklist,{onConflict:"daily_order_id,sequence_no"});if(checkError){setNotice("Checklist Bagian C "+dailyMeta.activity_date+" gagal disimpan: "+checkError.message);setBusy(false);return;}}
  }
  const {error:insertError}=await sb.from("activity_logs").insert(payload);
  if(insertError){setNotice("PHST gagal disimpan. Riwayat lama tetap aman: "+insertError.message);await loadTomorrowPlans();}
  else{
   setNotice("PHST berhasil disimpan tanpa menghapus riwayat. "+newPlans.length+" data baru ditambahkan; "+(docPlans.length-newPlans.length)+" data identik dilewati.");
   setDocPlans([]);setDocMeta({});setDocDailyMeta([]);setDocName("");await loadModule();await loadTomorrowPlans();
  }
  setBusy(false);
 }
 async function savePlan(e:React.FormEvent){e.preventDefault();if(!profile?.unit_id||!user){setNotice("Account is not linked to a unit.");return;}setBusy(true);setNotice("");const details=["RENCANA KEGIATAN: "+planDescription.trim(),"PERALATAN / BAHAN YANG DIGUNAKAN: "+(planResources.trim()||"Belum ditentukan")].join("\n");const {error}=await sb.from("activity_logs").insert({unit_id:profile.unit_id,created_by:user.id,activity_date:planDate,activity_time:planTime||null,title:planTitle.trim(),description:details,category:planCategory,status:"draft"});if(error)setNotice("Plan not saved: "+error.message);else{setNotice("Activity plan saved as draft.");setPlanTitle("");setPlanDescription("");setPlanResources("");await loadModule();await loadTomorrowPlans()}setBusy(false)}
 const loadModule=useCallback(async()=>{if(!selected?.table||!profile?.unit_id)return;setBusy(true);setNotice("");let q:any=selected.table==="personnel"?(canManage?sb.from("personnel").select("id,unit_id,roster_period,sequence_no,full_name,rank_title,nrp,position,department_code,created_at,updated_at").eq("unit_id",profile.unit_id):sb.rpc("personnel_directory").select("id,unit_id,roster_period,sequence_no,full_name,rank_title,nrp,position,department_code,created_at,updated_at")).limit(500):sb.from(selected.table).select("*").eq("unit_id",profile.unit_id).limit(500);if(selected.table==="inventory_items"&&!canAccessClassV)q=q.neq("supply_class","V");if(selected.table==="personnel")q=q.order("sequence_no",{ascending:true});else if(selected.table==="inventory_items")q=q.order("item_name",{ascending:true});else q=q.order("created_at",{ascending:false});const {data,error}=await q;if(error){setNotice("Data cannot be loaded with this account's access rights: "+error.message);setRows([])}else setRows((data||[]) as RowData[]);if(module==="NAVYSTOCK"){const {data:m,error:me}=await sb.from("stock_movements").select("*").eq("unit_id",profile.unit_id).order("movement_date",{ascending:false}).limit(100);setMovements((m||[]) as RowData[]);if(me)setNotice("Transaction history could not be loaded: "+me.message)}else setMovements([]);if(module==="NAVYMAINT"){const {data:m,error:me}=await sb.from("maintenance_records").select("*").eq("unit_id",profile.unit_id).order("report_date",{ascending:false}).limit(200);setMaintenanceRows((m||[]) as RowData[]);if(me)setNotice("Maintenance history could not be loaded: "+me.message)}else setMaintenanceRows([]);setBusy(false)},[selected,profile?.unit_id,module,canManage,canAccessClassV]);
 useEffect(()=>{if(user&&profile?.unit_id&&profile.is_active)loadModule()},[user,profile,loadModule]);
 const saveInlineCell=async(row:RowData,field:string)=>{if(!canManage||!profile?.unit_id||!row.id)return;const numeric=["sequence_no","minimum_stock","initial_quantity","stock_ready","stock_unready","unit_price","capacity_liters","manufacture_year"];const dateFields=["roster_period","birth_date"];let value:any=cellDraft;if(field==="is_active")value=cellDraft==="true";else if(numeric.includes(field))value=cellDraft.trim()===""?null:Number(cellDraft);else if(dateFields.includes(field))value=cellDraft.trim()||null;else value=cellDraft.trim()||null;if(numeric.includes(field)&&value!==null&&(!Number.isFinite(value)||(field==="manufacture_year"&&!Number.isInteger(value)))){setNotice("The value must be a valid number.");return}setCellSaving(true);const {data,error}=await sb.from(selected?.table||"").update({[field]:value,updated_at:new Date().toISOString()}).eq("id",row.id).eq("unit_id",profile.unit_id).select("id").maybeSingle();if(error)setNotice("Failed to save change: "+error.message);else if(!data)setNotice("No rows were updated. Check edit permission and the active unit.");else{setRows(old=>old.map(x=>x.id===row.id?{...x,[field]:value}:x));setNotice("Field updated.");}setCellSaving(false);setEditingCell(null)};
 const saveStockItem=async()=>{
  if(!canManage||!profile?.unit_id||!stockDraft){setNotice("The account has no management rights or unit data is not available.");return}
  const itemCode=String(stockDraft.item_code||"").trim();
  const itemName=String(stockDraft.item_name||"").trim();
  if(!itemCode||!itemName){setNotice("Item code and name are required.");return}
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
     setNotice("Nilai "+k.replaceAll("_"," ")+" must be a valid number.");return;
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
    if(!result.error&&!result.data){setNotice("No change: the row was not found in this unit or the account lacks UPDATE permission. Check the admin/commander role and access policy.");return}
   }else{
    result=await sb.from("inventory_items").insert({...payload,unit_id:profile.unit_id}).select("id").single();
   }
   if(result.error){setNotice("Failed to save stock: "+result.error.message);return}
   setNotice(stockDraft.id?"Inventory changes saved.":"New item added.");
   setStockDraft(null);
   await loadModule();
  }catch(error:any){
   setNotice("Failed to save stock: "+(error?.message||"Unknown error"));
  }finally{
   setStockSaving(false);
  }
 };
 async function saveSkiffFuelData(){
  if(!isAdmin||!profile?.unit_id||!user||!skiffFuelDraft?.id){setNotice("Rescue boat fuel data is not available or the account is not Admin.");return}
  const current=Number(skiffFuelDraft.stock_ready_current||0),target=Number(skiffFuelDraft.target_stock);
  if(!Number.isFinite(target)||target<0){setNotice("Rescue boat fuel must be zero litres or more.");return}
  setSkiffFuelSaving(true);setNotice("");
  try{const delta=target-current;if(delta!==0){const {error}=await sb.from("stock_movements").insert({unit_id:profile.unit_id,item_id:skiffFuelDraft.id,movement_type:delta>0?"inbound":"outbound",quantity:Math.abs(delta),movement_date:new Date().toISOString().slice(0,10),condition_status:"not_applicable",movement_purpose:"Rescue boat fuel balance adjustment by Admin",notes:"Rescue boat fuel litre adjustment",recorded_by:user.id});if(error)throw new Error("Litre adjustment failed: "+error.message)}setSkiffFuelDraft(null);setNotice("Rescue boat fuel updated in litres and recorded in transaction history.");await loadModule()}catch(error:any){setNotice(error?.message||"Failed to save rescue boat fuel change.")}finally{setSkiffFuelSaving(false)}
 }
 async function saveSupplyData(){
  if(!isAdmin||!profile?.unit_id||!user||!supplyDraft){setNotice("Only the Admin can change fresh water and HSD data.");return}
  const current=Number(supplyDraft.stock_ready_current||0),target=Number(supplyDraft.target_stock),capacity=Number(supplyDraft.capacity_liters);
  if(!Number.isFinite(target)||target<0||!Number.isFinite(capacity)||capacity<=0){setNotice("Stock and capacity must be zero or more.");return}
  if(capacity>0&&target>capacity){setNotice("Available stock cannot exceed tank capacity.");return}
  setSupplySaving(true);setNotice("");
  try{
   const delta=target-current;
   if(delta!==0){
    const {error}=await sb.from("stock_movements").insert({unit_id:profile.unit_id,item_id:supplyDraft.id,movement_type:delta>0?"inbound":"outbound",quantity:Math.abs(delta),movement_date:new Date().toISOString().slice(0,10),condition_status:"not_applicable",movement_purpose:"Stock adjustment by Admin via Dashboard",notes:"Balance adjustment "+(supplyDraft.category==="Air Tawar"?"fresh water":"HSD"),recorded_by:user.id});
    if(error)throw new Error("Stock adjustment failed: "+error.message);
   }
   const {error:capacityError}=await sb.from("inventory_items").update({capacity_liters:capacity,updated_at:new Date().toISOString()}).eq("id",supplyDraft.id).eq("unit_id",profile.unit_id);
   if(capacityError)throw new Error("Stock recorded, but capacity update failed: "+capacityError.message);
   const {data,error:refreshError}=await sb.from("inventory_items").select("id,item_name,category,capacity_liters,stock_ready,stock_unready,unit_of_measure").eq("unit_id",profile.unit_id).eq("is_active",true).in("category",["Air Tawar","BBM"]);
   if(refreshError)throw new Error("Data saved, but the view could not be refreshed: "+refreshError.message);
   setSupplyRows((data||[]) as RowData[]);setSupplyDraft(null);setNotice((supplyDraft.category==="Air Tawar"?"Fresh water":"HSD")+" data updated. The balance adjustment is recorded in transaction history.");
  }catch(error:any){setNotice(error?.message||"Failed to save changes.")}
  finally{setSupplySaving(false)}
 }
 async function saveAsset(){if(!profile?.unit_id||!assetDraft){setNotice("Asset or unit data is not available.");return;}const code=String(assetDraft.asset_code||"").trim(),name=String(assetDraft.asset_name||"").trim();if(!code||!name){setNotice("Asset code and name are required.");return}setAssetSaving(true);const payload={asset_code:code,asset_name:name,category:String(assetDraft.category||"Peralatan"),location_label:String(assetDraft.location_label||"").trim()||null,condition_label:String(assetDraft.condition_label||"Baik"),is_active:assetDraft.is_active!==false,unit_id:profile.unit_id};const result=assetDraft.id?await sb.from("maintenance_assets").update(payload).eq("id",assetDraft.id).eq("unit_id",profile.unit_id):await sb.from("maintenance_assets").insert(payload);setNotice(result.error?"Failed to save asset: "+result.error.message:"Asset saved.");if(!result.error){setAssetDraft(null);await loadModule()}setAssetSaving(false)}
 async function saveMaintenance(){if(!profile?.unit_id||!user||!maintenanceDraft){setNotice("Report or account data is not available.");return;}const issue=String(maintenanceDraft.issue_description||"").trim();if(!issue){setNotice("Fault description is required.");return}setMaintenanceSaving(true);const {error}=await sb.from("maintenance_records").insert({unit_id:profile.unit_id,asset_id:maintenanceDraft.asset_id||null,report_date:maintenanceDraft.report_date||new Date().toISOString().slice(0,10),issue_description:issue,action_taken:String(maintenanceDraft.action_taken||"").trim()||null,status:"reported",reported_by:user.id});setNotice(error?"Failed to save maintenance report: "+error.message:"Fault report recorded.");if(!error){setMaintenanceDraft(null);await loadModule()}setMaintenanceSaving(false)}
 async function updateMaintenanceStatus(row:RowData,status:string){if(!["admin","commander"].includes(profile?.role||"")){setNotice("Only unit managers can change maintenance status.");return}const payload:any={status,updated_at:new Date().toISOString()};if(status==="completed")payload.completed_at=new Date().toISOString();const {error}=await sb.from("maintenance_records").update(payload).eq("id",row.id).eq("unit_id",profile?.unit_id);setNotice(error?"Failed to update maintenance status: "+error.message:"Maintenance status updated.");if(!error)await loadModule()}
 async function saveMovement(){if(!profile?.unit_id||!user||!movementDraft){setNotice("Transaction or account data is not available.");return;}const item=String(movementDraft.item_id||"");const qty=Number(movementDraft.quantity);if(!item||!Number.isFinite(qty)||qty<=0){setNotice("Select an item and enter a quantity greater than zero.");return}setMovementSaving(true);const {error}=await sb.from("stock_movements").insert({unit_id:profile.unit_id,item_id:item,movement_type:movementDraft.movement_type,quantity:qty,movement_date:movementDraft.movement_date||new Date().toISOString().slice(0,10),reference_no:String(movementDraft.reference_no||"").trim()||null,condition_status:movementDraft.condition_status||"ready",movement_purpose:String(movementDraft.movement_purpose||"").trim()||null,notes:String(movementDraft.notes||"").trim()||null,recorded_by:user.id});setNotice(error?"Stock transaction rejected: "+error.message:"Transaction recorded and balance updated by the database.");if(!error){setMovementDraft(null);await loadModule()}setMovementSaving(false)}
 async function saveCrew(){
  if(!profile?.unit_id||!crewDraft){setNotice("Personnel or unit data is not available.");return;}
  const sequence=Number(crewDraft.sequence_no);
  const fullName=String(crewDraft.full_name||"").trim();
  if(!fullName||!Number.isInteger(sequence)||sequence<1){setNotice("A positive whole sequence number and the person's name are required.");return;}
  const payload:any={sequence_no:sequence,full_name:fullName,rank_title:String(crewDraft.rank_title||"").trim()||null,position:String(crewDraft.position||"").trim()||null,roster_period:String(crewDraft.roster_period||"").trim()||new Date().toISOString().slice(0,10)};
  setCrewSaving(true);
  const result=crewDraft.id?await sb.from("personnel").update(payload).eq("id",crewDraft.id).eq("unit_id",profile.unit_id):await sb.from("personnel").insert({...payload,unit_id:profile.unit_id});
  setNotice(result.error?"Failed to save personnel: "+result.error.message:"Personnel saved. Private fields were not changed.");
  if(!result.error){setCrewDraft(null);await loadModule();}
  setCrewSaving(false);
 }
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const {error}=await sb.auth.signInWithPassword({email:email.trim(),password});if(error)setError("Sign-in failed. Check your email/password or contact the administrator.");setBusy(false)}
 const dashboard=useMemo(()=>({personnel:39,stock:rows.length}),[rows.length]);
 const maintRows=useMemo(()=>module!=="NAVYMAINT"||maintSection==="ALL"?rows:rows.filter(r=>{const c=String(r.category||"").toUpperCase();return maintSection==="PLATFORM"?c.includes("PLATFORM"):c.includes("SEWACO")||(!c.includes("PLATFORM")&&!c.includes("SEWACO"))}),[rows,module,maintSection]);const filtered=useMemo(()=>maintRows.filter(r=>Object.values(r).some(v=>fmt(v).toLowerCase().includes(search.toLowerCase()))),[maintRows,search]);
 const waterItem=supplyRows.find(r=>r.category==="Air Tawar"),fuelItem=supplyRows.find(r=>r.category==="BBM");
 const boatFuelItem=rows.find(r=>r.supply_class==="III"&&/skoci|penyelamat/i.test(String(r.item_name||"")+" "+String(r.category||"")));
 const waterStock=Number(waterItem?.stock_ready||0),waterCapacity=Number(waterItem?.capacity_liters||0),waterPct=waterCapacity>0?Math.min(100,Math.round(waterStock/waterCapacity*100)):0;
 const fuelStock=Number(fuelItem?.stock_ready||0),fuelCapacity=Number(fuelItem?.capacity_liters||0),fuelPct=fuelCapacity>0?Math.min(100,Math.round(fuelStock/fuelCapacity*100)):0;
 const [jump,setJump]=useState(""),jumpRef=useRef<HTMLInputElement>(null);
 const [clock,setClock]=useState<Date|null>(null);
 useEffect(()=>{setClock(new Date());const t=setInterval(()=>setClock(new Date()),20000);return()=>clearInterval(t)},[]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();jumpRef.current?.focus()}};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[]);
 const jumpMatches=useMemo(()=>{const q=jump.trim().toLowerCase();return q?visibleMenu.filter(m=>(m.title+" "+m.label+" "+m.desc).toLowerCase().includes(q)):[]},[jump,visibleMenu]);
 const openModule=useCallback((id:string)=>{setModule(id);setSearch("");setNotice("");window.scrollTo({top:0})},[]);
 const tf=(o:Intl.DateTimeFormatOptions)=>clock?new Intl.DateTimeFormat("en-GB",o).format(clock):"—";
 const clockWib=tf({timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hour12:false}),clockUtc=tf({timeZone:"UTC",hour:"2-digit",minute:"2-digit",hour12:false}),clockDate=tf({timeZone:"Asia/Jakarta",weekday:"short",day:"numeric",month:"short",year:"numeric"});
 const envName=process.env.NEXT_PUBLIC_VERCEL_ENV||"";
 const cleanName=profile?.full_name&&profile.full_name.toLowerCase()!==String(profile.role).toLowerCase()?profile.full_name:"";
 const displayName=cleanName||(profile?.role?profile.role.charAt(0).toUpperCase()+profile.role.slice(1):"Pengguna");
 const greetName=cleanName?(profile?.rank_title?profile.rank_title+" ":"")+cleanName.split(" ")[0]:displayName;
 const initials=displayName.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
 const roleLabel=roleNames[profile?.role||""]||profile?.role||"";
 const [logTab,setLogTab]=useState<LogTab>("jaga"),[logRefresh,setLogRefresh]=useState(0);
 const [focusPart,setFocusPart]=useState<string|undefined>(undefined);
 const pickAssetRoom=useCallback((name:string)=>{setAssetDraft((d:any)=>d?{...d,location_label:name}:{asset_code:"",asset_name:"",category:maintSection,location_label:name,condition_label:"Baik",is_active:true});setNotice("Asset location set: "+name+". Complete the asset code and name in the form below.")},[maintSection]);
 if(loading)return <main className="loading"><div className="loaderglass"><img src="/branding/alnav-dms-logo.jpg" alt="ALNAV DMS logo"/> <span>INITIALIZING</span></div></main>;
 if(!user)return <main className="login"><section className="loginbox"><img className="alnav-brand-logo alnav-login-logo" src="/branding/alnav-dms-logo.jpg" alt="Official ALNAV DMS logo"/><img className="dg-login-ship" src="/images/kri-alamang-644-side.png" alt="KRI ALAMANG-644 line drawing"/><small>Welcome aboard · SHIP MANAGEMENT SYSTEM</small><h1>ALNAV DMS</h1><p>Integrated ship administration and operational logbook</p><div className="ship">KRI ALAMANG-644 <span>● SECURE ACCESS</span></div><form onSubmit={login}><label>Registered account email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?"Checking…":"Sign in to ALNAV DMS"}</button></form><footer>Restricted to authorised users.</footer></section></main>;
 if(mfa.status==="checking")return <main className="loading"><div className="loaderglass"><img src="/branding/alnav-dms-logo.jpg" alt="ALNAV DMS logo"/> <span>SECURING SESSION</span></div></main>;
 if(mfa.status==="challenge")return <MfaChallenge sb={sb} factorId={mfa.factorId} onSignOut={()=>sb.auth.signOut()} onDone={async()=>{await mfa.recheck();setError("");await refreshProfile(user).catch(()=>setError("Failed to load account profile."))}}/>;
 if(!profile?.unit_id||!profile.is_active)return <main className="login"><section className="loginbox"><img className="alnav-brand-logo alnav-login-logo" src="/branding/alnav-dms-logo.jpg" alt="Official ALNAV DMS logo"/><small>ACCOUNT ACCESS</small><h1>ALNAV DMS</h1><p>Signed in, but the account is not activated or not linked to a unit yet.</p><button onClick={()=>sb.auth.signOut()}>Sign out</button></section></main>;
 if(mfaRequiredFor(profile.role)&&!mfa.factorId&&!mfaSkip)return <MfaEnrollRequired sb={sb} roleLabel={profile.role==="admin"?"Admin":"Commander"} onSignOut={()=>sb.auth.signOut()} onUnavailable={()=>setMfaSkip(true)} onDone={()=>void mfa.recheck()}/>;
return <NavRuntimeProvider supabase={sb} unitId={profile.unit_id} isAdmin={isAdmin}><IntroSplash/><IdleGuard sb={sb} email={user.email||""} factorId={mfa.factorId}/>{secOpen&&<SecurityDialog sb={sb} role={profile.role} factorId={mfa.factorId} onClose={()=>setSecOpen(false)} onChanged={()=>void mfa.recheck()}/>}<div className="dg-app">
<aside className="dg-glass dg-side">
<div className="dg-logo"><img src="/branding/alnav-dms-logo.jpg" alt="ALNAV-DMS — Alamang Naval Data Management System"/></div>
<button type="button" className="dg-ship" onClick={()=>openModule("Dashboard")}><b className="dg-h">KRI ALAMANG-644</b><small>{envName==="production"?"Fast Patrol Craft Unit · Koarmada I":envName==="preview"?"Preview · not production":"Fast Patrol Craft Unit · Koarmada I"}</small></button>
<nav className="dg-nav" aria-label="Modul">{menuGroups.map(g=><div key={g.label} className="dg-nav-group"><div className="dg-nav-label">{g.label}</div>{g.ids.filter(id=>visibleMenu.some(m=>m.id===id)).map(id=>{const m=menu.find(x=>x.id===id)!;return <button type="button" key={id} aria-current={module===id?"page":undefined} onClick={()=>openModule(id)}><NavIcon id={id}/><span>{m.title}</span></button>})}</div>)}</nav>
<div className="dg-user">
<div className="dg-avatar" aria-hidden="true">{initials}</div>
<div className="dg-user-text"><b>{displayName}</b><small>{roleLabel}</small></div>
<button type="button" className={"dg-icon-btn"+(mfa.factorId?" is-secured":"")} aria-label={"Account security: two-step verification "+(mfa.factorId?"on":"off")} title={"Two-step verification "+(mfa.factorId?"on":"off")} onClick={()=>setSecOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/>{mfa.factorId&&<path d="M9 12l2 2 4-4"/>}</svg></button><button type="button" className="dg-icon-btn" aria-label="Sign out" title="Sign out" onClick={()=>sb.auth.signOut()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10"/></svg></button>
</div>
</aside>
<main className="dg-main">
<header className="dg-glass dg-header">
<div className="dg-crumb">KRI ALAMANG-644 <span aria-hidden="true">›</span> <b>{selected?.title||"Dashboard"}</b></div>
<form className="dg-search" role="search" onSubmit={e=>{e.preventDefault();if(jumpMatches[0]){openModule(jumpMatches[0].id);setJump("");jumpRef.current?.blur()}}}>
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
<input ref={jumpRef} aria-label="Search modules" list="dg-modules" value={jump} onChange={e=>setJump(e.target.value)} placeholder="Search modules…"/>
<datalist id="dg-modules">{visibleMenu.map(m=><option key={m.id} value={m.title}/>)}</datalist>
<kbd>⌘K</kbd>
</form>
<div className="dg-header-tools">
<NavRunningChips/>
<div className="dg-clock"><b>{clockWib} WIB · {clockUtc} UTC</b><small>{clockDate}</small></div>
{canOperate&&<button type="button" className="dg-btn dg-btn-accent" onClick={()=>openModule("NAVYLOG")}>+ Log entry</button>}
</div>
</header>
<div className="dg-content">
{isViewer&&<div className="dg-glass dg-viewer"><b>Viewer mode · read only</b><span>You can monitor ship information but cannot change or delete data.</span></div>}
{module==="Dashboard"&&<DashboardHome supabase={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} greetingName={greetName} isAdmin={isAdmin} canAccessClassV={canAccessClassV} supplyRows={supplyRows} onOpen={(id,partId)=>{setFocusPart(partId);openModule(id)}} onEditSupply={item=>{const cur=Number(item.stock_ready||0);setSupplyDraft({...item,target_stock:String(cur),stock_ready_current:cur})}}/>}
 {isAdmin&&supplyDraft&&<div className="supply-modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!supplySaving)setSupplyDraft(null)}}><section className="supply-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="supply-editor-title"><header><div><small>ADMIN CONTROL · SHIP CONSUMABLES</small><h3 id="supply-editor-title">Edit {supplyDraft.category==="Air Tawar"?"fresh water":"HSD"} data</h3><p>Balance changes are recorded as transactions so inventory history stays traceable.</p></div><button type="button" aria-label="Close" disabled={supplySaving} onClick={()=>setSupplyDraft(null)}>×</button></header><div className="supply-modal-grid"><label>Available stock (litres)<input type="number" min="0" step="any" value={supplyDraft.target_stock??""} onChange={e=>setSupplyDraft((v:any)=>({...v,target_stock:e.target.value}))}/><small>Saldo saat ini: {Number(supplyDraft.stock_ready_current||0).toLocaleString("en-GB")} L</small></label><label>Tank capacity (litres)<input type="number" min="0" step="any" value={supplyDraft.capacity_liters??""} onChange={e=>setSupplyDraft((v:any)=>({...v,capacity_liters:e.target.value}))}/></label></div><footer><button className="outline" type="button" disabled={supplySaving} onClick={()=>setSupplyDraft(null)}>Cancel</button><button type="button" disabled={supplySaving} onClick={saveSupplyData}>{supplySaving?"Saving…":"Save changes"}</button></footer></section></div>}
{module!=="Dashboard" && <div className="module-view">
{module!=="NAVYLOG"&&module!=="NAVYMAINT"&&module!=="NAVYSTOCK"&&module!=="NAVYDOCS"&&<section className="module-hero">
<div>
<small>OPERATIONAL MODULE</small>
<h1>{selected?.label||module}</h1>
<p>{selected?.desc||"Operational management"}</p>
</div>

<div className="record-count">{selected?.table?rows.length:"—"}<small>RECORDS</small>
</div>

</section>
}
{module==="NAVYLOG"&&<div className="dg-logbook">
<LogbookSummary supabase={sb} unitId={profile.unit_id} onTab={setLogTab} refreshKey={logRefresh}/>
<LogTabs tab={logTab} onTab={setLogTab}/>
{notice&&<p className="dg-note dg-notice" role="status">{notice}</p>}
{logTab==="jaga"&&<div className="dg-log-grid">
<section className="dg-glass dg-card dg-3d-section dg-log-3d"><div className="dg-card-head"><div><div className="dg-eyebrow">Model 3D · pos jaga</div><h2 className="dg-h dg-card-title">Pos jaga hari ini</h2><div className="dg-sub">Perwira Jaga diambil dari penetapan jaga hari ini. Pos lain tampil “—” sampai datanya tercatat.</div></div></div><LogShip3D sb={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} canAccessClassV={canAccessClassV} modes={["jaga"]}/></section>
<DigitalLogbook supabase={sb} unitId={profile.unit_id} userId={user.id} viewer={isViewer} onChange={()=>setLogRefresh(n=>n+1)}/>
</div>}
{logTab==="phst"&&<PHSTLogbook supabase={sb} unitId={profile.unit_id} userId={user.id} canManage={canManage} canOperate={canOperate} viewer={isViewer} onChange={()=>setLogRefresh(n=>n+1)}/>}
{logTab==="agenda"&&<div className="dg-log-stack">
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
<section className="agenda-departments"><div className="agenda-departments-head"><div><small>KEGIATAN TAMBAHAN</small><h4>Rencana tiap Departemen</h4></div><span>4 DEPARTEMEN</span></div><div className="agenda-department-list">{agendaDeptRows.map(p=><article className="agenda-department-card" key={p.id}><button type="button" className="agenda-department-open" onClick={()=>canManage&&setDeptEditDraft({...p})} disabled={!canManage}><span><small>DEPARTEMEN</small><b>{depLabel(normalizeDepartment(String(p.title||""))||p.title)}</b></span><i>{canManage?"EDIT ↗":"TAMBAHAN"}</i></button>{p.description&&<p>{p.description}</p>}</article>)}</div></section>
{deptEditDraft&&<section className="agenda-dept-editor"><div className="agenda-dept-editor-head"><div><small>EDIT KEGIATAN DEPARTEMEN</small><h4>{deptEditDraft.title||"Departemen"}</h4></div><button type="button" className="outline" onClick={()=>setDeptEditDraft(null)} disabled={deptEditSaving}>Tutup</button></div><label>Nama departemen<input value={deptEditDraft.title||""} onChange={e=>setDeptEditDraft(v=>v?({...v,title:e.target.value}):v)}/></label><label>Kegiatan tambahan / uraian<textarea rows={4} value={deptEditDraft.description||""} onChange={e=>setDeptEditDraft(v=>v?({...v,description:e.target.value}):v)}/></label><div className="agenda-dept-editor-actions"><button type="button" className="outline" onClick={()=>setDeptEditDraft(null)} disabled={deptEditSaving}>Batal</button><button type="button" onClick={saveDeptAgenda} disabled={deptEditSaving}>{deptEditSaving?"Menyimpan…":"Simpan perubahan"}</button></div></section>}

</section>
<section className="panel plan-panel">
<div className="panelhead">
<div>
<h3>Impor dokumen PHST</h3>
<p>Unggah PHST (.docx/.pdf). Hasil pembacaan ditinjau dulu, lalu disimpan sebagai agenda DRAFT; data lama tidak dihapus.</p>
</div>

<span className="glass-chip">{isViewer?"Hanya pengelola":"Sumber resmi"}</span>
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
</div>}
{logTab==="jejak"&&<section className="dg-glass dg-card dg-3d-section"><div className="dg-card-head"><div><div className="dg-eyebrow">Model 3D · jejak &amp; latihan</div><h2 className="dg-h dg-card-title">Putar ulang pelayaran &amp; latihan peran</h2><div className="dg-sub">Jejak GPS per tanggal bersama catatan logbook pada jam yang sama. Latihan peran hanya di layar ini dan tidak disimpan.</div></div><NavMapButton label="Buka peta" lang="id"/></div><LogShip3D sb={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} canAccessClassV={canAccessClassV} modes={["putar-ulang","latihan"]}/></section>}
{logTab==="arsip"&&<DailyWatchArchive supabase={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} viewer={isViewer} title="Arsip Logbook" lang="id"/>}
</div>}
{selected?.table && <>
{module==="NAVYDOCS"&&<DailyWatchArchive supabase={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} viewer={isViewer} title="Archive centre"/>}
{module==="NAVYSTOCK"&&<StockWorkspace rows={rows} movements={movements} busy={busy} search={search} setSearch={setSearch} canOperate={canOperate} canManage={canManage} canAccessClassV={canAccessClassV} selectedClass={expandedStockClass} setSelectedClass={setExpandedStockClass} onReload={()=>void loadModule()} notice={notice}
 onNewMovement={(itemId)=>{const chosen=rows.find(r=>r.id===itemId);setMovementDraft({item_id:itemId||"",movement_type:"inbound",quantity:"",movement_date:new Date().toISOString().slice(0,10),condition_status:chosen&&["BBM","Air Tawar"].includes(chosen.category)?"not_applicable":"ready"})}}
 onNewItem={d=>setStockDraft(d)} onEditItem={r=>setStockDraft({...r})}
 onEditSupply={item=>{const cur=Number(item.stock_ready||0);setSupplyDraft({...item,target_stock:String(cur),stock_ready_current:cur})}}
 onEditSkiff={item=>{const cur=Number(item.stock_ready||0);setSkiffFuelDraft({...item,target_stock:String(cur),stock_ready_current:cur})}}
 tank3d={<section className="dg-glass dg-card dg-3d-section"><div className="dg-card-head"><div><div className="dg-eyebrow">3D model · Class I &amp; III</div><h2 className="dg-h dg-card-title">Fuel &amp; fresh water tanks</h2><div className="dg-sub">Tank levels come from the HSD and fresh water inventory. {isAdmin?"Enter a sounding to update the balance.":"Only the Admin can update soundings."} Tank positions on the model are schematic.</div></div></div><VesselModel3D supabase={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} canAccessClassV={canAccessClassV} modes={["tangki"]} onDataChange={()=>{void loadModule();setSupplyTick(t=>t+1)}} className="dg-3d"/></section>}
 editors={<>{module==="NAVYSTOCK"&&movementDraft&&<div className="dg-modal" role="dialog" aria-modal="true"><section className="dg-modal-card dg-editor"><h3>Record stock transaction</h3><p>The stock balance is calculated by the database. Fuel/fresh water use the “N/A” condition; other categories choose ready or not-ready stock.</p><div className="editor-grid"><label>Item<select value={movementDraft.item_id||""} onChange={e=>{const chosen=rows.find(r=>r.id===e.target.value);setMovementDraft((v:any)=>({...v,item_id:e.target.value,condition_status:["BBM","Air Tawar"].includes(chosen?.category)?"not_applicable":"ready"}))}}><option value="">Select item</option>{rows.filter(r=>r.is_active).map(r=><option key={r.id} value={r.id}>{r.item_code} · {enText(r.item_name)} ({r.stock_ready} {en(r.unit_of_measure)})</option>)}</select></label><label>Transaction type<select value={movementDraft.movement_type} onChange={e=>setMovementDraft((v:any)=>({...v,movement_type:e.target.value}))}><option value="inbound">Inbound</option><option value="outbound">Outbound</option></select></label><label>Quantity<input type="number" min="0.01" step="any" value={movementDraft.quantity} onChange={e=>setMovementDraft((v:any)=>({...v,quantity:e.target.value}))}/></label><label>Date<input type="date" value={movementDraft.movement_date} onChange={e=>setMovementDraft((v:any)=>({...v,movement_date:e.target.value}))}/></label><label>Stock condition<select value={movementDraft.condition_status} onChange={e=>setMovementDraft((v:any)=>({...v,condition_status:e.target.value}))}><option value="ready">Ready</option><option value="unready">Not ready</option><option value="not_applicable">N/A (fuel/water)</option></select></label><label>Reference no.<input value={movementDraft.reference_no||""} onChange={e=>setMovementDraft((v:any)=>({...v,reference_no:e.target.value}))}/></label><label>Purpose<input value={movementDraft.movement_purpose||""} onChange={e=>setMovementDraft((v:any)=>({...v,movement_purpose:e.target.value}))}/></label><label>Notes<input value={movementDraft.notes||""} onChange={e=>setMovementDraft((v:any)=>({...v,notes:e.target.value}))}/></label></div><div className="editor-actions"><button className="outline" onClick={()=>setMovementDraft(null)}>Cancel</button><button disabled={movementSaving} onClick={saveMovement}>{movementSaving?"Saving…":"Save transaction"}</button></div></section></div>}{module==="NAVYSTOCK"&&canManage&&skiffFuelDraft&&<div className="dg-modal" role="dialog" aria-modal="true"><section className="dg-modal-card dg-editor"><h3>Enter rescue boat fuel</h3><p>Recorded in actual litres. Rescue boat fuel has no capacity percentage or level bar.</p><div className="editor-grid"><label>Rescue boat fuel (litres)<input type="number" min="0" step="any" value={skiffFuelDraft.target_stock??""} onChange={e=>setSkiffFuelDraft((v:any)=>({...v,target_stock:e.target.value}))}/><small>Saldo saat ini: {Number(skiffFuelDraft.stock_ready_current||0).toLocaleString("en-GB")} L</small></label></div><div className="editor-actions"><button className="outline" type="button" onClick={()=>setSkiffFuelDraft(null)} disabled={skiffFuelSaving}>Cancel</button><button type="button" onClick={saveSkiffFuelData} disabled={skiffFuelSaving}>{skiffFuelSaving?"Saving…":"Save litres"}</button></div></section></div>}{module==="NAVYSTOCK"&&canManage&&stockDraft&&<div className="dg-modal" role="dialog" aria-modal="true"><section className="dg-modal-card dg-editor">
<div>
<small>ADMIN CONTROL · STOCK</small>
<h3>{stockDraft.id?"Edit inventory item":"Add inventory item"}</h3>
</div>

<div className="stock-editor-grid"><p className="wide">Opening and running balances only change through inbound/outbound transactions so history and stock calculations stay consistent.</p>{["item_code","item_name","category","unit_of_measure","minimum_stock","brand","caliber","caliber_unit","secondary_caliber","ammo_type","lot_no","manufacture_year","country_of_origin","unit_price","capacity_liters"].map(k=>
<label key={k}>{labels[k]||k.replaceAll("_"," ")}<input type={["initial_quantity","stock_ready","stock_unready","minimum_stock","unit_price","capacity_liters","manufacture_year"].includes(k)?"number":"text"} step={["unit_price","capacity_liters","initial_quantity","stock_ready","stock_unready","minimum_stock"].includes(k)?"any":"1"} value={stockDraft[k]??""} onChange={e=>setStockDraft((v:any)=>({...v,[k]:e.target.value}))}/>
</label>)}<label>Status<select value={stockDraft.is_active?"true":"false"} onChange={e=>setStockDraft((v:any)=>({...v,is_active:e.target.value==="true"}))}>
<option value="true">Active</option>
<option value="false">Inactive</option>
</select>
</label>
</div>

<div className="stock-editor-actions">
<button className="outline" onClick={()=>setStockDraft(null)} disabled={stockSaving}>Cancel</button>
<button onClick={saveStockItem} disabled={stockSaving}>{stockSaving?"Saving...":"Save"}</button>
</div>

</section></div>
}</>}/>}
{module==="NAVYMAINT"&&<MaintenanceWorkspace assets={rows} faults={maintenanceRows} busy={busy} section={maintSection as any} setSection={s=>{setMaintSection(s);setSearch("")}} search={search} setSearch={setSearch} canOperate={canOperate} canManage={canManage} onReload={()=>void loadModule()} notice={notice}
 onReportFault={()=>setMaintenanceDraft({report_date:new Date().toISOString().slice(0,10),asset_id:"",issue_description:"",action_taken:""})}
 onAddAsset={()=>setAssetDraft({asset_code:"",asset_name:"",category:maintSection==="ALL"?"PLATFORM":maintSection,location_label:"",condition_label:"Baik",is_active:true})}
 onEditAsset={r=>setAssetDraft({...r})} onStatus={(r,st)=>void updateMaintenanceStatus(r,st)}
 onShowOnShip={partId=>{setFocusPart(partId);window.setTimeout(()=>document.getElementById("maint-3d")?.scrollIntoView({behavior:"smooth",block:"start"}),60)}}
 ship3d={<section id="maint-3d" className="dg-glass dg-card dg-3d-section"><div className="dg-card-head"><div><div className="dg-eyebrow">3D model · faults &amp; deck plan</div><h2 className="dg-h dg-card-title">Mark faults on the ship</h2><div className="dg-sub">Select a ship part to report a fault or change its status. {canManage?"In the Decks view, pick a room to fill an asset location.":""}</div></div></div><VesselModel3D supabase={sb} unitId={profile.unit_id} userId={user.id} role={profile.role} canAccessClassV={canAccessClassV} modes={["kerusakan","geladak"]} key={"maint3d-"+(focusPart||"")} initialPart={focusPart} onDataChange={loadModule} onRoomPick={canManage?pickAssetRoom:undefined} roomPickLabel="Use as asset location" className="dg-3d"/></section>}
 editors={<>{module==="NAVYMAINT"&&maintenanceDraft&&<div className="dg-modal" role="dialog" aria-modal="true"><section className="dg-modal-card dg-editor"><h3>Report fault / maintenance</h3><div className="editor-grid"><label>Related asset<select value={maintenanceDraft.asset_id||""} onChange={e=>setMaintenanceDraft((v:any)=>({...v,asset_id:e.target.value}))}><option value="">Select asset (optional)</option>{rows.map(r=><option key={r.id} value={r.id}>{r.asset_code} · {r.asset_name}</option>)}</select></label><label>Report date<input type="date" value={maintenanceDraft.report_date||""} onChange={e=>setMaintenanceDraft((v:any)=>({...v,report_date:e.target.value}))}/></label><label className="wide">Fault / finding description<textarea value={maintenanceDraft.issue_description||""} onChange={e=>setMaintenanceDraft((v:any)=>({...v,issue_description:e.target.value}))} rows={3}/></label><label className="wide">Initial action (if any)<textarea value={maintenanceDraft.action_taken||""} onChange={e=>setMaintenanceDraft((v:any)=>({...v,action_taken:e.target.value}))} rows={2}/></label></div><div className="editor-actions"><button className="outline" onClick={()=>setMaintenanceDraft(null)}>Cancel</button><button disabled={maintenanceSaving} onClick={saveMaintenance}>{maintenanceSaving?"Saving…":"Save report"}</button></div></section></div>}{module==="NAVYMAINT"&&assetDraft&&<div className="dg-modal" role="dialog" aria-modal="true"><section className="dg-modal-card dg-editor"><h3>{assetDraft.id?"Edit asset":"Add maintenance asset"}</h3><div className="editor-grid">{[["asset_code","Asset code"],["asset_name","Asset name"],["location_label","Location"]].map(([k,l])=><label key={k}>{l}<input value={assetDraft[k]??""} onChange={e=>setAssetDraft((v:any)=>({...v,[k]:e.target.value}))}/></label>)}<label>Subsystem<select value={String(assetDraft.category||maintSection).toUpperCase().includes("PLATFORM")?"PLATFORM":"SEWACO"} onChange={e=>setAssetDraft((v:any)=>({...v,category:e.target.value}))}><option value="SEWACO">SEWACO</option><option value="PLATFORM">PLATFORM</option></select></label><label>Condition<select value={assetDraft.condition_label||"Baik"} onChange={e=>setAssetDraft((v:any)=>({...v,condition_label:e.target.value}))}>{["Baik","Perlu Perhatian","Rusak Ringan","Rusak Berat"].map(x=><option key={x} value={x}>{({"Baik":"Good","Perlu Perhatian":"Needs attention","Rusak Ringan":"Minor damage","Rusak Berat":"Major damage"} as Record<string,string>)[x]}</option>)}</select></label></div><div className="editor-actions"><button className="outline" onClick={()=>setAssetDraft(null)}>Cancel</button><button disabled={assetSaving} onClick={saveAsset}>{assetSaving?"Saving…":"Save asset"}</button></div></section></div>}</>}/>}
{module!=="NAVYLOG"&&module!=="NAVYDOCS"&&module!=="NAVYSTOCK"&&module!=="NAVYMAINT"&&<section className="panel data-panel">
<div className="panelhead">
<div>
<h3>{module==="NAVYMAINT"?(maintSection==="ALL"?"SHIP MAINTENANCE":maintSection):(titles[selected.table]||module)}</h3>
<p>Live data from Supabase · RLS protected</p>
</div>

<div className="panelhead-actions">{module==="NAVYSTOCK"&&canOperate&&<button onClick={()=>setMovementDraft({item_id:"",movement_type:"inbound",quantity:"",movement_date:new Date().toISOString().slice(0,10),condition_status:"ready"})}>+ Record transaction</button>}{module==="NAVYSTOCK"&&canManage&&<button className="outline" onClick={()=>setStockDraft({item_code:"",item_name:"",category:"Logistik",unit_of_measure:"unit",initial_quantity:0,stock_ready:0,stock_unready:0,minimum_stock:0,is_active:true})}>+ Add item</button>}{module==="NAVYMAINT"&&canOperate&&<button onClick={()=>setMaintenanceDraft({report_date:new Date().toISOString().slice(0,10),asset_id:"",issue_description:"",action_taken:""})}>+ Report fault</button>}{module==="NAVYMAINT"&&canManage&&<button className="outline" onClick={()=>setAssetDraft({asset_code:"",asset_name:"",category:maintSection,location_label:"",condition_label:"Baik",is_active:true})}>+ Add {maintSection} asset</button>}{module==="NAVYCREW"&&canManage&&<button onClick={()=>setCrewDraft({sequence_no:"",full_name:"",rank_title:"",position:"",roster_period:new Date().toISOString().slice(0,10)})}>+ Add personnel</button>}<button className="outline" onClick={()=>loadModule()} disabled={busy}>{busy?"Loading…":"↻ Refresh"}</button>
</div>

</div>

<div className="toolbar">
<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={module==="NAVYSTOCK"?"Search items…":"Search records…"}/>
<span>{filtered.length} / {rows.length} records</span>
</div>



{module==="NAVYCREW"&&crewDraft&&<section className="editor-panel"><h3>{crewDraft.id?"Edit personnel":"Add personnel"}</h3><div className="editor-grid">{[["sequence_no","Sequence no.","number"],["full_name","Full name","text"],["rank_title","Rank","text"],["position","Position","text"],["roster_period","Roster period","date"]].map(([k,l,t])=><label key={k}>{l}<input type={t} value={crewDraft[k]??""} onChange={e=>setCrewDraft((v:any)=>({...v,[k]:e.target.value}))}/></label>)}</div><div className="editor-actions"><button className="outline" onClick={()=>setCrewDraft(null)}>Cancel</button><button disabled={crewSaving} onClick={saveCrew}>{crewSaving?"Saving…":"Save personnel"}</button></div></section>}
{notice&&<div className="notice">{notice}</div>
}
{module==="NAVYSTOCK"?null:busy?<div className="empty">Loading secured records…</div>:filtered.length>0?<div className={"table-wrap"+(module==="NAVYCREW"?" navycrew-table-wrap":"")}><table className={module==="NAVYCREW"?"navycrew-fit-table":undefined}><thead><tr>{(fields[selected.table]||Object.keys(filtered[0])).map(k=><th key={k}>{labels[k]||k.replaceAll("_"," ")}</th>)}{(module==="NAVYSTOCK"&&canManage||module==="NAVYCREW"&&canManage||module==="NAVYMAINT"&&canManage)&&<th>Aksi</th>}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id||i}>{(fields[selected.table]||Object.keys(r)).map(k=><td key={k} className={module==="NAVYSTOCK"&&canManage&&!["initial_quantity","stock_ready","stock_unready"].includes(k)?"editable-stock-cell":""} onClick={()=>{if(module==="NAVYSTOCK"&&canManage&&!cellSaving&&!["initial_quantity","stock_ready","stock_unready"].includes(k)){setEditingCell({id:r.id,field:k});setCellDraft(r[k]===null||r[k]===undefined?"":String(r[k]))}}}>{module==="NAVYSTOCK"&&canManage&&!["initial_quantity","stock_ready","stock_unready"].includes(k)&&editingCell?.id===r.id&&editingCell?.field===k?<input autoFocus type={["minimum_stock","unit_price","capacity_liters","manufacture_year"].includes(k)?"number":"text"} value={cellDraft} disabled={cellSaving} onClick={e=>e.stopPropagation()} onChange={e=>setCellDraft(e.target.value)} onBlur={()=>saveInlineCell(r,k)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();if(e.key==="Escape")setEditingCell(null)}} aria-label={"Edit "+(labels[k]||k)}/>:fmt(r[k])}</td>)}{module==="NAVYSTOCK"&&canManage&&<td><button className="outline stock-edit-button" onClick={()=>setStockDraft({...r})}>Edit</button></td>}{module==="NAVYCREW"&&canManage&&<td><button className="outline stock-edit-button" onClick={()=>setCrewDraft({...r})}>Edit</button></td>}{module==="NAVYMAINT"&&canManage&&<td><button className="outline stock-edit-button" onClick={()=>setAssetDraft({...r})}>Edit</button></td>}</tr>)}</tbody></table></div>:<div className="empty">No data in this table, or the account has no read access.</div>}
</section>
}

</>}
{module==="ADMINISTRATION"&&isAdmin&&<section className="admin-access-board">
 <header className="admin-access-heading"><div><small>SECURITY · IDENTITY · ACCESS GOVERNANCE</small><h1>ADMINISTRATION</h1><p>ALNAV DMS account directory and KRI ALAMANG-644 unit access control.</p></div><span>ADMIN MASTER CONTROL</span></header>
 <div className="admin-access-summary">
  <article><small>ACCOUNT DIRECTORY</small><b>{accountRows.length}</b><span>Accounts in the active unit</span></article>
  <article><small>ACTIVE ACCOUNTS</small><b>{accountRows.filter(a=>a.is_active).length}</b><span>With active access</span></article>
  <article><small>DEPARTMENT ASSIGNMENTS</small><b>{accountRows.filter(a=>a.department_code).length}/{accountRows.length}</b><span>{accountRows.filter(a=>a.is_department_head).length} Heads of Department assigned</span></article>
 </div>
 <section className="panel data-panel admin-account-panel"><div className="panelhead"><div><h3>User directory & department rights</h3><p>Assign the department, Head of Department status and Class V authorisation for each account.</p></div><button type="button" onClick={()=>setAccountInviteDraft({email:"",full_name:"",rank_title:"",role:"viewer",department_code:"OPS",is_department_head:false,can_access_class_v:false})}>+ INVITE PERSONNEL</button></div>
  {accountError&&<div className="notice">{accountError}</div>}
  {accountBusy?<div className="empty">Loading account directory…</div>:accountRows.length?<div className="table-wrap"><table><thead><tr><th>NAME</th><th>RANK</th><th>ROLE</th><th>STATUS</th><th>DEPARTMENT</th><th>HEAD OF DEPT.</th><th>CLASS V ACCESS</th><th>ACTION</th></tr></thead><tbody>{accountRows.map(account=><tr key={account.id}><td><b>{account.full_name}</b></td><td>{account.rank_title||"—"}</td><td><span className="admin-role-chip">{String(account.role||"").toUpperCase()}</span></td><td>{account.is_active?"ACTIVE":"INACTIVE"}</td><td>{depLabel(account.department_code)||"NO DEPARTMENT"}</td><td>{account.is_department_head?"YES":"NO"}</td><td>{account.can_access_class_v?"ALLOWED":"NO"}</td><td><button type="button" className="outline stock-edit-button" disabled={account.id===profile?.id||!account.is_active} onClick={()=>setAccountEditDraft({...account})}>MANAGE ACCESS</button></td></tr>)}</tbody></table></div>:<div className="empty">No accounts in this unit yet.</div>}
  {accountInviteDraft&&<div className="admin-account-editor admin-account-invite"><div><small>NEW ACCOUNT · EMAIL INVITATION</small><b>Invite new personnel</b></div><label>Full name<input value={accountInviteDraft.full_name||""} onChange={e=>setAccountInviteDraft((v:any)=>v?({...v,full_name:e.target.value}):v)} placeholder="Name as in the personnel list"/></label><label>Account email<input type="email" value={accountInviteDraft.email||""} onChange={e=>setAccountInviteDraft((v:any)=>v?({...v,email:e.target.value}):v)} placeholder="name@domain.com"/></label><label>Rank<input value={accountInviteDraft.rank_title||""} onChange={e=>setAccountInviteDraft((v:any)=>v?({...v,rank_title:e.target.value}):v)} placeholder="e.g. LETDA"/></label><label>Account role<select value={accountInviteDraft.role||"viewer"} onChange={e=>setAccountInviteDraft((v:any)=>v?({...v,role:e.target.value}):v)}><option value="viewer">Viewer — read information</option><option value="operator">Operator — operational input</option><option value="officer">Officer</option></select></label><label>Department<select value={accountInviteDraft.department_code||""} onChange={e=>setAccountInviteDraft((v:any)=>v?({...v,department_code:e.target.value,is_department_head:e.target.value?v.is_department_head:false,can_access_class_v:e.target.value==="OPS"?v.can_access_class_v:false}):v)}><option value="">No department — command (Commander, Palaksa)</option><option value="OPS">DEPOPS — Operations (Operasi)</option><option value="SIN">DEPSIN — Engineering (Mesin)</option><option value="EKA">DEPEKA — Electronics (Elektronika)</option><option value="LOG">DEPLOG — Logistics (Logistik)</option></select></label><label className="admin-access-check"><input type="checkbox" checked={!!accountInviteDraft.is_department_head} disabled={!accountInviteDraft.department_code} onChange={e=>setAccountInviteDraft((v:any)=>v?({...v,is_department_head:e.target.checked}):v)}/> Head of Department</label><label className="admin-access-check"><input type="checkbox" checked={!!accountInviteDraft.can_access_class_v} disabled={accountInviteDraft.department_code!=="OPS"} onChange={e=>setAccountInviteDraft((v:any)=>v?({...v,can_access_class_v:e.target.checked}):v)}/> Otorisasi Class V</label><div className="admin-account-actions"><button type="button" className="outline" onClick={()=>setAccountInviteDraft(null)} disabled={accountInviteSaving}>CANCEL</button><button type="button" onClick={inviteDepartmentAccount} disabled={accountInviteSaving}>{accountInviteSaving?"SENDING…":"SEND INVITATION"}</button></div></div>}
 {accountEditDraft&&<div className="admin-account-editor"><div><small>ACCOUNT ACCESS CONTROL</small><b>{accountEditDraft.full_name}</b></div><label>Department<select value={accountEditDraft.department_code||""} onChange={e=>setAccountEditDraft((v:any)=>v?({...v,department_code:e.target.value||null,is_department_head:e.target.value? v.is_department_head:false,can_access_class_v:e.target.value==="OPS"?v.can_access_class_v:false}):v)}><option value="">No department — command (Commander, Palaksa)</option><option value="OPS">DEPOPS — Operations (Operasi)</option><option value="SIN">DEPSIN — Engineering (Mesin)</option><option value="EKA">DEPEKA — Electronics (Elektronika)</option><option value="LOG">DEPLOG — Logistics (Logistik)</option></select></label><label className="admin-access-check"><input type="checkbox" checked={!!accountEditDraft.is_department_head} disabled={!accountEditDraft.department_code} onChange={e=>setAccountEditDraft((v:any)=>v?({...v,is_department_head:e.target.checked}):v)}/> Head of Department</label><label className="admin-access-check"><input type="checkbox" checked={!!accountEditDraft.can_access_class_v} disabled={accountEditDraft.department_code!=="OPS"} onChange={e=>setAccountEditDraft((v:any)=>v?({...v,can_access_class_v:e.target.checked}):v)}/> Class V access authorisation</label><div className="admin-account-actions"><button type="button" className="outline" onClick={()=>setAccountEditDraft(null)} disabled={accountEditSaving}>CANCEL</button><button type="button" onClick={saveAccountScope} disabled={accountEditSaving}>{accountEditSaving?"SAVING…":"SAVE ACCESS"}</button></div></div>}
 </section>
 <section className="admin-access-roadmap"><div><small>DEPARTMENTAL RBAC · NEXT CONTROL LAYER</small><h3>Department access structure</h3><p>All active personnel can read general ship information. Input, edit and approval rights are limited by department and authority level.</p></div><div className="admin-department-grid">{[["OPS","OPERATIONS"],["SIN","ENGINEERING"],["EKA","ELECTRONICS"],["LOG","LOGISTICS"]].map(([code,name])=><article key={code}><b>{depLabel(code)}</b><span>{name}</span><small>HEAD OF DEPARTMENT · SPECIFIC ACCESS</small></article>)}</div><div className="admin-access-warning"><b>Account identity and invitations are available.</b><span>The Admin can invite personnel by email, assign DEPOPS/DEPSIN/DEPEKA/DEPLOG, appoint Heads of Department and give Class V authorisation to DEPOPS accounts. Cross-department write restrictions for operational modules are the next stage; a department assignment does not yet grant cross-module edit rights.</span></div></section>
</section>}
{!selected?.table&&module!=="ADMINISTRATION" && <section className="panel coming">
<div className="coming-icon">◇</div>

<small>MODULE FOUNDATION</small>
<h3>{module} is not yet connected to an operational database</h3>
<p>This module has no dedicated table in the audited Supabase schema yet. No sample data is shown. The data structure, workflow and access rights must be defined before the module is enabled.</p>
<span className="glass-chip">NO MOCK DATA · SECURE BY DESIGN</span>
</section>
}</div>
}
</div>
</main>
</div></NavRuntimeProvider>

}
