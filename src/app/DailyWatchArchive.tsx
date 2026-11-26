"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type Props={supabase:any;unitId:string;userId:string;role:string;viewer:boolean;title?:string};
const WIB="Asia/Jakarta";
const wibDate=(date=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:WIB,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const localClock=()=>new Intl.DateTimeFormat("en-GB",{timeZone:WIB,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
const prettyDate=(d:string)=>new Date(d+"T00:00:00+07:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:WIB});
const safe=(v:any)=>{const entities:Record<string,string>={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};return String(v??"").replace(/[&<>"\']/g,c=>entities[c]||c)};
const makeHtml=(r:any)=>{
 const d=r.report_data||{},a=d.watch_assignment||{},logs=d.activity_logs||[];
 const nested=d.checklists||[],runs=d.checklist_runs||nested.map((x:any)=>x.run).filter(Boolean),responses=d.checklist_responses||[],items=d.checklist_items||[];
 const checkRows=nested.length?nested.flatMap((g:any)=>(g.responses||[]).map((pair:any)=>({label:pair.item?.item_label||pair.response?.checklist_item_id,result:pair.response?.result,notes:pair.response?.notes}))).map((x:any)=>`<tr><td>${safe(x.label)}</td><td>${safe(x.result)}</td><td>${safe(x.notes||"—")}</td></tr>`).join(""):responses.map((x:any)=>{const item=items.find((i:any)=>i.id===x.checklist_item_id);return `<tr><td>${safe(item?.item_label||x.checklist_item_id)}</td><td>${safe(x.result)}</td><td>${safe(x.notes||"—")}</td></tr>`}).join("");
 return `<!doctype html><html><head><meta charset="utf-8"><title>LOGBOOK ${safe(r.duty_date)}</title><style>body{font:12pt Arial,sans-serif;color:#142638;margin:36px}h1,h2{color:#123e62}h1{font-size:20pt}h2{font-size:14pt;border-bottom:1px solid #aac4d4;padding-bottom:6px}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #b7c8d4;padding:7px;text-align:left}th{background:#eaf3f8}.meta{color:#526779}.approved{font-size:18pt;letter-spacing:3px;font-weight:bold;color:#176b52;border:2px solid #176b52;padding:10px;display:inline-block}</style></head><body><h1>LOGBOOK · KRI ALAMANG-644</h1><p class="meta">Activity and watch handover report · ${safe(prettyDate(r.duty_date))}</p><h2>Watch Handover</h2><table><tr><th>Watch type</th><td>${safe(a.watch_type||"—")}</td></tr><tr><th>Outgoing officer of the watch</th><td>${safe(a.old_watch_rank)} ${safe(a.old_watch_name)} · NRP ${safe(a.old_watch_nrp)}</td></tr><tr><th>Incoming officer of the watch</th><td>${safe(a.new_watch_rank)} ${safe(a.new_watch_name)} · NRP ${safe(a.new_watch_nrp)}</td></tr><tr><th>Handover notes</th><td>${safe(a.handover_notes||"—")}</td></tr></table><h2>Activity Journal</h2><table><tr><th>Time</th><th>Activity</th><th>Description</th><th>Status</th></tr>${logs.map((x:any)=>`<tr><td>${safe(x.activity_time||"—")}</td><td>${safe(x.title)}</td><td>${safe(x.description)}</td><td>${safe(x.status)}</td></tr>`).join("")||"<tr><td colspan='4'>No activity records.</td></tr>"}</table><h2>Checklists and Inspections</h2><p>Inspection sessions: ${runs.length}</p><table><tr><th>Inspection item</th><th>Result</th><th>Notes</th></tr>${checkRows||"<tr><td colspan='3'>No checklist results.</td></tr>"}</table><h2>Officer of the Watch Additional Notes</h2><p>${safe(r.additional_notes||"—").replace(/\n/g,"<br>")}</p><h2>Commander Approval</h2>${r.approval_text?'<div class="approved">APPROVED</div>':"<p>Not yet approved.</p>"}<p class="meta">Approved by: ${safe(r.approved_by_name||"—")} · ${safe(r.approved_at||"—")}</p><p class="meta">ALNAV DMS digital document · KRI Alamang-644</p></body></html>`;
};
export default function DailyWatchArchive({supabase,unitId,userId,role,viewer,title="Logbook & Handover Archive"}:Props){
 const [reports,setReports]=useState<any[]>([]),[activities,setActivities]=useState<any[]>([]),[profiles,setProfiles]=useState<Record<string,string>>({});
 const [fromDate,setFromDate]=useState(wibDate(new Date(Date.now()-30*86400000))),[toDate,setToDate]=useState(wibDate()),[year,setYear]=useState(""),[day,setDay]=useState(""),[query,setQuery]=useState(""),[statusFilter,setStatusFilter]=useState("all"),[sourceFilter,setSourceFilter]=useState("all");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[drafts,setDrafts]=useState<Record<string,string>>({}),[approvalDrafts,setApprovalDrafts]=useState<Record<string,string>>({});
 const canReview=role==="commander",canWrite=!viewer&&["admin","commander","officer","operator"].includes(role);
 const load=useCallback(async()=>{
  if(!unitId)return;
  if(fromDate&&toDate&&fromDate>toDate){setNotice("Invalid date range: the start date must be before the end date.");return}
  setBusy(true);setNotice("");
  let rq=supabase.from("daily_watch_reports").select("*").eq("unit_id",unitId).order("duty_date",{ascending:false}).limit(500);
  let aq=supabase.from("activity_logs").select("id,activity_date,activity_time,title,description,category,status,created_at").eq("unit_id",unitId).order("activity_date",{ascending:false}).order("activity_time",{ascending:true}).limit(1000);
  if(fromDate){rq=rq.gte("duty_date",fromDate);aq=aq.gte("activity_date",fromDate)}
  if(toDate){rq=rq.lte("duty_date",toDate);aq=aq.lte("activity_date",toDate)}
  const [rr,aa]=await Promise.all([rq,aq]);
  if(rr.error||aa.error){setNotice("Archive could not be loaded: "+(rr.error||aa.error)?.message);setBusy(false);return}
  const rs=(rr.data||[]) as any[],as=(aa.data||[]) as any[];
  setReports(rs);setActivities(as);
  const ids=[...new Set(rs.flatMap(x=>[x.created_by,x.approved_by]).filter(Boolean))];
  if(ids.length){const {data}=await supabase.from("profiles").select("id,full_name,rank_title").in("id",ids);const map:Record<string,string>={};(data||[]).forEach((p:any)=>map[p.id]=[p.rank_title,p.full_name].filter(Boolean).join(" "));setProfiles(map)}
  setBusy(false);
 },[supabase,unitId,fromDate,toDate]);
 useEffect(()=>{load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")load()},15000);return()=>window.clearInterval(timer)},[load]);
 const generateYesterday=async()=>{
  if(!canWrite||busy)return;
  if(Number(localClock().slice(0,2))<8){setNotice("The daily report opens after 08:00 WIB.");return}
  const yesterday=wibDate(new Date(Date.now()-86400000));
  setBusy(true);setNotice("");
  const {data:existing}=await supabase.from("daily_watch_reports").select("id").eq("unit_id",unitId).eq("duty_date",yesterday).maybeSingle();
  if(existing){setNotice("The report for "+prettyDate(yesterday)+" already exists.");await load();setBusy(false);return}
  const {data:assignment,error:ae}=await supabase.from("daily_watch_assignments").select("*").eq("unit_id",unitId).eq("duty_date",yesterday).maybeSingle();
  if(ae||!assignment){setNotice("No watch assignment found for "+prettyDate(yesterday)+". The report was not created to avoid an empty report.");setBusy(false);return}
  const [logs,runs]=await Promise.all([
   supabase.from("activity_logs").select("*").eq("unit_id",unitId).eq("activity_date",yesterday).order("activity_time"),
   supabase.from("checklist_runs").select("*").eq("unit_id",unitId).eq("duty_date",yesterday).order("performed_at")
  ]);
  if(logs.error||runs.error){setNotice("Activity/checklist data could not be collected: "+(logs.error||runs.error)?.message);setBusy(false);return}
  const runIds=(runs.data||[]).map((x:any)=>x.id);
  const [responses,items]=runIds.length?await Promise.all([
   supabase.from("checklist_responses").select("*").in("run_id",runIds),
   supabase.from("checklist_items").select("*")
  ]):[{data:[],error:null},{data:[],error:null}];
  if(responses.error||items.error){setNotice("Inspection results could not be collected.");setBusy(false);return}
  const payload={unit_id:unitId,duty_date:yesterday,assignment_id:assignment.id,created_by:userId,status:"draft",report_data:{watch_assignment:assignment,activity_logs:logs.data||[],checklist_runs:runs.data||[],checklist_responses:responses.data||[],checklist_items:items.data||[],generated_at:new Date().toISOString(),generated_by:"ALNAV DMS fallback generator"}};
  const {error}=await supabase.from("daily_watch_reports").insert(payload);
  if(error)setNotice("The report could not be saved: "+error.message);
  else setNotice("The report for "+prettyDate(yesterday)+" was created and archived.");
  await load();setBusy(false);
 };
 const saveNotes=async(r:any)=>{
  if(!canWrite||r.approved_at)return;
  const {error}=await supabase.from("daily_watch_reports").update({additional_notes:drafts[r.id]??r.additional_notes??""}).eq("id",r.id).is("approved_at",null);
  setNotice(error?"Failed to save notes: "+error.message:"Additional notes saved.");
  if(!error)await load();
 };
 const approve=async(r:any)=>{
  if(!canReview||approvalDrafts[r.id]!=="APPROVED"||r.approved_at)return;
  const {error}=await supabase.from("daily_watch_reports").update({approval_text:"APPROVED"}).eq("id",r.id).is("approved_at",null);
  setNotice(error?"Failed to save approval: "+error.message:"Report approved and locked as a permanent record.");
  if(!error)await load();
 };
 const exportWord=(r:any)=>{const blob=new Blob(["\ufeff",makeHtml({...r,approved_by_name:profiles[r.approved_by]})],{type:"application/msword"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="LOGBOOK-"+r.duty_date+".doc";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const exportPdf=(r:any)=>{const w=window.open("","_blank");if(!w){setNotice("Allow pop-ups to print the PDF.");return}w.document.open();w.document.write(makeHtml({...r,approved_by_name:profiles[r.approved_by]}));w.document.close();w.focus();window.setTimeout(()=>w.print(),350)};
 const exportCsv=()=>{const esc=(v:any)=>`"${String(v??"").replace(/"/g,'""')}"`;const rows:any[]=[["Document type","Date","Time","Title / Watch type","Description / Personnel","Status","Created by","Approved by","Approved at"]];if(sourceFilter!=="activities")reportMatches.forEach(r=>{const a=(r.report_data||{}).watch_assignment||{};rows.push(["Handover report",r.duty_date,"",a.watch_type||"",`${a.old_watch_name||""} → ${a.new_watch_name||""} ${r.additional_notes||""}`,r.status||"draft",profiles[r.created_by]||"",profiles[r.approved_by]||"",r.approved_at||""])});if(sourceFilter!=="reports")activityMatches.forEach(a=>rows.push(["Logbook",a.activity_date,a.activity_time||"",a.title,a.description,a.status,"","",""]));const csv="\ufeff"+rows.map(row=>row.map(esc).join(";")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`ARCHIVE-${fromDate||"semua"}-${toDate||"semua"}.csv`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const reportMatches=useMemo(()=>reports.filter(r=>{
  const d=r.report_data||{},a=d.watch_assignment||{},date=new Date(r.duty_date+"T00:00:00+07:00");
  const dayName=date.toLocaleDateString("en-GB",{weekday:"long",timeZone:WIB}).toLowerCase();
  const text=[r.duty_date,r.additional_notes,a.watch_type,a.old_watch_name,a.new_watch_name,a.old_watch_nrp,a.new_watch_nrp,profiles[r.created_by],profiles[r.approved_by],r.status,r.approved_at,JSON.stringify(d.activity_logs||[]),JSON.stringify(d.checklist_runs||[]),JSON.stringify(d.checklist_responses||[]),JSON.stringify(d.checklist_items||[]),JSON.stringify(d.checklists||[])].join(" ").toLowerCase();
  return (!year||r.duty_date.startsWith(year))&&(!day||dayName===day)&&(statusFilter==="all"||r.status===statusFilter)&&(!query||text.includes(query.trim().toLowerCase()));
 }),[reports,year,day,query,statusFilter,profiles]);
 const activityMatches=useMemo(()=>activities.filter(a=>(!fromDate||a.activity_date>=fromDate)&&(!toDate||a.activity_date<=toDate)&&(!year||a.activity_date.startsWith(year))&&(!day||new Date(a.activity_date+"T00:00:00+07:00").toLocaleDateString("en-GB",{weekday:"long",timeZone:WIB}).toLowerCase()===day)&&(statusFilter==="all"||a.status===statusFilter)&&(!query||[a.activity_date,a.activity_time,a.title,a.description,a.category,a.status].join(" ").toLowerCase().includes(query.trim().toLowerCase()))),[activities,fromDate,toDate,year,day,query,statusFilter]);
 return <section className="watch-archive">
  <div className="watch-archive-head">
   <div><small>ARCHIVE / DIGITAL RECORDS</small><h3>{title}</h3><p className="watch-archive-subtitle">Automatic daily report at 08:00 WIB · search across logbook, checklists and handovers</p></div>
   <div className="watch-archive-head-actions"><button onClick={exportCsv} disabled={!reportMatches.length&&!activityMatches.length}>Export results (CSV)</button><button onClick={generateYesterday} disabled={!canWrite||busy||Number(localClock().slice(0,2))<8}>{busy?"Processing...":"Create yesterday's report"}</button></div>
  </div>
  <div className="watch-archive-filters">
   <label>From date<input type="date" value={fromDate} max={toDate||undefined} onChange={e=>{setYear("");setFromDate(e.target.value)}}/></label>
   <label>To date<input type="date" value={toDate} min={fromDate||undefined} onChange={e=>{setYear("");setToDate(e.target.value)}}/></label>
   <label>Year<input inputMode="numeric" maxLength={4} placeholder="All years" value={year} onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,4);setYear(v);if(v.length===4){setFromDate(v+"-01-01");setToDate(v+"-12-31")}else if(v.length===0){setFromDate(wibDate(new Date(Date.now()-30*86400000)));setToDate(wibDate())}}}/></label>
   <label>Day<select value={day} onChange={e=>setDay(e.target.value)}><option value="">All days</option>{["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
   <label className="watch-search">Search all documents<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, NRP, activity, checklist, notes..."/></label>
   <label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft / pending</option><option value="submitted">Submitted</option><option value="verified">Verified</option><option value="approved">Approved</option></select></label>
   <label>Document type<select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option value="all">All documents</option><option value="reports">Handover reports</option><option value="activities">Activity logbook</option></select></label>
  </div>
  {notice&&<div className="watch-archive-notice">{notice}</div>}
  {sourceFilter!=="activities"&&<>
   <div className="watch-archive-section-title"><b>WATCH HANDOVER REPORTS</b><span>{reportMatches.length} DOCUMENTS</span></div>
   {busy?<div className="watch-archive-empty">Loading archive...</div>:reportMatches.length?reportMatches.map(r=>{
    const d=r.report_data||{},a=d.watch_assignment||{},logs=d.activity_logs||[],nested=d.checklists||[],runs=d.checklist_runs||nested.map((x:any)=>x.run).filter(Boolean),responses=d.checklist_responses||nested.flatMap((x:any)=>x.responses||[]).map((x:any)=>x.response).filter(Boolean);
    return <article className="watch-report" key={r.id}>
     <div className="watch-report-top"><div><small>LOGBOOK HARIAN · {r.duty_date}</small><h4>{prettyDate(r.duty_date)}</h4><span className={"watch-report-status "+(r.approved_at?"approved":"pending")}>{r.approved_at?"APPROVED BY COMMANDER · LOCKED":"NOT APPROVED · AWAITING COMMANDER"}</span></div><div className="watch-report-actions"><button onClick={()=>exportWord(r)}>Export Word</button><button onClick={()=>exportPdf(r)}>Export PDF</button></div></div>
     <div className="watch-report-grid"><div><small>WATCH TYPE</small><b>{a.watch_type||"—"}</b></div><div><small>OUTGOING OOW</small><b>{a.old_watch_rank||"—"} {a.old_watch_name||"—"}</b><span>NRP {a.old_watch_nrp||"—"}</span></div><div><small>INCOMING OOW</small><b>{a.new_watch_rank||"—"} {a.new_watch_name||"—"}</b><span>NRP {a.new_watch_nrp||"—"}</span></div><div><small>ACTIVITIES / CHECKLISTS</small><b>{logs.length} activities · {runs.length} sessions · {responses.length} results</b></div></div>
     {logs.length>0&&<div className="watch-report-logs"><b>Activity summary</b>{logs.slice(0,8).map((x:any)=><div key={x.id}><time>{String(x.activity_time||"").slice(0,5)||"—"}</time><span><strong>{x.title}</strong><small>{x.category} · {x.status}</small></span></div>)}</div>}
     <details className="watch-report-details"><summary>Open full journal and checklist details ({logs.length} activities · {runs.length} sessions)</summary>
      <div className="watch-detail-block"><b>All activities</b>{logs.length?logs.map((x:any)=><div className="watch-detail-row" key={x.id}><time>{String(x.activity_time||"").slice(0,5)||"—"}</time><span><strong>{x.title}</strong><small>{x.category} · {x.status}</small>{x.description&&<p>{x.description}</p>}</span></div>):<p>No activity records.</p>}</div>
      <div className="watch-detail-block"><b>Inspection results</b>{nested.length?nested.map((g:any,i:number)=><section key={g.run?.id||i}><strong>{g.run?.summary||g.run?.duty_role||"Checklist session "+(i+1)}</strong><small>{g.run?.performed_at?new Date(g.run.performed_at).toLocaleString("en-GB",{timeZone:WIB}):""}</small>{(g.responses||[]).map((pair:any)=><div className="watch-detail-row" key={pair.response?.id||pair.item?.id}><span>{pair.item?.item_label||"Inspection item"}</span><b>{pair.response?.result||"Not filled"}</b>{pair.response?.notes&&<small>{pair.response.notes}</small>}</div>)}</section>):responses.length?responses.map((resp:any)=>{const item=(d.checklist_items||[]).find((it:any)=>it.id===resp.checklist_item_id);return <div className="watch-detail-row" key={resp.id}><span>{item?.item_label||"Inspection item"}</span><b>{resp.result}</b>{resp.notes&&<small>{resp.notes}</small>}</div>}):<p>No checklist results.</p>}</div>
     </details>
     <div className="watch-report-history"><span>Created by: <b>{profiles[r.created_by]||"Duty officer"}</b></span>{r.approved_at&&<span>Approval: <b>{profiles[r.approved_by]||"Commander"}</b> · {new Date(r.approved_at).toLocaleString("en-GB",{timeZone:WIB})}</span>}</div>
     <label className="watch-report-notes">Officer of the watch additional notes<textarea value={drafts[r.id]??r.additional_notes??""} onChange={e=>setDrafts(v=>({...v,[r.id]:e.target.value}))} disabled={!canWrite||!!r.approved_at} placeholder="Add events, notes, or anything the Commander should know..."/></label>
     {!r.approved_at&&canWrite&&<button className="watch-save-notes" onClick={()=>saveNotes(r)}>Save additional notes</button>}
     <div className="watch-report-approval">{r.approved_at?<div><b>APPROVED</b><small>Oleh {profiles[r.approved_by]||"Commander"} · {new Date(r.approved_at).toLocaleString("en-GB",{timeZone:WIB})}</small></div>:canReview?<div><label>Type APPROVED to approve the report<input value={approvalDrafts[r.id]||""} onChange={e=>setApprovalDrafts(v=>({...v,[r.id]:e.target.value.toUpperCase()}))} placeholder="APPROVED"/></label><button disabled={approvalDrafts[r.id]!=="APPROVED"} onClick={()=>approve(r)}>Approve and lock report</button></div>:<small>Awaiting Commander review.</small>}</div>
    </article>
   }):<div className="watch-archive-empty">No reports in this date range. The scheduler creates a report once a watch assignment exists.</div>}
  </>}
  {sourceFilter!=="reports"&&<>
   <div className="watch-archive-section-title"><b>ACTIVITY LOGBOOK HISTORY</b><span>{activityMatches.length} RECORDS</span></div>
   {activityMatches.length?<div className="watch-activity-list">{activityMatches.map(a=><article key={a.id}><time>{prettyDate(a.activity_date)} · {String(a.activity_time||"").slice(0,5)||"—"}</time><div><b>{a.title}</b><small>{a.category} · {a.status}</small>{a.description&&<p>{a.description}</p>}</div></article>)}</div>:<div className="watch-archive-empty">No activities match the search filters.</div>}
  </>}
  <p className="watch-archive-foot">The automatic report is run by the database scheduler at 08:00 WIB. Commander approval is recorded with the account identity and server time. Approved reports cannot be changed.</p>
 </section>;
}
