"use client";
import {en,enText} from "./displayEn";
import {useCallback,useEffect,useState} from "react";

type DailyOrder={id:string;activity_date:string;duty_officer:string;duty_officer_nrp:string|null;duty_division:string|null;duty_nco:string|null;duty_messenger:string|null;duty_attire:string|null;situation:string|null;readiness_level:string|null;main_task:string|null;source_file:string};
type CheckItem={id:string;sequence_no:number;scheduled_time:string|null;activity_text:string;result:string;execution_notes:string;checked_at:string|null};
export default function PHSTLogbook({supabase,unitId,userId,canOperate,canManage,viewer,onChange}:{supabase:any;unitId:string;userId:string;canOperate:boolean;canManage:boolean;viewer:boolean;onChange?:()=>void}){
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"});
 const [date,setDate]=useState(today),[order,setOrder]=useState<DailyOrder|null>(null),[items,setItems]=useState<CheckItem[]>([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState(""),[notes,setNotes]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{
  if(!unitId)return;setLoading(true);setNotice("");
  const {data,error}=await supabase.from("phst_daily_orders").select("*").eq("unit_id",unitId).eq("activity_date",date).maybeSingle();
  if(error){setNotice("Failed to load PHST data: "+error.message);setOrder(null);setItems([]);setLoading(false);return}
  setOrder(data as DailyOrder|null);
  if(data){const r=await supabase.from("phst_checklist_items").select("*").eq("unit_id",unitId).eq("daily_order_id",data.id).order("sequence_no");if(r.error)setNotice("Failed to load checklist: "+r.error.message);setItems((r.data||[]) as CheckItem[])}
  else setItems([]);
  setLoading(false);
 },[supabase,unitId,date]);
 useEffect(()=>{load()},[load]);
 const mark=async(item:CheckItem,result:"completed"|"issue"|"not_done")=>{
  if(!canOperate||viewer)return;setNotice("");
  const {error}=await supabase.from("phst_checklist_items").update({result,checked_by:userId,checked_at:new Date().toISOString(),execution_notes:(notes[item.id]||item.execution_notes||"").trim()}).eq("id",item.id).eq("unit_id",unitId);
  if(error)setNotice("Failed to save checklist: "+error.message);else{setNotice("Activity status saved.");await load();onChange?.()}
 };
 const fmtDate=(v:string)=>new Date(v+"T00:00:00+07:00").toLocaleDateString("en-GB",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
 const done=items.filter(x=>x.result==="completed").length,issues=items.filter(x=>x.result==="issue").length,notDone=items.filter(x=>x.result==="not_done").length;
 const canEdit=canOperate&&!viewer;
 const label=(r:string)=>r==="completed"?"Done":r==="issue"?"Finding":r==="not_done"?"Not done":"Awaiting check";
 const tone=(r:string)=>r==="completed"?"ok":r==="issue"?"warn":r==="not_done"?"bad":"none";
 const pctDone=items.length?Math.round(done/items.length*100):0;
 return <section className="dg-glass dg-card dg-phst">
  <div className="dg-card-head">
   <div><div className="dg-eyebrow">Standing daily orders (PHST)</div><h2 className="dg-h dg-card-title">Daily PHST & officer of the watch checklist</h2><div className="dg-sub">Schedule from the uploaded PHST document; execution status is filled in by the duty officer.</div></div>
   <div className="dg-phst-tools"><label className="dg-field-inline"><span>Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" className="dg-btn" onClick={load} disabled={loading}>Reload</button></div>
  </div>
  {notice&&<p className="dg-note dg-notice" role="status">{notice}</p>}
  {loading?<p className="dg-note">Loading PHST…</p>:!order?<div className="dg-empty"><b>No PHST for {fmtDate(date)}.</b><span>Upload the PHST document in the Agenda tab; data comes from the official source, nothing is invented.</span></div>:<>
   <div className="dg-phst-meta">
    <div className="dg-well dg-span2-md"><span>Officer of the watch</span><b>{order.duty_officer||"—"}</b><small>NRP {order.duty_officer_nrp||"not listed"}</small></div>
    <div className="dg-well"><span>Watch division</span><b>{order.duty_division||"—"}</b><small>Uniform {order.duty_attire||"—"}</small></div>
    <div className="dg-well"><span>Duty NCO</span><b>{order.duty_nco||"—"}</b></div>
    <div className="dg-well"><span>Messenger</span><b>{order.duty_messenger||"—"}</b></div>
   </div>
   <div className="dg-grid2 dg-phst-context">
    <div className="dg-well"><span>A. Situation</span><b>{order.situation||"—"}</b><small>Readiness: {en(order.readiness_level)||"—"}</small></div>
    <div className="dg-well"><span>B. Main task</span><b>{order.main_task||"—"}</b></div>
   </div>
   <div className="dg-phst-checkhead">
    <div><div className="dg-eyebrow">Section C · General</div><h3 className="dg-h">Officer of the watch checklist</h3></div>
    <div className="dg-phst-progress"><b className="dg-h">{done}/{items.length}</b><span>done · {issues} findings · {notDone} not done</span><i><em style={{width:pctDone+"%"}}/></i></div>
   </div>
   {items.length?<ol className="dg-checklist">{items.map(item=><li key={item.id} className={"dg-check is-"+tone(item.result)}>
    <time>{item.scheduled_time?.slice(0,5)||"—"}</time>
    <div className="dg-check-body">
     <b>{item.activity_text}</b>
     <small><i className={"dg-dot dg-dot-"+tone(item.result)}/>{label(item.result)}{item.checked_at?" · "+new Date(item.checked_at).toLocaleString("en-GB",{timeZone:"Asia/Jakarta",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+" WIB":""}</small>
     {(canEdit||item.execution_notes)&&<textarea rows={1} disabled={!canEdit} aria-label={"Notes for "+item.activity_text} value={notes[item.id]??item.execution_notes??""} onChange={e=>setNotes(v=>({...v,[item.id]:e.target.value}))} placeholder="Officer of the watch notes / inspection result"/>}
    </div>
    {canEdit&&<div className="dg-check-actions" role="group" aria-label="Execution status">
     <button type="button" aria-pressed={item.result==="completed"} className="is-ok" onClick={()=>mark(item,"completed")}>Done</button>
     <button type="button" aria-pressed={item.result==="issue"} className="is-warn" onClick={()=>mark(item,"issue")}>Finding</button>
     <button type="button" aria-pressed={item.result==="not_done"} className="is-bad" onClick={()=>mark(item,"not_done")}>Not done</button>
    </div>}
   </li>)}</ol>:<p className="dg-note">This PHST has no Section C schedule.</p>}
   <p className="dg-note">Source: {order.source_file||"—"}. The checklist uses Section C — General only; Section D — Special and F — Other are not included.</p>
  </>}
 </section>
}
