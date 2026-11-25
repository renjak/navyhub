"use client";
import {useCallback,useEffect,useState} from "react";

type Schedule = {id:string;activity_date:string;scheduled_time:string|null;title:string;section_code:string;location_label:string|null;assigned_role:string|null;instructions:string;status:string;sequence_no:number};
type Execution = {id:string;schedule_item_id:string;executed_by:string;executed_at:string;result:string;actual_notes:string};
type Verification = {id:string;execution_id:string;decision:string;remarks:string;verified_at:string};

export default function PHSTManager({supabase,unitId,userId,canManage,canOperate,viewer}:{supabase:any;unitId:string;userId:string;canManage:boolean;canOperate:boolean;viewer:boolean}){
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"});
 const [date,setDate]=useState(today),[rows,setRows]=useState<Schedule[]>([]),[executions,setExecutions]=useState<Execution[]>([]),[verifications,setVerifications]=useState<Verification[]>([]);
 const [draft,setDraft]=useState<any>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [executionNotes,setExecutionNotes]=useState<Record<string,string>>({}),[verificationNotes,setVerificationNotes]=useState<Record<string,string>>({});
 const reload=useCallback(async()=>{
  const {data,error}=await supabase.from("phst_schedule_items").select("*").eq("unit_id",unitId).eq("activity_date",date).order("sequence_no").order("scheduled_time");
  if(error){setNotice("Jadwal PHST gagal dimuat: "+error.message);return}
  const schedules=(data||[]) as Schedule[];setRows(schedules);
  if(!schedules.length){setExecutions([]);setVerifications([]);return}
  const ids=schedules.map(x=>x.id);
  const [e,v]=await Promise.all([
   supabase.from("phst_execution_records").select("*").eq("unit_id",unitId).in("schedule_item_id",ids).order("executed_at",{ascending:false}),
   supabase.from("phst_verifications").select("*").eq("unit_id",unitId).order("verified_at",{ascending:false})
  ]);
  if(e.error)setNotice("Riwayat pelaksanaan gagal dimuat: "+e.error.message);else setExecutions((e.data||[]) as Execution[]);
  if(v.error)setNotice("Verifikasi gagal dimuat: "+v.error.message);else setVerifications((v.data||[]) as Verification[]);
 },[supabase,unitId,date]);
 useEffect(()=>{reload()},[reload]);
 const saveSchedule=async()=>{
  if(!canManage||!draft)return;
  if(String(draft.title||"").trim().length<3){setNotice("Judul kegiatan minimal 3 karakter.");return}
  setBusy(true);setNotice("");
  const {error}=await supabase.from("phst_schedule_items").insert({unit_id:unitId,created_by:userId,activity_date:date,scheduled_time:draft.scheduled_time||null,title:String(draft.title).trim(),section_code:draft.section_code||"C",location_label:draft.location_label||null,assigned_role:draft.assigned_role||null,instructions:String(draft.instructions||"").trim(),sequence_no:rows.length+1,status:"planned"});
  if(error)setNotice("Jadwal gagal disimpan: "+error.message);else{setDraft(null);setNotice("Jadwal PHST berhasil ditambahkan.");await reload()}
  setBusy(false);
 };
 const recordExecution=async(item:Schedule,result:"completed"|"not_done"|"issue",notes="")=>{
  if(!canOperate||viewer)return;
  setBusy(true);setNotice("");
  const {error}=await supabase.from("phst_execution_records").insert({unit_id:unitId,schedule_item_id:item.id,executed_by:userId,result,actual_notes:(notes||executionNotes[item.id]||"").trim()});
  if(error)setNotice("Pelaksanaan gagal dicatat: "+error.message);else{setNotice("Pelaksanaan tersimpan sebagai rekam aktual.");await reload()}
  setBusy(false);
 };
 const verify=async(execution:Execution,decision:"approved"|"rejected"|"needs_revision")=>{
  if(!canManage)return;
  setBusy(true);setNotice("");
  const {error}=await supabase.from("phst_verifications").insert({unit_id:unitId,execution_id:execution.id,verified_by:userId,decision,remarks:(verificationNotes[execution.id]||"").trim()});
  if(error)setNotice("Verifikasi gagal: "+error.message);else{setNotice("Keputusan verifikasi berhasil disimpan.");await reload()}
  setBusy(false);
 };
 const latestExecution=(id:string)=>executions.find(x=>x.schedule_item_id===id);
 const verification=(id:string)=>verifications.find(x=>x.execution_id===id);
 return <section className="phst-manager panel">
  <div className="panelhead"><div><h3>PHST · Jadwal, Pelaksanaan & Verifikasi</h3><p>Rencana harian dipisahkan dari bukti pelaksanaan aktual dan persetujuan pejabat berwenang.</p></div><span className="glass-chip">OPERATIONAL RECORD</span></div>
  <div className="phst-manager-toolbar"><label>Tanggal kegiatan<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{canManage&&!viewer&&<button type="button" onClick={()=>setDraft({title:"",scheduled_time:"07:00",section_code:"C",location_label:"",assigned_role:"",instructions:""})}>+ Tambah jadwal</button>}<button type="button" className="outline" onClick={reload} disabled={busy}>↻ Refresh</button></div>
  {draft&&<div className="phst-manager-editor"><label>Bagian PHST<select value={draft.section_code} onChange={e=>setDraft((v:any)=>({...v,section_code:e.target.value}))}>{[["A","A. SITUASI"],["B","B. TUGAS POKOK"],["C","C. UMUM"],["D","D. KHUSUS"],["F","F. LAIN-LAIN"]].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Waktu<input type="time" value={draft.scheduled_time||""} onChange={e=>setDraft((v:any)=>({...v,scheduled_time:e.target.value}))}/></label><label>Judul kegiatan<input value={draft.title} onChange={e=>setDraft((v:any)=>({...v,title:e.target.value}))} placeholder="Kegiatan sesuai PHST"/></label><label>Lokasi<input value={draft.location_label} onChange={e=>setDraft((v:any)=>({...v,location_label:e.target.value}))}/></label><label>Penanggung jawab<input value={draft.assigned_role} onChange={e=>setDraft((v:any)=>({...v,assigned_role:e.target.value}))}/></label><label className="wide">Instruksi / uraian<textarea rows={3} value={draft.instructions} onChange={e=>setDraft((v:any)=>({...v,instructions:e.target.value}))}/></label><div className="editor-actions"><button type="button" className="outline" onClick={()=>setDraft(null)}>Batal</button><button type="button" onClick={saveSchedule} disabled={busy}>{busy?"Menyimpan…":"Simpan jadwal"}</button></div></div>}
  {notice&&<div className="notice">{notice}</div>}
  {rows.length?rows.map(item=>{const ex=latestExecution(item.id),ver=ex?verification(ex.id):null;return <article className="phst-schedule-row" key={item.id}><div className="phst-schedule-time">{item.scheduled_time?.slice(0,5)||"—"}</div><div className="phst-schedule-main"><small>{item.section_code} · {item.location_label||"Lokasi belum ditentukan"} · {item.assigned_role||"Belum ditugaskan"}</small><b>{item.title}</b>{item.instructions&&<p>{item.instructions}</p>}<div className="phst-state-line"><span>JADWAL: {item.status.toUpperCase()}</span><span>{ex?"PELAKSANAAN: "+ex.result.toUpperCase():"BELUM DILAKSANAKAN"}</span><span>{ver?"VERIFIKASI: "+ver.decision.toUpperCase():"BELUM DIVERIFIKASI"}</span></div>{ex&&<div className="phst-execution-note"><small>{new Date(ex.executed_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} · {ex.actual_notes||"Tidak ada catatan tambahan"}</small></div>}</div><div className="phst-row-actions">{(!ex||ver?.decision==="needs_revision")&&canOperate&&!viewer&&<><label className="phst-inline-note">Catatan pelaksanaan<textarea rows={2} value={executionNotes[item.id]||""} onChange={e=>setExecutionNotes(v=>({...v,[item.id]:e.target.value}))} placeholder={ver?.decision==="needs_revision"?"Tindak lanjut catatan revisi":"Uraikan hasil atau temuan aktual"}/></label><button type="button" disabled={busy} onClick={()=>recordExecution(item,"completed")}>{ver?.decision==="needs_revision"?"Kirim ulang":"Selesai"}</button><button type="button" className="outline" disabled={busy} onClick={()=>recordExecution(item,"issue")}>Temuan</button><button type="button" className="outline" disabled={busy} onClick={()=>recordExecution(item,"not_done")}>Tidak terlaksana</button></>}{ex&&canManage&&!ver&&<><label className="phst-inline-note">Catatan verifikasi<textarea rows={2} value={verificationNotes[ex.id]||""} onChange={e=>setVerificationNotes(v=>({...v,[ex.id]:e.target.value}))} placeholder="Catatan pemeriksa / alasan keputusan"/></label><button type="button" disabled={busy} onClick={()=>verify(ex,"approved")}>Setujui</button><button type="button" className="outline" disabled={busy} onClick={()=>verify(ex,"needs_revision")}>Revisi</button><button type="button" className="outline" disabled={busy} onClick={()=>verify(ex,"rejected")}>Tolak</button></>}</div></article>}) : <div className="empty">Belum ada jadwal PHST pada tanggal ini. Tidak ada kegiatan contoh yang dibuat otomatis.</div>}
 </section>
}
