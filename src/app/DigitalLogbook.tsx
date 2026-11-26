"use client";
import {en,enText} from "./displayEn";
import {useCallback,useEffect,useMemo,useState} from "react";

type Role="Perwira Jaga"|"KKM"|"Komandan";
type Checklist={id:string;title:string;description:string|null;category:string;assigned_role:Role;scheduled_time:string;location_label:string;instructions:string;animation_key:string;sequence_no:number};
type Item={id:string;checklist_id:string;item_order:number;item_label:string;is_required:boolean};
type Run={id:string;checklist_id:string;duty_date:string;duty_role:Role;performed_by:string;performed_at:string;completed_at:string|null};
type Response={id:string;run_id:string;checklist_item_id:string;result:"pass"|"fail"|"not_applicable";notes:string|null;created_at:string};
const ROLES:Role[]=["Perwira Jaga"];
const WIB="Asia/Jakarta";
const localDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:WIB,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const localTime=()=>new Intl.DateTimeFormat("en-GB",{timeZone:WIB,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
const fmtDate=(d:string)=>new Date(d+"T00:00:00+07:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:WIB});
const hh=(t:string)=>String(t||"").slice(0,5);
const pct=(n:number,d:number)=>d?Math.round(n/d*100):0;
const roleLabel=(r:any)=>r==="Perwira Jaga"?"Officer of the watch":r==="Komandan"?"Commander":r||"—";
const watchLabel=(w:any)=>w?en(w):"Watch";
const ZONE:any={jaga:"Geladak Kerja",mesin:"Kamar Mesin",bekal:"Geladak Kerja · Gudang Logistik",masak:"Dapur & Gudang",elektronik:"Anjungan / Navigasi",bilga:"Kamar Mesin",opname:"Gudang Logistik",rekap:"Anjungan / Ruang Komando"};
export default function DigitalLogbook({supabase,unitId,userId,viewer,onChange}:{supabase:any;unitId:string;userId:string;viewer:boolean;onChange?:()=>void}){
 const [clock,setClock]=useState(localTime()),[today,setToday]=useState(localDate()),[checklists,setChecklists]=useState<Checklist[]>([]),[items,setItems]=useState<Item[]>([]),[runs,setRuns]=useState<Run[]>([]),[responses,setResponses]=useState<Response[]>([]),[assignment,setAssignment]=useState<any>(null),[personnel,setPersonnel]=useState<any[]>([]),[watchType,setWatchType]=useState("Jaga Laut"),[oldWatchId,setOldWatchId]=useState(""),[newWatchId,setNewWatchId]=useState(""),[handoverNotes,setHandoverNotes]=useState(""),[role,setRole]=useState<Role|null>(null),[active,setActive]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[tab,setTab]=useState<"ceklist"|"riwayat"|"pengawasan">("ceklist"),[failItem,setFailItem]=useState<string|null>(null),[failNote,setFailNote]=useState(""),[dailyReport,setDailyReport]=useState<any>(null),[approvalError,setApprovalError]=useState("");
 const nowMin=Number(clock.slice(0,2))*60+Number(clock.slice(3,5));
 const handover=checklists.find(c=>c.sequence_no===1);
 const handoverRun=handover?runs.find(r=>r.checklist_id===handover.id&&r.duty_date===today&&r.duty_role==="Perwira Jaga"):undefined;
 const handoverItems=handover?items.filter(i=>i.checklist_id===handover.id):[];
 const handoverDone=handoverItems.length>0&&handoverItems.every(i=>responses.some(r=>r.run_id===handoverRun?.id&&r.checklist_item_id===i.id&&r.result==="pass"));
 const roleReady=!!assignment&&assignment.duty_role==="Perwira Jaga";
 const visible=useMemo(()=>checklists.filter(c=>c.assigned_role===role&&c.sequence_no!==1).sort((a,b)=>a.sequence_no-b.sequence_no),[checklists,role]);
 const allItems=useMemo(()=>items.filter(i=>visible.some(c=>c.id===i.checklist_id)),[items,visible]);
 const completed=useMemo(()=>allItems.filter(i=>responses.some(r=>r.checklist_item_id===i.id&&r.result==="pass"&&runs.some(run=>run.id===r.run_id&&run.duty_date===today&&run.duty_role===role))).length,[allItems,responses,runs,today,role]);
 const openFindings=useMemo(()=>responses.filter(r=>r.result==="fail"&&runs.some(run=>run.id===r.run_id&&run.duty_date===today)),[responses,runs,today]);
 const reload=useCallback(async()=>{
  if(!unitId)return;
  setLoading(true);
  const [c,i,a,r,p]=await Promise.all([
   supabase.from("checklists").select("id,title,description,category,assigned_role,scheduled_time,location_label,instructions,animation_key,sequence_no").eq("unit_id",unitId).eq("is_active",true).order("sequence_no"),
   supabase.from("checklist_items").select("id,checklist_id,item_order,item_label,is_required").order("item_order"),
   supabase.from("daily_watch_assignments").select("*").eq("unit_id",unitId).eq("duty_date",today).maybeSingle(),
   supabase.from("checklist_runs").select("id,checklist_id,duty_date,duty_role,performed_by,performed_at,completed_at").eq("unit_id",unitId).eq("duty_date",today),
   supabase.from("personnel").select("id,full_name,rank_title,nrp,position").eq("unit_id",unitId).order("sequence_no",{ascending:true})
  ]);
  if(c.error||i.error||a.error||r.error||p.error){setNotice("Checklist/personnel data could not be loaded: "+(c.error||i.error||a.error||r.error||p.error)?.message);setLoading(false);return}
  const cs=(c.data||[]) as Checklist[],its=(i.data||[]) as Item[],rs=(r.data||[]) as Run[];
  setChecklists(cs);setItems(its);setAssignment(a.data||null);setRole((a.data?.duty_role==="Perwira Jaga"?"Perwira Jaga":null));setPersonnel((p.data||[]) as any[]);setWatchType(a.data?.watch_type||"Jaga Laut");setOldWatchId(a.data?.old_watch_personnel_id||"");setNewWatchId(a.data?.new_watch_personnel_id||"");setHandoverNotes(a.data?.handover_notes||"");setRuns(rs);
  if(rs.length){const ids=rs.map(x=>x.id);const {data:resp,error}=await supabase.from("checklist_responses").select("id,run_id,checklist_item_id,result,notes,created_at").in("run_id",ids);if(error)setNotice("Checklist history could not be loaded: "+error.message);else setResponses((resp||[]) as Response[])}else setResponses([]);
  setLoading(false);
 },[supabase,unitId,today]);
 useEffect(()=>{reload()},[reload]);
 useEffect(()=>{if(!unitId)return;let alive=true;const checkApproval=async()=>{const {data,error}=await supabase.from("daily_watch_reports").select("id,duty_date,approval_text,approved_at,approved_by").eq("unit_id",unitId).eq("duty_date",today).maybeSingle();if(!alive)return;if(error){setApprovalError(error.message);return}setApprovalError("");setDailyReport(data||null)};checkApproval();const timer=window.setInterval(checkApproval,15000);return()=>{alive=false;window.clearInterval(timer)}},[supabase,unitId,today]);
 useEffect(()=>{const t=window.setInterval(()=>{const d=localDate();setClock(localTime());if(d!==today)setToday(d)},15000);return()=>window.clearInterval(t)},[today]);
 const ensureRun=async(c:Checklist,runRole:Role):Promise<Run|null>=>{
  let found=runs.find(r=>r.checklist_id===c.id&&r.duty_date===today&&r.duty_role===runRole);if(found)return found;
  const {data,error}=await supabase.from("checklist_runs").insert({unit_id:unitId,checklist_id:c.id,performed_by:userId,duty_date:today,duty_role:runRole,summary:"LOGBOOK daily check"}).select("id,checklist_id,duty_date,duty_role,performed_by,performed_at,completed_at").single();
  if(error){const {data:existing}=await supabase.from("checklist_runs").select("id,checklist_id,duty_date,duty_role,performed_by,performed_at,completed_at").eq("unit_id",unitId).eq("checklist_id",c.id).eq("duty_date",today).eq("duty_role",runRole).maybeSingle();if(existing){setRuns(old=>old.some(x=>x.id===existing.id)?old:[...old,existing as Run]);return existing as Run}setNotice("Could not start checklist: "+error.message);return null}
  const next=data as Run;setRuns(old=>[...old,next]);return next;
 };
 const finishIfComplete=async(run:Run,c:Checklist,nextResponses:Response[])=>{
  const required=items.filter(i=>i.checklist_id===c.id&&i.is_required);
  const done=required.every(i=>nextResponses.some(x=>x.run_id===run.id&&x.checklist_item_id===i.id&&(x.result==="pass"||x.result==="not_applicable")));
  if(done&&!run.completed_at){const {error}=await supabase.from("checklist_runs").update({completed_at:new Date().toISOString(),summary:"All required items have been checked."}).eq("id",run.id);if(!error)setRuns(old=>old.map(x=>x.id===run.id?{...x,completed_at:new Date().toISOString()}:x))}
 };
 const mark=async(c:Checklist,item:Item,result:"pass"|"fail")=>{
  if(viewer||busy)return;
  if(c.sequence_no!==1&&!roleReady){setNotice("Assign the duty officer at 07:45 first.");return}
  setBusy(true);setActive(c.id);setNotice("");
  const run=await ensureRun(c,c.sequence_no===1?"Perwira Jaga":role!);if(!run){setBusy(false);return}
  const existing=responses.find(x=>x.run_id===run.id&&x.checklist_item_id===item.id);
  if(existing){setNotice("This item already has an inspection record.");setBusy(false);return}
  const {data,error}=await supabase.from("checklist_responses").insert({run_id:run.id,checklist_item_id:item.id,result,notes:result==="fail"?failNote.trim()||"Finding requires follow-up.":null}).select("id,run_id,checklist_item_id,result,notes,created_at").single();
  if(error){setNotice("Failed to save inspection result: "+error.message);setBusy(false);return}
  const next=[...responses,data as Response];setResponses(next);await finishIfComplete(run,c,next);
  setFailItem(null);setFailNote("");setNotice(result==="pass"?"Inspection recorded.":"Finding recorded and added to supervision.");onChange?.();
  setBusy(false);
 };
 const saveWatchAssignment=async()=>{
  if(viewer||busy||!handoverDone||nowMin<465)return;
  const oldPerson=personnel.find(p=>p.id===oldWatchId),newPerson=personnel.find(p=>p.id===newWatchId);
  if(!oldPerson||!newPerson){setNotice("Select the outgoing and incoming officers of the watch from the personnel list.");return}
  if(oldPerson.id===newPerson.id){setNotice("Outgoing and incoming officers of the watch must be different people.");return}
  if(!oldPerson.rank_title||!oldPerson.nrp||!newPerson.rank_title||!newPerson.nrp){setNotice("Complete the rank and NRP of both officers in PERSONNEL before assigning the watch.");return}
  setBusy(true);setNotice("");
  const payload={unit_id:unitId,duty_date:today,duty_role:"Perwira Jaga",selected_by:userId,watch_type:watchType,old_watch_personnel_id:oldPerson.id,new_watch_personnel_id:newPerson.id,old_watch_name:oldPerson.full_name,old_watch_rank:oldPerson.rank_title,old_watch_nrp:oldPerson.nrp,new_watch_name:newPerson.full_name,new_watch_rank:newPerson.rank_title,new_watch_nrp:newPerson.nrp,handover_notes:handoverNotes.trim()};
  const {data,error}=await supabase.from("daily_watch_assignments").insert(payload).select("*").single();
  if(error){const {data:existing}=await supabase.from("daily_watch_assignments").select("*").eq("unit_id",unitId).eq("duty_date",today).maybeSingle();if(existing){setAssignment(existing);setRole("Perwira Jaga");setNotice("Today's watch assignment was already saved.")}else setNotice("Watch assignment failed: "+error.message)}
  else{setAssignment(data);setRole("Perwira Jaga");setNotice(watchLabel(watchType)+" handover saved. The officer of the watch checklist is now open.");onChange?.()}
  setBusy(false);
 };
 const runFor=(c:Checklist)=>runs.find(r=>r.checklist_id===c.id&&r.duty_date===today&&r.duty_role===role);
 const itemState=(c:Checklist,i:Item)=>{const run=runFor(c);return responses.find(r=>r.run_id===run?.id&&r.checklist_item_id===i.id)};
 const completedChecks=responses.filter(r=>r.result==="pass"&&runs.some(run=>run.duty_date===today&&run.id===r.run_id)).length;
 const totalChecks=handoverItems.length+allItems.length;
 const selectedLabel=role?roleLabel(role):"Not assigned";
 const current=visible.find(c=>c.id===active)||visible.find(c=>c.scheduled_time<=clock+":00"&&!runFor(c)?.completed_at)||visible[0];
 return <section className="dl-shell">
  <header className="dl-head"><div><span className="dl-kicker">Digital Logbook</span><h2>Today's watch</h2><p>Watch handover, officer of the watch assignment and daily checklist. Every button saves to the database.</p></div><div className="dl-clock"><b>{clock}</b><small>SHIP TIME · WIB</small><small>{fmtDate(today)}</small></div></header>
  <div className={"dl-approval-banner "+(approvalError?"unverified":dailyReport?.approved_at||dailyReport?.approval_text==="APPROVED"?"approved":"pending")}><div><small>TODAY'S LOGBOOK JOURNAL</small><b>{fmtDate(today)}</b></div><strong>{approvalError?"STATUS CANNOT BE VERIFIED":dailyReport?.approved_at||dailyReport?.approval_text==="APPROVED"?"✓ APPROVED BY COMMANDER":"◷ AWAITING COMMANDER APPROVAL"}</strong></div>
  <div className="dl-narrative"><b>{en(current?.title)||"Daily ship inspection"}</b><p>{en(current?.instructions)||"Assign the duty officer after the watch handover to open the inspection list for that role."}</p><small>LOCATION: {en(current?.location_label)||"Whole ship"} · TIME: {current?hh(current.scheduled_time):"07:45"}</small></div>
  <div className="dl-gate">
   <div className="dl-gate-step"><span>07:30</span><div><b>Watch handover</b><small>Confirm checks of mooring lines, gangway, weather and notable events.</small></div><strong>{handoverDone?"DONE":handoverRun?"IN PROGRESS":"PENDING"}</strong></div>
   {handover&&<div className="dl-handover-items">{handoverItems.map(i=>{const res=responses.find(r=>r.run_id===handoverRun?.id&&r.checklist_item_id===i.id);return <div className="dl-checkrow" key={i.id}><span>{en(i.item_label)}</span><button disabled={viewer||busy||!!res} onClick={()=>mark(handover,i,"pass")}>{res?"✓ Done":"Mark done"}</button></div>})}</div>}
   <div className="dl-gate-step role-gate"><span>07:45</span><div><b>Assign today's duty officer</b><small>Select the officer on duty before the daily checklist opens.</small></div><strong>{roleReady?roleLabel(assignment.duty_role):"SELECT OFFICER"}</strong></div>
   {!roleReady?<div className="dl-role-select dl-watch-form">
    <label>Watch type<select value={watchType} onChange={e=>setWatchType(e.target.value)} disabled={viewer||busy}><option value="Jaga Laut">Sea watch</option><option value="Jaga Darat">Harbour watch</option></select></label>
    <label>Outgoing officer of the watch<select value={oldWatchId} onChange={e=>setOldWatchId(e.target.value)} disabled={viewer||busy}><option value="">Select outgoing officer</option>{personnel.map(p=><option key={p.id} value={p.id}>{p.rank_title||"No rank"} · {p.full_name} · NRP {p.nrp||"—"}</option>)}</select></label>
    <label>Incoming officer of the watch<select value={newWatchId} onChange={e=>setNewWatchId(e.target.value)} disabled={viewer||busy}><option value="">Select incoming officer</option>{personnel.map(p=><option key={p.id} value={p.id}>{p.rank_title||"No rank"} · {p.full_name} · NRP {p.nrp||"—"}</option>)}</select></label>
    <label>Handover notes<textarea value={handoverNotes} onChange={e=>setHandoverNotes(e.target.value)} placeholder="Conditions, notable events, or items to pass on..." disabled={viewer||busy}/></label>
    <button className="dl-watch-save" disabled={viewer||busy||!handoverDone||nowMin<465||!oldWatchId||!newWatchId||oldWatchId===newWatchId} onClick={saveWatchAssignment}>{busy?"Saving...":"Save watch assignment"}</button>
    {!handoverDone?<small>Complete the watch handover first.</small>:nowMin<465?<small>Officer selection opens at 07:45 WIB.</small>:personnel.length===0?<small>The PERSONNEL list is not available yet.</small>:null}
   </div>:<div className="dl-assigned"><b>{watchLabel(assignment.watch_type)} · Officer of the watch</b><small>Outgoing: {assignment.old_watch_rank||"—"} {assignment.old_watch_name||"—"} · NRP {assignment.old_watch_nrp||"—"}</small><small>Incoming: {assignment.new_watch_rank||"—"} {assignment.new_watch_name||"—"} · NRP {assignment.new_watch_nrp||"—"}</small>{assignment.handover_notes&&<small>Notes: {assignment.handover_notes}</small>}<small>Assignment saved for {fmtDate(today)}. The officer of the watch checklist is open.</small></div>}
  </div>
  <div className="dl-summary"><div><b>{checklists.length}</b><small>Checklist agendas</small></div><div><b>{completedChecks}</b><small>Items done</small></div><div><b>{openFindings.length}</b><small>Findings</small></div><div><b>{pct(completedChecks,totalChecks)}%</b><small>Today's progress</small></div></div>
  <div className="dl-tabs"><button className={tab==="ceklist"?"on":""} onClick={()=>setTab("ceklist")}>Daily checklist</button><button className={tab==="riwayat"?"on":""} onClick={()=>setTab("riwayat")}>History</button><button className={tab==="pengawasan"?"on":""} onClick={()=>setTab("pengawasan")}>Supervision</button></div>
  {loading?<div className="dl-empty">Loading checklist...</div>:tab==="ceklist"?<div className="dl-panel">
   {!roleReady?<p className="dl-empty">The daily checklist appears after the watch handover is confirmed and the 07:45 duty officer is assigned.</p>:visible.length?visible.map(c=>{const its=items.filter(i=>i.checklist_id===c.id),run=runFor(c),done=its.filter(i=>itemState(c,i)?.result==="pass").length,failed=its.filter(i=>itemState(c,i)?.result==="fail").length,finished=its.length>0&&done+failed===its.length;return <article className={"dl-task "+(active===c.id?"active":"")} key={c.id}><button className="dl-task-head" onClick={()=>setActive(active===c.id?null:c.id)}><span className="dl-task-time">{hh(c.scheduled_time)}</span><span className="dl-task-main"><b>{en(c.title)}</b><small>{en(c.location_label)} · {c.assigned_role}</small><i><em style={{width:pct(done+failed,its.length)+"%"}}/></i></span><span className={"dl-status "+(finished?"done":run?"progress":"wait")}>{finished?"Done":run?"In progress":"Pending"}</span></button>{active===c.id&&<div className="dl-task-body"><p>{en(c.instructions)}</p>{its.map(i=>{const state=itemState(c,i);return <div className="dl-checkrow" key={i.id}><span>{en(i.item_label)}</span>{state?<strong className={state.result==="pass"?"ok":"bad"}>{state.result==="pass"?"✓ Done":"⚠ Finding"}</strong>:<div className="dl-check-actions"><button disabled={viewer||busy} onClick={()=>mark(c,i,"pass")}>✓ Done</button><button className="finding" disabled={viewer||busy} onClick={()=>{setFailItem(i.id);setFailNote("");}}>Finding</button></div>}{failItem===i.id&&<div className="dl-failbox"><textarea value={failNote} onChange={e=>setFailNote(e.target.value)} placeholder="Describe the actual finding..."/><button disabled={busy||viewer} onClick={()=>mark(c,i,"fail")}>Save finding</button><button onClick={()=>setFailItem(null)}>Cancel</button></div>}</div>})}<small>Executions are recorded with the signed-in account and server time.</small></div>}</article>}):<p className="dl-empty">No checklists for this role.</p>}
  </div>:tab==="riwayat"?<div className="dl-panel">{responses.filter(r=>runs.some(run=>run.id===r.run_id&&run.duty_date===today)).slice().reverse().map(r=>{const item=items.find(i=>i.id===r.checklist_item_id),c=checklists.find(x=>x.id===item?.checklist_id),run=runs.find(x=>x.id===r.run_id);return <article className="dl-history" key={r.id}><time>{new Date(r.created_at).toLocaleTimeString("en-GB",{timeZone:WIB,hour:"2-digit",minute:"2-digit"})}</time><div><b>{en(item?.item_label)}</b><small>{en(c?.title)} · {roleLabel(run?.duty_role)}</small></div><strong className={r.result==="pass"?"ok":"bad"}>{r.result==="pass"?"Done":"Finding"}</strong></article>})}{!responses.length&&<p className="dl-empty">No checks completed today yet.</p>}</div>:<div className="dl-panel"><h3>Daily supervision</h3><p>Duty officer: <b>{selectedLabel}</b></p><p>Items done: <b>{completedChecks}</b> of {allItems.length}</p><p>Findings recorded: <b>{openFindings.length}</b></p>{openFindings.map(r=><p key={r.id} className="dl-finding">⚠ {items.find(i=>i.id===r.checklist_item_id)?.item_label}: {enText(r.notes)||"Finding requires follow-up."}</p>)}<p>A checklist is marked complete automatically once every required item has a result.</p></div>}
  {notice&&<div className="dl-notice">{notice}</div>}
  <div className="dl-footnote">LOGBOOK operating mode: no simulated journal or manual notes. Every execution button saves the checklist result to the ALNAV DMS database. Inspection results and technical figures must reflect the ship's actual condition.</div>
 </section>;
}
