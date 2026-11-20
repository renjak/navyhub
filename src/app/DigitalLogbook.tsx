"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type Role="Perwira Jaga"|"KKM"|"Komandan";
type Checklist={id:string;title:string;description:string|null;category:string;assigned_role:Role;scheduled_time:string;location_label:string;instructions:string;animation_key:string;sequence_no:number};
type Item={id:string;checklist_id:string;item_order:number;item_label:string;is_required:boolean};
type Run={id:string;checklist_id:string;duty_date:string;duty_role:Role;performed_by:string;performed_at:string;completed_at:string|null};
type Response={id:string;run_id:string;checklist_item_id:string;result:"pass"|"fail"|"not_applicable";notes:string|null;created_at:string};
const ROLES:Role[]=["Perwira Jaga","KKM","Komandan"];
const WIB="Asia/Jakarta";
const localDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:WIB,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const localTime=()=>new Intl.DateTimeFormat("en-GB",{timeZone:WIB,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
const fmtDate=(d:string)=>new Date(d+"T00:00:00+07:00").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:WIB});
const hh=(t:string)=>String(t||"").slice(0,5);
const pct=(n:number,d:number)=>d?Math.round(n/d*100):0;
const ZONE:any={jaga:"Geladak Kerja",mesin:"Kamar Mesin",bekal:"Geladak Kerja · Gudang Logistik",masak:"Dapur & Gudang",elektronik:"Anjungan / Navigasi",bilga:"Kamar Mesin",opname:"Gudang Logistik",rekap:"Anjungan / Ruang Komando"};
export default function DigitalLogbook({supabase,unitId,userId,viewer}:{supabase:any;unitId:string;userId:string;viewer:boolean}){
 const [clock,setClock]=useState(localTime()),[today,setToday]=useState(localDate()),[checklists,setChecklists]=useState<Checklist[]>([]),[items,setItems]=useState<Item[]>([]),[runs,setRuns]=useState<Run[]>([]),[responses,setResponses]=useState<Response[]>([]),[assignment,setAssignment]=useState<any>(null),[role,setRole]=useState<Role|null>(null),[active,setActive]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[tab,setTab]=useState<"ceklist"|"riwayat"|"pengawasan">("ceklist"),[failItem,setFailItem]=useState<string|null>(null),[failNote,setFailNote]=useState("");
 const nowMin=Number(clock.slice(0,2))*60+Number(clock.slice(3,5));
 const handover=checklists.find(c=>c.sequence_no===1);
 const handoverRun=handover?runs.find(r=>r.checklist_id===handover.id&&r.duty_date===today&&r.duty_role==="Perwira Jaga"):undefined;
 const handoverItems=handover?items.filter(i=>i.checklist_id===handover.id):[];
 const handoverDone=handoverItems.length>0&&handoverItems.every(i=>responses.some(r=>r.run_id===handoverRun?.id&&r.checklist_item_id===i.id&&r.result==="pass"));
 const roleReady=!!assignment&&ROLES.includes(assignment.duty_role);
 const visible=useMemo(()=>checklists.filter(c=>c.assigned_role===role&&c.sequence_no!==1).sort((a,b)=>a.sequence_no-b.sequence_no),[checklists,role]);
 const allItems=useMemo(()=>items.filter(i=>visible.some(c=>c.id===i.checklist_id)),[items,visible]);
 const completed=useMemo(()=>allItems.filter(i=>responses.some(r=>r.checklist_item_id===i.id&&r.result==="pass"&&runs.some(run=>run.id===r.run_id&&run.duty_date===today&&run.duty_role===role))).length,[allItems,responses,runs,today,role]);
 const openFindings=useMemo(()=>responses.filter(r=>r.result==="fail"&&runs.some(run=>run.id===r.run_id&&run.duty_date===today)),[responses,runs,today]);
 const reload=useCallback(async()=>{
  if(!unitId)return;
  setLoading(true);
  const [c,i,a,r]=await Promise.all([
   supabase.from("checklists").select("id,title,description,category,assigned_role,scheduled_time,location_label,instructions,animation_key,sequence_no").eq("unit_id",unitId).eq("is_active",true).order("sequence_no"),
   supabase.from("checklist_items").select("id,checklist_id,item_order,item_label,is_required").order("item_order"),
   supabase.from("daily_watch_assignments").select("id,duty_date,duty_role,selected_by,created_at").eq("unit_id",unitId).eq("duty_date",today).maybeSingle(),
   supabase.from("checklist_runs").select("id,checklist_id,duty_date,duty_role,performed_by,performed_at,completed_at").eq("unit_id",unitId).eq("duty_date",today)
  ]);
  if(c.error||i.error||a.error||r.error){setNotice("Data checklist belum dapat dimuat: "+(c.error||i.error||a.error||r.error)?.message);setLoading(false);return}
  const cs=(c.data||[]) as Checklist[],its=(i.data||[]) as Item[],rs=(r.data||[]) as Run[];
  setChecklists(cs);setItems(its);setAssignment(a.data||null);setRole((a.data?.duty_role as Role)||null);setRuns(rs);
  if(rs.length){const ids=rs.map(x=>x.id);const {data:resp,error}=await supabase.from("checklist_responses").select("id,run_id,checklist_item_id,result,notes,created_at").in("run_id",ids);if(error)setNotice("Riwayat checklist belum dapat dimuat: "+error.message);else setResponses((resp||[]) as Response[])}else setResponses([]);
  setLoading(false);
 },[supabase,unitId,today]);
 useEffect(()=>{reload()},[reload]);
 useEffect(()=>{const t=window.setInterval(()=>{const d=localDate();setClock(localTime());if(d!==today)setToday(d)},15000);return()=>window.clearInterval(t)},[today]);
 const ensureRun=async(c:Checklist,runRole:Role):Promise<Run|null>=>{
  let found=runs.find(r=>r.checklist_id===c.id&&r.duty_date===today&&r.duty_role===runRole);if(found)return found;
  const {data,error}=await supabase.from("checklist_runs").insert({unit_id:unitId,checklist_id:c.id,performed_by:userId,duty_date:today,duty_role:runRole,summary:"Pengecekan harian NAVYLOG"}).select("id,checklist_id,duty_date,duty_role,performed_by,performed_at,completed_at").single();
  if(error){const {data:existing}=await supabase.from("checklist_runs").select("id,checklist_id,duty_date,duty_role,performed_by,performed_at,completed_at").eq("unit_id",unitId).eq("checklist_id",c.id).eq("duty_date",today).eq("duty_role",runRole).maybeSingle();if(existing){setRuns(old=>old.some(x=>x.id===existing.id)?old:[...old,existing as Run]);return existing as Run}setNotice("Tidak dapat memulai checklist: "+error.message);return null}
  const next=data as Run;setRuns(old=>[...old,next]);return next;
 };
 const finishIfComplete=async(run:Run,c:Checklist,nextResponses:Response[])=>{
  const required=items.filter(i=>i.checklist_id===c.id&&i.is_required);
  const done=required.every(i=>nextResponses.some(x=>x.run_id===run.id&&x.checklist_item_id===i.id&&(x.result==="pass"||x.result==="not_applicable")));
  if(done&&!run.completed_at){const {error}=await supabase.from("checklist_runs").update({completed_at:new Date().toISOString(),summary:"Seluruh item wajib telah diperiksa."}).eq("id",run.id);if(!error)setRuns(old=>old.map(x=>x.id===run.id?{...x,completed_at:new Date().toISOString()}:x))}
 };
 const mark=async(c:Checklist,item:Item,result:"pass"|"fail")=>{
  if(viewer||busy)return;
  if(c.sequence_no!==1&&!roleReady){setNotice("Tetapkan petugas jaga pukul 07.45 terlebih dahulu.");return}
  setBusy(true);setActive(c.id);setNotice("");
  const run=await ensureRun(c,c.sequence_no===1?"Perwira Jaga":role!);if(!run){setBusy(false);return}
  const existing=responses.find(x=>x.run_id===run.id&&x.checklist_item_id===item.id);
  if(existing){setNotice("Item ini sudah memiliki catatan pemeriksaan.");setBusy(false);return}
  const {data,error}=await supabase.from("checklist_responses").insert({run_id:run.id,checklist_item_id:item.id,result,notes:result==="fail"?failNote.trim()||"Temuan perlu ditindaklanjuti.":null}).select("id,run_id,checklist_item_id,result,notes,created_at").single();
  if(error){setNotice("Gagal menyimpan hasil pemeriksaan: "+error.message);setBusy(false);return}
  const next=[...responses,data as Response];setResponses(next);await finishIfComplete(run,c,next);
  setFailItem(null);setFailNote("");setNotice(result==="pass"?"Pemeriksaan berhasil dicatat.":"Temuan berhasil dicatat dan masuk pengawasan.");
  setBusy(false);
 };
 const selectRole=async(r:Role)=>{
  if(viewer||!handoverDone||nowMin<465||busy)return;
  setBusy(true);setNotice("");
  const {data,error}=await supabase.from("daily_watch_assignments").insert({unit_id:unitId,duty_date:today,duty_role:r,selected_by:userId}).select("id,duty_date,duty_role,selected_by,created_at").single();
  if(error){const {data:existing}=await supabase.from("daily_watch_assignments").select("id,duty_date,duty_role,selected_by,created_at").eq("unit_id",unitId).eq("duty_date",today).maybeSingle();if(existing){setAssignment(existing);setRole(existing.duty_role as Role);setNotice("Petugas jaga hari ini sudah ditetapkan: "+existing.duty_role)}else setNotice("Penetapan petugas gagal: "+error.message)}
  else{setAssignment(data);setRole(r);setNotice("Petugas jaga hari ini ditetapkan: "+r+". Checklist harian telah dibuka.")}
  setBusy(false);
 };
 const runFor=(c:Checklist)=>runs.find(r=>r.checklist_id===c.id&&r.duty_date===today&&r.duty_role===role);
 const itemState=(c:Checklist,i:Item)=>{const run=runFor(c);return responses.find(r=>r.run_id===run?.id&&r.checklist_item_id===i.id)};
 const completedChecks=responses.filter(r=>r.result==="pass"&&runs.some(run=>run.duty_date===today&&run.id===r.run_id)).length;
 const totalChecks=handoverItems.length+allItems.length;
 const selectedLabel=role?role:"Belum ditetapkan";
 const current=visible.find(c=>c.id===active)||visible.find(c=>c.scheduled_time<=clock+":00"&&!runFor(c)?.completed_at)||visible[0];
 const svgZone=active?checklists.find(c=>c.id===active)?.animation_key:current?.animation_key;
 return <section className="dl-shell">
  <header className="dl-head"><div><span className="dl-kicker">NAVYLOG / KRI ALAMANG-644</span><h2>Digital Logbook</h2><p>Panduan lokasi dan waktu pemeriksaan harian kapal.</p></div><div className="dl-clock"><b>{clock}</b><small>WAKTU KAPAL · WIB</small><small>{fmtDate(today)}</small></div></header>
  <div className="dl-shipmap">
   <div className="dl-map-title"><b>KRI ALAMANG-644 · CUTAWAY TAMPAK SAMPING</b><small>Ilustrasi tata ruang untuk panduan lokasi pengecekan</small></div>
   <svg viewBox="0 0 1200 430" role="img" aria-label="Ilustrasi tampak samping cutaway KRI Alamang 644 dengan ruang kapal diberi label">
    <defs><linearGradient id="dlSky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#123d61"/><stop offset="1" stopColor="#071b31"/></linearGradient><linearGradient id="dlHull" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b8c8d0"/><stop offset="1" stopColor="#536d80"/></linearGradient><linearGradient id="dlWindow"><stop stopColor="#6ecbe9"/><stop offset="1" stopColor="#12364d"/></linearGradient></defs>
    <rect width="1200" height="430" fill="url(#dlSky)"/><path d="M0 345Q160 320 320 345T640 345T960 345T1200 345V430H0Z" fill="#0b5278"/><path d="M0 360Q160 342 320 360T640 360T960 360T1200 360" fill="none" stroke="#66c7e9" strokeWidth="2" opacity=".55"/>
    <path d="M70 254L1080 254L1160 220L1090 345Q1060 365 1000 368H160Q95 360 70 254Z" fill="url(#dlHull)" stroke="#e2f4fb" strokeWidth="4"/>
    <path d="M75 259H1110" stroke="#193c55" strokeWidth="7"/><path d="M80 344H1080" stroke="#a8d3e3" strokeWidth="2" opacity=".45"/>
    <g stroke="#24485f" strokeWidth="2" fill="#102f49">
     <rect x="145" y="266" width="180" height="76" rx="4"/><rect x="333" y="266" width="145" height="76" rx="4"/><rect x="486" y="266" width="140" height="76" rx="4"/><rect x="634" y="266" width="135" height="76" rx="4"/><rect x="777" y="266" width="128" height="76" rx="4"/><rect x="913" y="266" width="135" height="76" rx="4"/>
     <path d="M565 255V150L603 119H744L784 155V255Z" fill="#879eae" stroke="#e0f3fb" strokeWidth="3"/>
     <path d="M604 154H754V202H604Z" fill="#243e53"/><rect x="612" y="160" width="28" height="27" fill="url(#dlWindow)"/><rect x="646" y="160" width="28" height="27" fill="url(#dlWindow)"/><rect x="680" y="160" width="28" height="27" fill="url(#dlWindow)"/><rect x="714" y="160" width="28" height="27" fill="url(#dlWindow)"/>
     <path d="M660 120V53M660 53L643 76M660 53L679 76M660 53V22M660 22H688" fill="none" stroke="#e5f7ff" strokeWidth="4"/><path d="M680 23L696 30L680 37Z" fill="#c43b45"/>
    </g>
    <g fill="#1a6d83" stroke="#92e6f5" strokeWidth="2">
     <rect x="173" y="292" width="118" height="30" rx="4"/><rect x="358" y="281" width="92" height="48" rx="4"/><rect x="509" y="281" width="96" height="48" rx="4"/><rect x="654" y="284" width="96" height="44" rx="4"/><rect x="795" y="281" width="92" height="48" rx="4"/><rect x="935" y="280" width="91" height="50" rx="22"/>
    </g>
    <g stroke="#b8d8e7" strokeWidth="2" fill="#d4e7ed"><rect x="190" y="278" width="20" height="14"/><rect x="216" y="278" width="20" height="14"/><rect x="242" y="278" width="20" height="14"/><rect x="369" y="275" width="18" height="6"/><rect x="393" y="275" width="18" height="6"/><rect x="417" y="275" width="18" height="6"/><path d="M666 298H737M666 309H737" fill="none"/><rect x="806" y="293" width="20" height="24" rx="3"/><rect x="833" y="293" width="20" height="24" rx="3"/></g>
    <g fill="#f5f8f9" fontSize="15" fontWeight="700" textAnchor="middle"><text x="232" y="358">KAMAR MESIN</text><text x="405" y="358">GUDANG LOGISTIK</text><text x="557" y="358">DAPUR</text><text x="701" y="358">AKOMODASI</text><text x="841" y="358">TANGKI AIR</text><text x="980" y="358">BBM</text><text x="675" y="222">ANJUNGAN / NAVIGASI</text></g>
    <g fill="#dff8ff" fontSize="12" fontWeight="700"><text x="90" y="232">BURITAN</text><text x="1090" y="205" textAnchor="end">HALUAN · 644</text><text x="600" y="402" textAnchor="middle">SKEMA VISUAL RUANG · BUKAN GAMBAR KONSTRUKSI / NAVIGASI</text></g>
    <g fill="none" stroke="#4fe1ff" strokeWidth="3"><path d={svgZone==="mesin"||svgZone==="bilga"?"M230 265V245H230":svgZone==="elektronik"||svgZone==="rekap"?"M675 148V110H675":svgZone==="bekal"||svgZone==="opname"?"M405 265V240H405":"M560 265V240H560"} opacity=".95"/><circle cx={svgZone==="mesin"||svgZone==="bilga"?230:svgZone==="elektronik"||svgZone==="rekap"?675:svgZone==="bekal"||svgZone==="opname"?405:560} cy={svgZone==="elektronik"||svgZone==="rekap"?148:265} r="9" fill="#4fe1ff"/></g>
    <g fill="#f5c86b" stroke="#0b2c46" strokeWidth="2"><circle cx="105" cy="245" r="7"/><path d="M98 254h14l6 25H92Z"/></g>
    <g fill="#d8eff8" fontSize="13"><text x="28" y="28">KCR-40 · PANJANG 44,00 M · LEBAR 7,40 M</text><text x="1170" y="28" textAnchor="end">KRI ALAMANG-644</text></g>
   </svg>
   <div className="dl-zones"><span>Geladak Kerja</span><span>Anjungan / Navigasi</span><span>Kamar Mesin</span><span>Gudang Logistik</span><span>Dapur & Konsumsi</span><span>Akomodasi</span><span>Tangki Air & BBM</span></div>
  </div>
  <div className="dl-narrative"><b>{current?.title||"Pemeriksaan harian kapal"}</b><p>{current?.instructions||"Pilih petugas jaga setelah serah terima jaga untuk membuka daftar pemeriksaan sesuai tanggung jawab."}</p><small>LOKASI: {current?.location_label||"Seluruh kapal"} · JAM: {current?hh(current.scheduled_time):"07:45"}</small></div>
  <div className="dl-gate">
   <div className="dl-gate-step"><span>07:30</span><div><b>Serah terima jaga</b><small>Konfirmasi pengecekan tali tambat, tangga kapal, cuaca, dan kejadian menonjol.</small></div><strong>{handoverDone?"SELESAI":handoverRun?"BERLANGSUNG":"MENUNGGU"}</strong></div>
   {handover&&<div className="dl-handover-items">{handoverItems.map(i=>{const res=responses.find(r=>r.run_id===handoverRun?.id&&r.checklist_item_id===i.id);return <div className="dl-checkrow" key={i.id}><span>{i.item_label}</span><button disabled={viewer||busy||!!res} onClick={()=>mark(handover,i,"pass")}>{res?"✓ Dilaksanakan":"Tandai selesai"}</button></div>})}</div>}
   <div className="dl-gate-step role-gate"><span>07:45</span><div><b>Penetapan petugas jaga hari ini</b><small>Pilih pejabat yang bertugas sebelum checklist harian dibuka.</small></div><strong>{roleReady?assignment.duty_role:"PILIH PETUGAS"}</strong></div>
   {!roleReady?<div className="dl-role-select">{ROLES.map(r=><button key={r} className={role===r?"on":""} disabled={viewer||busy||!handoverDone||nowMin<465} onClick={()=>selectRole(r)}>{r}</button>)}{!handoverDone?<small>Selesaikan serah terima jaga terlebih dahulu.</small>:nowMin<465?<small>Pemilihan petugas dibuka pukul 07.45 WIB.</small>:null}</div>:<div className="dl-assigned"><b>Petugas terpilih: {assignment.duty_role}</b><small>Penetapan tersimpan untuk {fmtDate(today)}. Checklist sesuai peran telah dibuka.</small></div>}
  </div>
  <div className="dl-summary"><div><b>{checklists.length}</b><small>Agenda ceklis</small></div><div><b>{completedChecks}</b><small>Item selesai</small></div><div><b>{openFindings.length}</b><small>Temuan</small></div><div><b>{pct(completedChecks,totalChecks)}%</b><small>Progres hari ini</small></div></div>
  <div className="dl-tabs"><button className={tab==="ceklist"?"on":""} onClick={()=>setTab("ceklist")}>Checklist Harian</button><button className={tab==="riwayat"?"on":""} onClick={()=>setTab("riwayat")}>Riwayat Pelaksanaan</button><button className={tab==="pengawasan"?"on":""} onClick={()=>setTab("pengawasan")}>Pengawasan</button></div>
  {loading?<div className="dl-empty">Memuat daftar pengecekan...</div>:tab==="ceklist"?<div className="dl-panel">
   {!roleReady?<p className="dl-empty">Checklist harian akan muncul setelah serah terima jaga dikonfirmasi dan petugas pukul 07.45 ditetapkan.</p>:visible.length?visible.map(c=>{const its=items.filter(i=>i.checklist_id===c.id),run=runFor(c),done=its.filter(i=>itemState(c,i)?.result==="pass").length,failed=its.filter(i=>itemState(c,i)?.result==="fail").length,finished=its.length>0&&done+failed===its.length;return <article className={"dl-task "+(active===c.id?"active":"")} key={c.id}><button className="dl-task-head" onClick={()=>setActive(active===c.id?null:c.id)}><span className="dl-task-time">{hh(c.scheduled_time)}</span><span className="dl-task-main"><b>{c.title}</b><small>{c.location_label} · {c.assigned_role}</small><i><em style={{width:pct(done+failed,its.length)+"%"}}/></i></span><span className={"dl-status "+(finished?"done":run?"progress":"wait")}>{finished?"Selesai":run?"Berlangsung":"Menunggu"}</span></button>{active===c.id&&<div className="dl-task-body"><p>{c.instructions}</p>{its.map(i=>{const state=itemState(c,i);return <div className="dl-checkrow" key={i.id}><span>{i.item_label}</span>{state?<strong className={state.result==="pass"?"ok":"bad"}>{state.result==="pass"?"✓ Dilaksanakan":"⚠ Temuan"}</strong>:<div className="dl-check-actions"><button disabled={viewer||busy} onClick={()=>mark(c,i,"pass")}>✓ Sudah dilaksanakan</button><button className="finding" disabled={viewer||busy} onClick={()=>{setFailItem(i.id);setFailNote("");}}>Temuan</button></div>}{failItem===i.id&&<div className="dl-failbox"><textarea value={failNote} onChange={e=>setFailNote(e.target.value)} placeholder="Uraikan temuan aktual..."/><button disabled={busy||viewer} onClick={()=>mark(c,i,"fail")}>Simpan temuan</button><button onClick={()=>setFailItem(null)}>Batal</button></div>}</div>})}<small>Pelaksanaan tercatat dengan akun yang sedang masuk dan waktu server.</small></div>}</article>}):<p className="dl-empty">Tidak ada checklist untuk peran ini.</p>}
  </div>:tab==="riwayat"?<div className="dl-panel">{responses.filter(r=>runs.some(run=>run.id===r.run_id&&run.duty_date===today)).slice().reverse().map(r=>{const item=items.find(i=>i.id===r.checklist_item_id),c=checklists.find(x=>x.id===item?.checklist_id),run=runs.find(x=>x.id===r.run_id);return <article className="dl-history" key={r.id}><time>{new Date(r.created_at).toLocaleTimeString("id-ID",{timeZone:WIB,hour:"2-digit",minute:"2-digit"})}</time><div><b>{item?.item_label}</b><small>{c?.title} · {run?.duty_role}</small></div><strong className={r.result==="pass"?"ok":"bad"}>{r.result==="pass"?"Selesai":"Temuan"}</strong></article>})}{!responses.length&&<p className="dl-empty">Belum ada pengecekan yang diselesaikan hari ini.</p>}</div>:<div className="dl-panel"><h3>Pengawasan harian</h3><p>Petugas: <b>{selectedLabel}</b></p><p>Item dilaksanakan: <b>{completedChecks}</b> dari {allItems.length}</p><p>Temuan yang tercatat: <b>{openFindings.length}</b></p>{openFindings.map(r=><p key={r.id} className="dl-finding">⚠ {items.find(i=>i.id===r.checklist_item_id)?.item_label}: {r.notes||"Temuan perlu tindak lanjut."}</p>)}<p>Checklist selesai ditandai otomatis setelah seluruh item wajib pada kegiatan tersebut memiliki hasil.</p></div>}
  {notice&&<div className="dl-notice">{notice}</div>}
  <div className="dl-footnote">Mode operasional NAVYLOG: tidak ada jurnal simulasi atau catatan manual. Setiap tombol pelaksanaan menyimpan hasil checklist ke basis data NAVYHUB. Hasil pemeriksaan dan angka teknis harus diisi berdasarkan kondisi aktual kapal.</div>
 </section>;
}
