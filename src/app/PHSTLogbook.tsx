"use client";
import {useCallback,useEffect,useState} from "react";

type DailyOrder={id:string;activity_date:string;duty_officer:string;duty_officer_nrp:string|null;duty_division:string|null;duty_nco:string|null;duty_messenger:string|null;duty_attire:string|null;situation:string|null;readiness_level:string|null;main_task:string|null;source_file:string};
type CheckItem={id:string;sequence_no:number;scheduled_time:string|null;activity_text:string;result:string;execution_notes:string;checked_at:string|null};
export default function PHSTLogbook({supabase,unitId,userId,canOperate,canManage,viewer}:{supabase:any;unitId:string;userId:string;canOperate:boolean;canManage:boolean;viewer:boolean}){
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"});
 const [date,setDate]=useState(today),[order,setOrder]=useState<DailyOrder|null>(null),[items,setItems]=useState<CheckItem[]>([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState(""),[notes,setNotes]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{
  if(!unitId)return;setLoading(true);setNotice("");
  const {data,error}=await supabase.from("phst_daily_orders").select("*").eq("unit_id",unitId).eq("activity_date",date).maybeSingle();
  if(error){setNotice("Data PHST gagal dimuat: "+error.message);setOrder(null);setItems([]);setLoading(false);return}
  setOrder(data as DailyOrder|null);
  if(data){const r=await supabase.from("phst_checklist_items").select("*").eq("unit_id",unitId).eq("daily_order_id",data.id).order("sequence_no");if(r.error)setNotice("Checklist gagal dimuat: "+r.error.message);setItems((r.data||[]) as CheckItem[])}
  else setItems([]);
  setLoading(false);
 },[supabase,unitId,date]);
 useEffect(()=>{load()},[load]);
 const mark=async(item:CheckItem,result:"completed"|"issue"|"not_done")=>{
  if(!canOperate||viewer)return;setNotice("");
  const {error}=await supabase.from("phst_checklist_items").update({result,checked_by:userId,checked_at:new Date().toISOString(),execution_notes:(notes[item.id]||item.execution_notes||"").trim()}).eq("id",item.id).eq("unit_id",unitId);
  if(error)setNotice("Checklist gagal disimpan: "+error.message);else{setNotice("Status kegiatan tersimpan.");await load()}
 };
 const fmtDate=(v:string)=>new Date(v+"T00:00:00+07:00").toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
 const done=items.filter(x=>x.result==="completed").length,issues=items.filter(x=>x.result==="issue").length,notDone=items.filter(x=>x.result==="not_done").length;
 return <section className="panel phst-logbook">
  <div className="panelhead"><div><h3>PERINTAH HARIAN SIFAT TETAP · LOGBOOK</h3><p>Dokumen PHST sebagai sumber jadwal jaga dan checklist Perwira Jaga</p></div><span className="glass-chip">PHST SOURCE RECORD</span></div>
  <div className="phst-log-toolbar"><label>Tanggal PHST<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" className="outline" onClick={load} disabled={loading}>↻ Muat ulang</button></div>
  {notice&&<div className="notice">{notice}</div>}
  {loading?<div className="empty">Memuat PHST…</div>:!order?<div className="empty">Belum ada PHST untuk tanggal ini. Unggah dokumen PHST untuk mengisi data berdasarkan sumber resmi.</div>:<>
   <div className="phst-duty-card"><div className="phst-duty-title"><div><small>{fmtDate(order.activity_date)} · KRI ALAMANG-644</small><h4>PERSONEL & SITUASI JAGA</h4></div><span>SUMBER: {order.source_file}</span></div>
    <div className="phst-duty-grid"><article><small>PERWIRA JAGA</small><b>{order.duty_officer}</b><span>NRP: {order.duty_officer_nrp||"Tidak tercantum"}</span></article><article><small>DIVISI JAGA</small><b>{order.duty_division||"—"}</b><span>Tenue: {order.duty_attire||"—"}</span></article><article><small>BINTARA JAGA</small><b>{order.duty_nco||"—"}</b></article><article><small>CARAKA</small><b>{order.duty_messenger||"—"}</b></article></div>
    <div className="phst-duty-context"><div><small>A. SITUASI</small><b>{order.situation||"—"}</b><span>Kesiagaan: {order.readiness_level||"—"}</span></div><div><small>B. TUGAS POKOK</small><b>{order.main_task||"—"}</b></div></div>
   </div>
   <div className="phst-check-head"><div><small>BAGIAN C · UMUM</small><h4>CHECKLIST PERWIRA JAGA</h4><p>Waktu dan uraian kegiatan mengikuti isi PHST yang diunggah.</p></div><div className="phst-check-stats"><b>{done}/{items.length}</b><span>TERLAKSANA</span><span>{issues} TEMUAN · {notDone} TIDAK TERLAKSANA</span></div></div>
   <div className="phst-check-list">{items.map((item,i)=><article className={"phst-check-item "+item.result} key={item.id}><div className="phst-check-time">{item.scheduled_time?.slice(0,5)||"—"}</div><div className="phst-check-body"><b>{item.activity_text}</b><small>{item.result==="completed"?"TERLAKSANA":item.result==="issue"?"ADA TEMUAN":item.result==="not_done"?"TIDAK TERLAKSANA":"MENUNGGU PEMERIKSAAN"}{item.checked_at?" · "+new Date(item.checked_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"}):""}</small><textarea rows={2} disabled={!canOperate||viewer} value={notes[item.id]??item.execution_notes??""} onChange={e=>setNotes(v=>({...v,[item.id]:e.target.value}))} placeholder="Catatan Perwira Jaga / hasil pemeriksaan"/></div><div className="phst-check-actions"><button type="button" disabled={!canOperate||viewer} onClick={()=>mark(item,"completed")}>Terlaksana</button><button type="button" className="outline" disabled={!canOperate||viewer} onClick={()=>mark(item,"issue")}>Temuan</button><button type="button" className="outline" disabled={!canOperate||viewer} onClick={()=>mark(item,"not_done")}>Tidak</button></div></article>)}</div>
   <div className="phst-log-foot">Acuan checklist: Bagian C — UMUM. Bagian D — KHUSUS dan F — LAIN-LAIN tidak dimasukkan ke checklist ini. Data jadwal berasal dari dokumen; status pelaksanaan diisi oleh petugas.</div>
  </>}
 </section>
}
