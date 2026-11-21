"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type Props={supabase:any;unitId:string;userId:string;role:string;viewer:boolean;title?:string};
const WIB="Asia/Jakarta";
const wibDate=(date=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:WIB,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const localClock=()=>new Intl.DateTimeFormat("en-GB",{timeZone:WIB,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
const prettyDate=(d:string)=>new Date(d+"T00:00:00+07:00").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:WIB});
const safe=(v:any)=>{const entities:Record<string,string>={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};return String(v??"").replace(/[&<>"\']/g,c=>entities[c]||c)};
const makeHtml=(r:any)=>{
 const d=r.report_data||{},a=d.watch_assignment||{},logs=d.activity_logs||[];
 const nested=d.checklists||[],runs=d.checklist_runs||nested.map((x:any)=>x.run).filter(Boolean),responses=d.checklist_responses||[],items=d.checklist_items||[];
 const checkRows=nested.length?nested.flatMap((g:any)=>(g.responses||[]).map((pair:any)=>({label:pair.item?.item_label||pair.response?.checklist_item_id,result:pair.response?.result,notes:pair.response?.notes}))).map((x:any)=>`<tr><td>${safe(x.label)}</td><td>${safe(x.result)}</td><td>${safe(x.notes||"—")}</td></tr>`).join(""):responses.map((x:any)=>{const item=items.find((i:any)=>i.id===x.checklist_item_id);return `<tr><td>${safe(item?.item_label||x.checklist_item_id)}</td><td>${safe(x.result)}</td><td>${safe(x.notes||"—")}</td></tr>`}).join("");
 return `<!doctype html><html><head><meta charset="utf-8"><title>NAVYLOG ${safe(r.duty_date)}</title><style>body{font:12pt Arial,sans-serif;color:#142638;margin:36px}h1,h2{color:#123e62}h1{font-size:20pt}h2{font-size:14pt;border-bottom:1px solid #aac4d4;padding-bottom:6px}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #b7c8d4;padding:7px;text-align:left}th{background:#eaf3f8}.meta{color:#526779}.approved{font-size:18pt;letter-spacing:3px;font-weight:bold;color:#176b52;border:2px solid #176b52;padding:10px;display:inline-block}</style></head><body><h1>NAVYLOG · KRI ALAMANG-644</h1><p class="meta">Laporan kegiatan dan serah terima jaga · ${safe(prettyDate(r.duty_date))}</p><h2>Serah Terima Jaga</h2><table><tr><th>Jenis jaga</th><td>${safe(a.watch_type||"—")}</td></tr><tr><th>Perwira jaga lama</th><td>${safe(a.old_watch_rank)} ${safe(a.old_watch_name)} · NRP ${safe(a.old_watch_nrp)}</td></tr><tr><th>Perwira jaga baru</th><td>${safe(a.new_watch_rank)} ${safe(a.new_watch_name)} · NRP ${safe(a.new_watch_nrp)}</td></tr><tr><th>Catatan serah terima</th><td>${safe(a.handover_notes||"—")}</td></tr></table><h2>Jurnal Kegiatan</h2><table><tr><th>Waktu</th><th>Kegiatan</th><th>Uraian</th><th>Status</th></tr>${logs.map((x:any)=>`<tr><td>${safe(x.activity_time||"—")}</td><td>${safe(x.title)}</td><td>${safe(x.description)}</td><td>${safe(x.status)}</td></tr>`).join("")||"<tr><td colspan='4'>Tidak ada catatan kegiatan.</td></tr>"}</table><h2>Checklist dan Pemeriksaan</h2><p>Jumlah sesi pemeriksaan: ${runs.length}</p><table><tr><th>Item pemeriksaan</th><th>Hasil</th><th>Catatan</th></tr>${checkRows||"<tr><td colspan='3'>Tidak ada hasil checklist.</td></tr>"}</table><h2>Catatan Tambahan Paga</h2><p>${safe(r.additional_notes||"—").replace(/\n/g,"<br>")}</p><h2>Persetujuan Komandan</h2>${r.approval_text?'<div class="approved">APPROVED</div>':"<p>Belum disetujui.</p>"}<p class="meta">Disetujui oleh: ${safe(r.approved_by_name||"—")} · ${safe(r.approved_at||"—")}</p><p class="meta">Dokumen digital NAVYHUB · KRI Alamang-644</p></body></html>`;
};
export default function DailyWatchArchive({supabase,unitId,userId,role,viewer,title="Arsip Logbook & Serah Terima"}:Props){
 const [reports,setReports]=useState<any[]>([]),[activities,setActivities]=useState<any[]>([]),[profiles,setProfiles]=useState<Record<string,string>>({});
 const [fromDate,setFromDate]=useState(wibDate(new Date(Date.now()-30*86400000))),[toDate,setToDate]=useState(wibDate()),[year,setYear]=useState(""),[day,setDay]=useState(""),[query,setQuery]=useState("");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[drafts,setDrafts]=useState<Record<string,string>>({}),[approvalDrafts,setApprovalDrafts]=useState<Record<string,string>>({});
 const canReview=role==="commander",canWrite=!viewer&&["admin","commander","officer","operator"].includes(role);
 const load=useCallback(async()=>{
  if(!unitId)return;
  if(fromDate&&toDate&&fromDate>toDate){setNotice("Rentang tanggal tidak valid: tanggal awal harus sebelum tanggal akhir.");return}
  setBusy(true);setNotice("");
  let rq=supabase.from("daily_watch_reports").select("*").eq("unit_id",unitId).order("duty_date",{ascending:false}).limit(500);
  let aq=supabase.from("activity_logs").select("id,activity_date,activity_time,title,description,category,status,created_at").eq("unit_id",unitId).order("activity_date",{ascending:false}).order("activity_time",{ascending:true}).limit(1000);
  if(fromDate){rq=rq.gte("duty_date",fromDate);aq=aq.gte("activity_date",fromDate)}
  if(toDate){rq=rq.lte("duty_date",toDate);aq=aq.lte("activity_date",toDate)}
  const [rr,aa]=await Promise.all([rq,aq]);
  if(rr.error||aa.error){setNotice("Arsip belum dapat dimuat: "+(rr.error||aa.error)?.message);setBusy(false);return}
  const rs=(rr.data||[]) as any[],as=(aa.data||[]) as any[];
  setReports(rs);setActivities(as);
  const ids=[...new Set(rs.flatMap(x=>[x.created_by,x.approved_by]).filter(Boolean))];
  if(ids.length){const {data}=await supabase.from("profiles").select("id,full_name,rank_title").in("id",ids);const map:Record<string,string>={};(data||[]).forEach((p:any)=>map[p.id]=[p.rank_title,p.full_name].filter(Boolean).join(" "));setProfiles(map)}
  setBusy(false);
 },[supabase,unitId,fromDate,toDate]);
 useEffect(()=>{load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")load()},15000);return()=>window.clearInterval(timer)},[load]);
 const generateYesterday=async()=>{
  if(!canWrite||busy)return;
  if(Number(localClock().slice(0,2))<8){setNotice("Rekap harian baru dibuka setelah pukul 08.00 WIB.");return}
  const yesterday=wibDate(new Date(Date.now()-86400000));
  setBusy(true);setNotice("");
  const {data:existing}=await supabase.from("daily_watch_reports").select("id").eq("unit_id",unitId).eq("duty_date",yesterday).maybeSingle();
  if(existing){setNotice("Rekap tanggal "+prettyDate(yesterday)+" sudah tersedia.");await load();setBusy(false);return}
  const {data:assignment,error:ae}=await supabase.from("daily_watch_assignments").select("*").eq("unit_id",unitId).eq("duty_date",yesterday).maybeSingle();
  if(ae||!assignment){setNotice("Data penetapan jaga untuk "+prettyDate(yesterday)+" belum ditemukan. Rekap tidak dibuat agar tidak menghasilkan laporan kosong.");setBusy(false);return}
  const [logs,runs]=await Promise.all([
   supabase.from("activity_logs").select("*").eq("unit_id",unitId).eq("activity_date",yesterday).order("activity_time"),
   supabase.from("checklist_runs").select("*").eq("unit_id",unitId).eq("duty_date",yesterday).order("performed_at")
  ]);
  if(logs.error||runs.error){setNotice("Data kegiatan/checklist belum dapat dikumpulkan: "+(logs.error||runs.error)?.message);setBusy(false);return}
  const runIds=(runs.data||[]).map((x:any)=>x.id);
  const [responses,items]=runIds.length?await Promise.all([
   supabase.from("checklist_responses").select("*").in("run_id",runIds),
   supabase.from("checklist_items").select("*")
  ]):[{data:[],error:null},{data:[],error:null}];
  if(responses.error||items.error){setNotice("Hasil pemeriksaan belum dapat dikumpulkan.");setBusy(false);return}
  const payload={unit_id:unitId,duty_date:yesterday,assignment_id:assignment.id,created_by:userId,status:"draft",report_data:{watch_assignment:assignment,activity_logs:logs.data||[],checklist_runs:runs.data||[],checklist_responses:responses.data||[],checklist_items:items.data||[],generated_at:new Date().toISOString(),generated_by:"NAVYHUB fallback generator"}};
  const {error}=await supabase.from("daily_watch_reports").insert(payload);
  if(error)setNotice("Rekap tidak dapat disimpan: "+error.message);
  else setNotice("Rekap tanggal "+prettyDate(yesterday)+" berhasil dibuat dan masuk arsip.");
  await load();setBusy(false);
 };
 const saveNotes=async(r:any)=>{
  if(!canWrite||r.approved_at)return;
  const {error}=await supabase.from("daily_watch_reports").update({additional_notes:drafts[r.id]??r.additional_notes??""}).eq("id",r.id).is("approved_at",null);
  setNotice(error?"Catatan gagal disimpan: "+error.message:"Catatan tambahan tersimpan.");
  if(!error)await load();
 };
 const approve=async(r:any)=>{
  if(!canReview||approvalDrafts[r.id]!=="APPROVED"||r.approved_at)return;
  const {error}=await supabase.from("daily_watch_reports").update({approval_text:"APPROVED"}).eq("id",r.id).is("approved_at",null);
  setNotice(error?"Persetujuan gagal disimpan: "+error.message:"Laporan disetujui dan dikunci sebagai arsip permanen.");
  if(!error)await load();
 };
 const exportWord=(r:any)=>{const blob=new Blob(["\ufeff",makeHtml({...r,approved_by_name:profiles[r.approved_by]})],{type:"application/msword"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="NAVYLOG-"+r.duty_date+".doc";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const exportPdf=(r:any)=>{const w=window.open("","_blank");if(!w){setNotice("Izinkan pop-up untuk mencetak PDF.");return}w.document.open();w.document.write(makeHtml({...r,approved_by_name:profiles[r.approved_by]}));w.document.close();w.focus();window.setTimeout(()=>w.print(),350)};
 const exportCsv=()=>{const esc=(v:any)=>`"${String(v??"").replace(/"/g,'""')}"`;const rows:any[]=[["Jenis dokumen","Tanggal","Waktu","Judul / Jenis Jaga","Uraian / Personel","Status","Dibuat oleh","Disetujui oleh","Waktu persetujuan"]];if(sourceFilter!=="activities")reportMatches.forEach(r=>{const a=(r.report_data||{}).watch_assignment||{};rows.push(["Rekap serah terima",r.duty_date,"",a.watch_type||"",`${a.old_watch_name||""} → ${a.new_watch_name||""} ${r.additional_notes||""}`,r.status||"draft",profiles[r.created_by]||"",profiles[r.approved_by]||"",r.approved_at||""])});if(sourceFilter!=="reports")activityMatches.forEach(a=>rows.push(["Logbook",a.activity_date,a.activity_time||"",a.title,a.description,a.status,"","",""]));const csv="\\ufeff"+rows.map(row=>row.map(esc).join(";")).join("\\r\\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`NAVYDOCS-${fromDate||"semua"}-${toDate||"semua"}.csv`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const reportMatches=useMemo(()=>reports.filter(r=>{
  const d=r.report_data||{},a=d.watch_assignment||{},date=new Date(r.duty_date+"T00:00:00+07:00");
  const dayName=date.toLocaleDateString("id-ID",{weekday:"long",timeZone:WIB}).toLowerCase();
  const text=[r.duty_date,r.additional_notes,a.watch_type,a.old_watch_name,a.new_watch_name,a.old_watch_nrp,a.new_watch_nrp,profiles[r.created_by],profiles[r.approved_by],r.status,r.approved_at,JSON.stringify(d.activity_logs||[]),JSON.stringify(d.checklist_runs||[]),JSON.stringify(d.checklist_responses||[]),JSON.stringify(d.checklist_items||[]),JSON.stringify(d.checklists||[])].join(" ").toLowerCase();
  return (!year||r.duty_date.startsWith(year))&&(!day||dayName===day)&&(statusFilter==="all"||(statusFilter==="approved"?!!r.approved_at:!r.approved_at))&&(!query||text.includes(query.trim().toLowerCase()));
 }),[reports,year,day,query,statusFilter,profiles]);
 const activityMatches=useMemo(()=>activities.filter(a=>(!fromDate||a.activity_date>=fromDate)&&(!toDate||a.activity_date<=toDate)&&(!year||a.activity_date.startsWith(year))&&(!day||new Date(a.activity_date+"T00:00:00+07:00").toLocaleDateString("id-ID",{weekday:"long",timeZone:WIB}).toLowerCase()===day)&&(statusFilter==="all"||a.status===statusFilter)&&(!query||[a.activity_date,a.activity_time,a.title,a.description,a.category,a.status].join(" ").toLowerCase().includes(query.trim().toLowerCase()))),[activities,fromDate,toDate,year,day,query,statusFilter]);
 return <section className="watch-archive">
  <div className="watch-archive-head"><div><small>NAVYDOCS / DIGITAL RECORDS</small><h3>{title}</h3><p className="watch-archive-subtitle">Rekap otomatis setiap hari pukul 08.00 WIB · pencarian lintas logbook, checklist, dan serah terima</p></div><div className="watch-archive-head-actions"><button onClick={exportCsv} disabled={!reportMatches.length&&!activityMatches.length}>Export hasil CSV</button><button onClick={generateYesterday} disabled={!canWrite||busy||Number(localClock().slice(0,2))<8}>{busy?"Memproses...":"Buat rekap hari sebelumnya"}</button></div></div>
  <div className="watch-archive-filters">
   <label>Dari tanggal<input type="date" value={fromDate} max={toDate||undefined} onChange={e=>{setYear("");setFromDate(e.target.value)}}/></label>
   <label>Sampai tanggal<input type="date" value={toDate} min={fromDate||undefined} onChange={e=>{setYear("");setToDate(e.target.value)}}/></label>
   <label>Tahun<input inputMode="numeric" maxLength={4} placeholder="Semua tahun" value={year} onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,4);setYear(v);if(v.length===4){setFromDate(v+"-01-01");setToDate(v+"-12-31")}else if(v.length===0){setFromDate(wibDate(new Date(Date.now()-30*86400000)));setToDate(wibDate())}}}/></label>
   <label>Hari<select value={day} onChange={e=>setDay(e.target.value)}><option value="">Semua hari</option>{["senin","selasa","rabu","kamis","jumat","sabtu","minggu"].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
   <label className="watch-search">Cari lintas dokumen<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nama, NRP, kegiatan, checklist, catatan..."/></label>
   <label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Semua status</option><option value="draft">Draft / menunggu</option><option value="submitted">Diajukan</option><option value="approved">Disetujui</option></select></label>
   <label>Jenis dokumen<select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option value="all">Semua dokumen</option><option value="reports">Rekap serah terima</option><option value="activities">Logbook kegiatan</option></select></label>
  </div>
  {notice&&<div className="watch-archive-notice">{notice}</div>}
  {sourceFilter!=="activities"&&<><div className="watch-archive-section-title"><b>REKAP SERAH TERIMA JAGA</b><span>{reportMatches.length} DOKUMEN</span></div>}
  {sourceFilter!=="activities"&&(busy?<div className="watch-archive-empty">Memuat arsip...</div>:reportMatches.length?reportMatches.map(r=>{const d=r.report_data||{},a=d.watch_assignment||{},logs=d.activity_logs||[],nested=d.checklists||[],runs=d.checklist_runs||nested.map((x:any)=>x.run).filter(Boolean),responses=d.checklist_responses||nested.flatMap((x:any)=>x.responses||[]).map((x:any)=>x.response).filter(Boolean);return <article className="watch-report" key={r.id}>
   <div className="watch-report-top"><div><small>LOGBOOK HARIAN · {r.duty_date}</small><h4>{prettyDate(r.duty_date)}</h4><span className={"watch-report-status "+(r.approved_at?"approved":"pending")}>{r.approved_at?"DISETUJUI KOMANDAN · TERKUNCI":"BELUM DISETUJUI · MENUNGGU KOMANDAN"}</span></div><div className="watch-report-actions"><button onClick={()=>exportWord(r)}>Export Word</button><button onClick={()=>exportPdf(r)}>Export PDF</button></div></div>
   <div className="watch-report-grid"><div><small>JENIS JAGA</small><b>{a.watch_type||"—"}</b></div><div><small>PERWIRA JAGA LAMA</small><b>{a.old_watch_rank||"—"} {a.old_watch_name||"—"}</b><span>NRP {a.old_watch_nrp||"—"}</span></div><div><small>PERWIRA JAGA BARU</small><b>{a.new_watch_rank||"—"} {a.new_watch_name||"—"}</b><span>NRP {a.new_watch_nrp||"—"}</span></div><div><small>KEGIATAN / CHECKLIST</small><b>{logs.length} kegiatan · {runs.length} sesi · {responses.length} hasil</b></div></div>
   {logs.length>0&&<div className="watch-report-logs"><b>Ringkasan kegiatan</b>{logs.slice(0,8).map((x:any)=><div key={x.id}><time>{String(x.activity_time||"").slice(0,5)||"—"}</time><span><strong>{x.title}</strong><small>{x.category} · {x.status}</small></span></div>)}</div>}
   <label className="watch-report-notes">Catatan tambahan Paga<textarea value={drafts[r.id]??r.additional_notes??""} onChange={e=>setDrafts(v=>({...v,[r.id]:e.target.value}))} disabled={!canWrite||!!r.approved_at} placeholder="Tambahkan kejadian, catatan, atau hal yang perlu diketahui Komandan..."/></label>
   {!r.approved_at&&canWrite&&<button className="watch-save-notes" onClick={()=>saveNotes(r)}>Simpan catatan tambahan</button>}
   <div className="watch-report-approval">{r.approved_at?<div><b>APPROVED</b><small>Oleh {profiles[r.approved_by]||"Komandan"} · {new Date(r.approved_at).toLocaleString("id-ID",{timeZone:WIB})}</small></div>:canReview?<div><label>Ketik APPROVED untuk menyetujui laporan<input value={approvalDrafts[r.id]||""} onChange={e=>setApprovalDrafts(v=>({...v,[r.id]:e.target.value.toUpperCase()}))} placeholder="APPROVED"/></label><button disabled={approvalDrafts[r.id]!=="APPROVED"} onClick={()=>approve(r)}>Setujui dan kunci laporan</button></div>:<small>Menunggu review akun Komandan.</small>}</div>
  </article>}):<div className="watch-archive-empty">Belum ada rekap pada rentang tanggal ini. Buat rekap hari sebelumnya setelah pukul 08.00 WIB.</div>}
  )}
  {sourceFilter!=="reports"&&<><div className="watch-archive-section-title"><b>RIWAYAT LOGBOOK KEGIATAN</b><span>{activityMatches.length} CATATAN</span></div>}
  {sourceFilter!=="reports"&&(activityMatches.length?<div className="watch-activity-list">{activityMatches.map(a=><article key={a.id}><time>{prettyDate(a.activity_date)} · {String(a.activity_time||"").slice(0,5)||"—"}</time><div><b>{a.title}</b><small>{a.category} · {a.status}</small>{a.description&&<p>{a.description}</p>}</div></article>)}</div>:<div className="watch-archive-empty">Tidak ada kegiatan yang cocok dengan filter pencarian.</div>}
  )}
  <p className="watch-archive-foot">Rekap otomatis dijalankan oleh scheduler database pukul 08.00 WIB. Persetujuan Komandan dicatat bersama identitas akun dan waktu server. Laporan yang telah disetujui tidak dapat diubah kembali.</p>
 </section>;
}
