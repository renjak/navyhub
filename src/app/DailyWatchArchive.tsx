"use client";
import Portal from "./Portal";
import {en,enText} from "./displayEn";
import {useCallback,useEffect,useMemo,useState} from "react";

type Props={supabase:any;unitId:string;userId:string;role:string;viewer:boolean;title?:string;lang?:"en"|"id"};
const WIB="Asia/Jakarta";
const wibDate=(date=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:WIB,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const localClock=()=>new Intl.DateTimeFormat("en-GB",{timeZone:WIB,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
const prettyDate=(d:string)=>new Date(d+"T00:00:00+07:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:WIB});
const safe=(v:any)=>{const entities:Record<string,string>={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};return String(v??"").replace(/[&<>"\']/g,c=>entities[c]||c)};
const makeHtml=(r:any,lang:"en"|"id"="en")=>{
 const ID=lang==="id",L=(e:string,x:string)=>ID?x:e,dv=(v:any):string=>ID?String(v??""):en(v),dt=(v:any):string=>ID?String(v??""):enText(v),pdate=(d:string)=>new Date(d+"T00:00:00+07:00").toLocaleDateString(ID?"id-ID":"en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:WIB});
 const d=r.report_data||{},a=d.watch_assignment||{},logs=d.activity_logs||[];
 const nested=d.checklists||[],runs=d.checklist_runs||nested.map((x:any)=>x.run).filter(Boolean),responses=d.checklist_responses||[],items=d.checklist_items||[];
 const checkRows=nested.length?nested.flatMap((g:any)=>(g.responses||[]).map((pair:any)=>({label:pair.item?.item_label||pair.response?.checklist_item_id,result:pair.response?.result,notes:pair.response?.notes}))).map((x:any)=>`<tr><td>${safe(dv(x.label))}</td><td>${safe(dv(x.result))}</td><td>${safe(dt(x.notes)||"—")}</td></tr>`).join(""):responses.map((x:any)=>{const item=items.find((i:any)=>i.id===x.checklist_item_id);return `<tr><td>${safe(dv(item?.item_label)||x.checklist_item_id)}</td><td>${safe(dv(x.result))}</td><td>${safe(dt(x.notes)||"—")}</td></tr>`}).join("");
 return `<!doctype html><html><head><meta charset="utf-8"><title>LOGBOOK ${safe(r.duty_date)}</title><style>body{font:12pt Arial,sans-serif;color:#142638;margin:36px}h1,h2{color:#123e62}h1{font-size:20pt}h2{font-size:14pt;border-bottom:1px solid #aac4d4;padding-bottom:6px}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #b7c8d4;padding:7px;text-align:left}th{background:#eaf3f8}.meta{color:#526779}.approved{font-size:18pt;letter-spacing:3px;font-weight:bold;color:#176b52;border:2px solid #176b52;padding:10px;display:inline-block}</style></head><body><h1>LOGBOOK · KRI ALAMANG-644</h1><p class="meta">${L("Activity and watch handover report","Laporan kegiatan dan serah terima jaga")} · ${safe(pdate(r.duty_date))}</p><h2>${L("Watch Handover","Serah Terima Jaga")}</h2><table><tr><th>${L("Watch type","Jenis jaga")}</th><td>${safe(dv(a.watch_type)||"—")}</td></tr><tr><th>${L("Outgoing officer of the watch","Perwira jaga lama")}</th><td>${safe(a.old_watch_rank)} ${safe(a.old_watch_name)} · NRP ${safe(a.old_watch_nrp)}</td></tr><tr><th>${L("Incoming officer of the watch","Perwira jaga baru")}</th><td>${safe(a.new_watch_rank)} ${safe(a.new_watch_name)} · NRP ${safe(a.new_watch_nrp)}</td></tr><tr><th>${L("Handover notes","Catatan serah terima")}</th><td>${safe(a.handover_notes||"—")}</td></tr></table><h2>${L("Activity Journal","Jurnal Kegiatan")}</h2><table><tr><th>${L("Time","Waktu")}</th><th>${L("Activity","Kegiatan")}</th><th>${L("Description","Uraian")}</th><th>Status</th></tr>${logs.map((x:any)=>`<tr><td>${safe(x.activity_time||"—")}</td><td>${safe(dt(x.title))}</td><td>${safe(dt(x.description))}</td><td>${safe(dv(x.status))}</td></tr>`).join("")||`<tr><td colspan='4'>${L("No activity records.","Tidak ada catatan kegiatan.")}</td></tr>`}</table><h2>${L("Checklists and Inspections","Checklist dan Pemeriksaan")}</h2><p>${L("Inspection sessions","Jumlah sesi pemeriksaan")}: ${runs.length}</p><table><tr><th>${L("Inspection item","Item pemeriksaan")}</th><th>${L("Result","Hasil")}</th><th>${L("Notes","Catatan")}</th></tr>${checkRows||`<tr><td colspan='3'>${L("No checklist results.","Tidak ada hasil checklist.")}</td></tr>`}</table><h2>${L("Officer of the Watch Additional Notes","Catatan Tambahan Perwira Jaga")}</h2><p>${safe(r.additional_notes||"—").replace(/\n/g,"<br>")}</p><h2>${L("Commander Approval","Persetujuan Komandan")}</h2>${r.approval_text?'<div class="approved">APPROVED</div>':`<p>${L("Not yet approved.","Belum disetujui.")}</p>`}<p class="meta">${L("Approved by","Disetujui oleh")}: ${safe(r.approved_by_name||"—")} · ${safe(r.approved_at||"—")}</p><p class="meta">${L("ALNAV DMS digital document","Dokumen digital ALNAV DMS")} · KRI Alamang-644</p></body></html>`;
};
export default function DailyWatchArchive({supabase,unitId,userId,role,viewer,title,lang="en"}:Props){
 const ID=lang==="id",T=(e:string,i:string)=>ID?i:e,dv=(v:any)=>ID?String(v??""):en(v),dt=(v:any)=>ID?String(v??""):enText(v);
 const pd=(d:string)=>new Date(d+"T00:00:00+07:00").toLocaleDateString(ID?"id-ID":"en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:WIB});
 const [view,setView]=useState<"files"|"activities">("files"),[openId,setOpenId]=useState<string|null>(null);
 const [reports,setReports]=useState<any[]>([]),[activities,setActivities]=useState<any[]>([]),[profiles,setProfiles]=useState<Record<string,string>>({});
 const [fromDate,setFromDate]=useState(wibDate(new Date(Date.now()-30*86400000))),[toDate,setToDate]=useState(wibDate()),[year,setYear]=useState(""),[day,setDay]=useState(""),[query,setQuery]=useState(""),[statusFilter,setStatusFilter]=useState("all"),[sourceFilter,setSourceFilter]=useState("all");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[drafts,setDrafts]=useState<Record<string,string>>({}),[approvalDrafts,setApprovalDrafts]=useState<Record<string,string>>({});
 const canReview=role==="commander",canWrite=!viewer&&["admin","commander","officer","operator"].includes(role);
 const load=useCallback(async()=>{
  if(!unitId)return;
  if(fromDate&&toDate&&fromDate>toDate){setNotice(T("Invalid date range: the start date must be before the end date.","Rentang tanggal tidak valid: tanggal awal harus sebelum tanggal akhir."));return}
  setBusy(true);setNotice("");
  let rq=supabase.from("daily_watch_reports").select("*").eq("unit_id",unitId).order("duty_date",{ascending:false}).limit(500);
  let aq=supabase.from("activity_logs").select("id,activity_date,activity_time,title,description,category,status,created_at").eq("unit_id",unitId).order("activity_date",{ascending:false}).order("activity_time",{ascending:true}).limit(1000);
  if(fromDate){rq=rq.gte("duty_date",fromDate);aq=aq.gte("activity_date",fromDate)}
  if(toDate){rq=rq.lte("duty_date",toDate);aq=aq.lte("activity_date",toDate)}
  const [rr,aa]=await Promise.all([rq,aq]);
  if(rr.error||aa.error){setNotice(T("Archive could not be loaded: ","Arsip belum dapat dimuat: ")+(rr.error||aa.error)?.message);setBusy(false);return}
  const rs=(rr.data||[]) as any[],as=(aa.data||[]) as any[];
  setReports(rs);setActivities(as);
  const ids=[...new Set(rs.flatMap(x=>[x.created_by,x.approved_by]).filter(Boolean))];
  if(ids.length){const {data}=await supabase.from("profiles").select("id,full_name,rank_title").in("id",ids);const map:Record<string,string>={};(data||[]).forEach((p:any)=>map[p.id]=[p.rank_title,p.full_name].filter(Boolean).join(" "));setProfiles(map)}
  setBusy(false);
 },[supabase,unitId,fromDate,toDate]);
 useEffect(()=>{load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")load()},15000);return()=>window.clearInterval(timer)},[load]);
 const generateYesterday=async()=>{
  if(!canWrite||busy)return;
  if(Number(localClock().slice(0,2))<8){setNotice(T("The daily report opens after 08:00 WIB.","Rekap harian baru dibuka setelah pukul 08.00 WIB."));return}
  const yesterday=wibDate(new Date(Date.now()-86400000));
  setBusy(true);setNotice("");
  const {data:existing}=await supabase.from("daily_watch_reports").select("id").eq("unit_id",unitId).eq("duty_date",yesterday).maybeSingle();
  if(existing){setNotice(T("The report for ","Rekap tanggal ")+pd(yesterday)+T(" already exists."," sudah tersedia."));await load();setBusy(false);return}
  const {data:assignment,error:ae}=await supabase.from("daily_watch_assignments").select("*").eq("unit_id",unitId).eq("duty_date",yesterday).maybeSingle();
  if(ae||!assignment){setNotice(T("No watch assignment found for ","Data penetapan jaga untuk ")+pd(yesterday)+T(". The report was not created to avoid an empty report."," belum ditemukan. Rekap tidak dibuat agar tidak menghasilkan laporan kosong."));setBusy(false);return}
  const [logs,runs]=await Promise.all([
   supabase.from("activity_logs").select("*").eq("unit_id",unitId).eq("activity_date",yesterday).order("activity_time"),
   supabase.from("checklist_runs").select("*").eq("unit_id",unitId).eq("duty_date",yesterday).order("performed_at")
  ]);
  if(logs.error||runs.error){setNotice(T("Activity/checklist data could not be collected: ","Data kegiatan/checklist belum dapat dikumpulkan: ")+(logs.error||runs.error)?.message);setBusy(false);return}
  const runIds=(runs.data||[]).map((x:any)=>x.id);
  const [responses,items]=runIds.length?await Promise.all([
   supabase.from("checklist_responses").select("*").in("run_id",runIds),
   supabase.from("checklist_items").select("*")
  ]):[{data:[],error:null},{data:[],error:null}];
  if(responses.error||items.error){setNotice(T("Inspection results could not be collected.","Hasil pemeriksaan belum dapat dikumpulkan."));setBusy(false);return}
  const payload={unit_id:unitId,duty_date:yesterday,assignment_id:assignment.id,created_by:userId,status:"draft",report_data:{watch_assignment:assignment,activity_logs:logs.data||[],checklist_runs:runs.data||[],checklist_responses:responses.data||[],checklist_items:items.data||[],generated_at:new Date().toISOString(),generated_by:"ALNAV DMS fallback generator"}};
  const {error}=await supabase.from("daily_watch_reports").insert(payload);
  if(error)setNotice(T("The report could not be saved: ","Rekap tidak dapat disimpan: ")+error.message);
  else setNotice(T("The report for ","Rekap tanggal ")+pd(yesterday)+T(" was created and archived."," berhasil dibuat dan masuk arsip."));
  await load();setBusy(false);
 };
 const saveNotes=async(r:any)=>{
  if(!canWrite||r.approved_at)return;
  const {error}=await supabase.from("daily_watch_reports").update({additional_notes:drafts[r.id]??r.additional_notes??""}).eq("id",r.id).is("approved_at",null);
  setNotice(error?T("Failed to save notes: ","Catatan gagal disimpan: ")+error.message:T("Additional notes saved.","Catatan tambahan tersimpan."));
  if(!error)await load();
 };
 const approve=async(r:any)=>{
  if(!canReview||approvalDrafts[r.id]!=="APPROVED"||r.approved_at)return;
  const {error}=await supabase.from("daily_watch_reports").update({approval_text:"APPROVED"}).eq("id",r.id).is("approved_at",null);
  setNotice(error?T("Failed to save approval: ","Persetujuan gagal disimpan: ")+error.message:T("Report approved and locked as a permanent record.","Laporan disetujui dan dikunci sebagai arsip permanen."));
  if(!error)await load();
 };
 const exportWord=(r:any)=>{const blob=new Blob(["\ufeff",makeHtml({...r,approved_by_name:profiles[r.approved_by]},lang)],{type:"application/msword"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="LOGBOOK-"+r.duty_date+".doc";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const exportPdf=(r:any)=>{const w=window.open("","_blank");if(!w){setNotice(T("Allow pop-ups to print the PDF.","Izinkan pop-up untuk mencetak PDF."));return}w.document.open();w.document.write(makeHtml({...r,approved_by_name:profiles[r.approved_by]},lang));w.document.close();w.focus();window.setTimeout(()=>w.print(),350)};
 const exportCsv=()=>{const esc=(v:any)=>`"${String(v??"").replace(/"/g,'""')}"`;const rows:any[]=[["Document type","Date","Time","Title / Watch type","Description / Personnel","Status","Created by","Approved by","Approved at"]];if(sourceFilter!=="activities")reportMatches.forEach(r=>{const a=(r.report_data||{}).watch_assignment||{};rows.push(["Handover report",r.duty_date,"",en(a.watch_type)||"",`${a.old_watch_name||""} → ${a.new_watch_name||""} ${r.additional_notes||""}`,r.status||"draft",profiles[r.created_by]||"",profiles[r.approved_by]||"",r.approved_at||""])});if(sourceFilter!=="reports")activityMatches.forEach(a=>rows.push(["Logbook",a.activity_date,a.activity_time||"",enText(a.title),enText(a.description),en(a.status),"","",""]));const csv="\ufeff"+rows.map(row=>row.map(esc).join(";")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`ARCHIVE-${fromDate||"semua"}-${toDate||"semua"}.csv`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const reportMatches=useMemo(()=>reports.filter(r=>{
  const d=r.report_data||{},a=d.watch_assignment||{},date=new Date(r.duty_date+"T00:00:00+07:00");
  const dayName=date.toLocaleDateString("en-GB",{weekday:"long",timeZone:WIB}).toLowerCase();
  const text=[r.duty_date,r.additional_notes,a.watch_type,a.old_watch_name,a.new_watch_name,a.old_watch_nrp,a.new_watch_nrp,profiles[r.created_by],profiles[r.approved_by],r.status,r.approved_at,JSON.stringify(d.activity_logs||[]),JSON.stringify(d.checklist_runs||[]),JSON.stringify(d.checklist_responses||[]),JSON.stringify(d.checklist_items||[]),JSON.stringify(d.checklists||[])].join(" ").toLowerCase();
  return (!year||r.duty_date.startsWith(year))&&(!day||dayName===day)&&(statusFilter==="all"||r.status===statusFilter)&&(!query||text.includes(query.trim().toLowerCase()));
 }),[reports,year,day,query,statusFilter,profiles]);
 const activityMatches=useMemo(()=>activities.filter(a=>(!fromDate||a.activity_date>=fromDate)&&(!toDate||a.activity_date<=toDate)&&(!year||a.activity_date.startsWith(year))&&(!day||new Date(a.activity_date+"T00:00:00+07:00").toLocaleDateString("en-GB",{weekday:"long",timeZone:WIB}).toLowerCase()===day)&&(statusFilter==="all"||a.status===statusFilter)&&(!query||[a.activity_date,a.activity_time,a.title,a.description,a.category,a.status].join(" ").toLowerCase().includes(query.trim().toLowerCase()))),[activities,fromDate,toDate,year,day,query,statusFilter]);
 const fileName=(r:any)=>"LOGBOOK-"+r.duty_date;
 const opened=openId?reports.find(r=>r.id===openId):null;
 const detail=(r:any)=>{
  const d=r.report_data||{},a=d.watch_assignment||{},logs=d.activity_logs||[],nested=d.checklists||[],runs=d.checklist_runs||nested.map((x:any)=>x.run).filter(Boolean),responses=d.checklist_responses||nested.flatMap((x:any)=>x.responses||[]).map((x:any)=>x.response).filter(Boolean);
  return <div className="dg-archive-detail">
   <div className="dg-grid4">
    <div className="dg-well"><span>{T("Watch type","Jenis jaga")}</span><b>{dv(a.watch_type)||"—"}</b></div>
    <div className="dg-well"><span>{T("Outgoing officer","Perwira jaga lama")}</span><b>{a.old_watch_rank||""} {a.old_watch_name||"—"}</b><small>NRP {a.old_watch_nrp||"—"}</small></div>
    <div className="dg-well"><span>{T("Incoming officer","Perwira jaga baru")}</span><b>{a.new_watch_rank||""} {a.new_watch_name||"—"}</b><small>NRP {a.new_watch_nrp||"—"}</small></div>
    <div className="dg-well"><span>{T("Contents","Isi")}</span><b>{logs.length} {T("activities","kegiatan")} · {runs.length} {T("sessions","sesi")}</b><small>{responses.length} {T("inspection results","hasil pemeriksaan")}</small></div>
   </div>
   <h4 className="dg-h">{T("Activities","Kegiatan")}</h4>
   {logs.length?<ul className="dg-plain-list">{logs.map((x:any)=><li key={x.id}><time>{String(x.activity_time||"").slice(0,5)||"—"}</time><div><b>{dt(x.title)}</b><small>{dv(x.category)} · {dv(x.status)}</small>{x.description&&<p>{dt(x.description)}</p>}</div></li>)}</ul>:<p className="dg-note">{T("No activity records.","Tidak ada catatan kegiatan.")}</p>}
   <h4 className="dg-h">{T("Inspection results","Hasil pemeriksaan")}</h4>
   {nested.length?nested.map((g:any,i:number)=><div key={g.run?.id||i} className="dg-check-group"><b>{dt(g.run?.summary)||dv(g.run?.duty_role)||T("Checklist session ","Sesi checklist ")+(i+1)}</b><ul className="dg-plain-list">{(g.responses||[]).map((pair:any)=><li key={pair.response?.id||pair.item?.id}><div><b>{dv(pair.item?.item_label)||T("Inspection item","Item pemeriksaan")}</b>{pair.response?.notes&&<small>{dt(pair.response.notes)}</small>}</div><em>{dv(pair.response?.result)||T("Not filled","Belum diisi")}</em></li>)}</ul></div>):responses.length?<ul className="dg-plain-list">{responses.map((resp:any)=>{const item=(d.checklist_items||[]).find((it:any)=>it.id===resp.checklist_item_id);return <li key={resp.id}><div><b>{dv(item?.item_label)||T("Inspection item","Item pemeriksaan")}</b>{resp.notes&&<small>{dt(resp.notes)}</small>}</div><em>{dv(resp.result)}</em></li>})}</ul>:<p className="dg-note">{T("No checklist results.","Tidak ada hasil checklist.")}</p>}
   <p className="dg-note">{T("Created by","Dibuat oleh")}: <b>{profiles[r.created_by]||T("Duty officer","Petugas jaga")}</b>{r.approved_at&&<> · {T("Approved by","Disetujui oleh")} <b>{profiles[r.approved_by]||T("Commander","Komandan")}</b> · {new Date(r.approved_at).toLocaleString(ID?"id-ID":"en-GB",{timeZone:WIB})}</>}</p>
   <label className="dg-field">{T("Officer of the watch additional notes","Catatan tambahan Perwira Jaga")}<textarea value={drafts[r.id]??r.additional_notes??""} onChange={e=>setDrafts(v=>({...v,[r.id]:e.target.value}))} disabled={!canWrite||!!r.approved_at} placeholder={T("Add events, notes, or anything the Commander should know...","Tambahkan kejadian, catatan, atau hal yang perlu diketahui Komandan...")}/></label>
   {!r.approved_at&&canWrite&&<button type="button" className="dg-btn" onClick={()=>saveNotes(r)}>{T("Save additional notes","Simpan catatan tambahan")}</button>}
   {!r.approved_at&&(canReview?<div className="dg-approve"><label className="dg-field">{T("Type APPROVED to approve the report","Ketik APPROVED untuk menyetujui laporan")}<input value={approvalDrafts[r.id]||""} onChange={e=>setApprovalDrafts(v=>({...v,[r.id]:e.target.value.toUpperCase()}))} placeholder="APPROVED"/></label><button type="button" className="dg-btn dg-btn-accent" disabled={approvalDrafts[r.id]!=="APPROVED"} onClick={()=>approve(r)}>{T("Approve and lock report","Setujui dan kunci laporan")}</button></div>:<p className="dg-note">{T("Awaiting Commander review.","Menunggu review Komandan.")}</p>)}
  </div>;
 };
 return <section className="dg-glass dg-card dg-archive">
  <div className="dg-card-head">
   <div><div className="dg-eyebrow">{T("Digital records","Arsip digital")}</div><h2 className="dg-h dg-card-title">{title||T("Logbook & handover archive","Arsip Logbook & serah terima")}</h2><div className="dg-sub">{T("A daily logbook file is created automatically at 08:00 WIB. Open a file to see its details.","File logbook harian dibuat otomatis pukul 08.00 WIB. Buka file untuk melihat rinciannya.")}</div></div>
   <div className="dg-head-actions"><button type="button" className="dg-btn" onClick={exportCsv} disabled={!reportMatches.length&&!activityMatches.length}>{T("Export CSV","Export CSV")}</button><button type="button" className="dg-btn" onClick={generateYesterday} disabled={!canWrite||busy||Number(localClock().slice(0,2))<8}>{busy?T("Processing…","Memproses…"):T("Create yesterday's file","Buat file kemarin")}</button></div>
  </div>
  <div className="dg-archive-tools">
   <div role="group" aria-label={T("View","Tampilan")} className="dg-seg dg-seg-sm"><button type="button" aria-pressed={view==="files"} onClick={()=>{setView("files");setSourceFilter("all")}}>{T("Files","File")} · {reportMatches.length}</button><button type="button" aria-pressed={view==="activities"} onClick={()=>setView("activities")}>{T("Activity records","Catatan kegiatan")} · {activityMatches.length}</button></div>
   <label className="dg-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={T("Search name, NRP, activity, notes…","Cari nama, NRP, kegiatan, catatan…")} aria-label={T("Search archive","Cari arsip")}/></label>
   <label className="dg-field-inline"><span>{T("From","Dari")}</span><input type="date" value={fromDate} max={toDate||undefined} onChange={e=>{setYear("");setFromDate(e.target.value)}}/></label>
   <label className="dg-field-inline"><span>{T("To","Sampai")}</span><input type="date" value={toDate} min={fromDate||undefined} onChange={e=>{setYear("");setToDate(e.target.value)}}/></label>
   <select aria-label={T("Status","Status")} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">{T("All statuses","Semua status")}</option><option value="draft">{T("Draft / pending","Draft / menunggu")}</option><option value="submitted">{T("Submitted","Diajukan")}</option><option value="verified">{T("Verified","Terverifikasi")}</option><option value="approved">{T("Approved","Disetujui")}</option></select>
  </div>
  {notice&&<p className="dg-note dg-notice" role="status">{notice}</p>}
  {view==="files"?(busy&&!reports.length?<p className="dg-note">{T("Loading archive…","Memuat arsip…")}</p>:reportMatches.length?<ul className="dg-files">{reportMatches.map(r=>{const a=(r.report_data||{}).watch_assignment||{};return <li key={r.id}>
   <button type="button" className="dg-file-open" onClick={()=>setOpenId(r.id)}>
    <span className="dg-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg></span>
    <span className="dg-file-name"><b>{fileName(r)}</b><small>{pd(r.duty_date)}{a.new_watch_name?" · "+T("OOW ","Pa Jaga ")+[a.new_watch_rank,a.new_watch_name].filter(Boolean).join(" "):""}</small></span>
    <span className={"dg-pill "+(r.approved_at?"dg-pill-live":"dg-pill-stale")}><i/>{r.approved_at?T("Approved · locked","Disetujui · terkunci"):T("Awaiting Commander","Menunggu Komandan")}</span>
   </button>
   <span className="dg-file-actions"><button type="button" className="dg-btn" onClick={()=>exportWord(r)} aria-label={T("Download Word ","Unduh Word ")+fileName(r)}>Word</button><button type="button" className="dg-btn" onClick={()=>exportPdf(r)} aria-label={T("Print PDF ","Cetak PDF ")+fileName(r)}>PDF</button></span>
  </li>})}</ul>:<div className="dg-empty"><b>{T("No files in this date range.","Belum ada file pada rentang tanggal ini.")}</b><span>{T("A file is created once a watch assignment exists for that day.","File dibuat setelah ada penetapan jaga pada hari itu.")}</span></div>)
  :activityMatches.length?<ul className="dg-plain-list dg-activity-list">{activityMatches.map(a=><li key={a.id}><time>{pd(a.activity_date)} · {String(a.activity_time||"").slice(0,5)||"—"}</time><div><b>{dt(a.title)}</b><small>{dv(a.category)} · {dv(a.status)}</small>{a.description&&<p>{dt(a.description)}</p>}</div></li>)}</ul>:<div className="dg-empty"><b>{T("No activities match the filters.","Tidak ada kegiatan yang cocok dengan filter.")}</b></div>}
  {opened&&<Portal><div className="dg-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-label={fileName(opened)} onMouseDown={e=>{if(e.target===e.currentTarget)setOpenId(null)}}><div className="dg-modal-card dg-editor dg-archive-modal">
   <div className="dg-card-head"><div><div className="dg-eyebrow">{fileName(opened)}</div><h2 className="dg-h dg-card-title">{pd(opened.duty_date)}</h2><span className={"dg-pill "+(opened.approved_at?"dg-pill-live":"dg-pill-stale")}><i/>{opened.approved_at?T("Approved by Commander · locked","Disetujui Komandan · terkunci"):T("Awaiting Commander approval","Menunggu persetujuan Komandan")}</span></div><div className="dg-head-actions"><button type="button" className="dg-btn" onClick={()=>exportWord(opened)}>Word</button><button type="button" className="dg-btn" onClick={()=>exportPdf(opened)}>PDF</button><button type="button" className="dg-icon-btn" aria-label={T("Close","Tutup")} onClick={()=>setOpenId(null)}>✕</button></div></div>
   {detail(opened)}
  </div></div></Portal>}
 </section>;
}
