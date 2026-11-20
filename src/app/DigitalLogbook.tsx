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
   <div className="dl-map-title"><b>KRI ALAMANG-644 · ILUSTRASI TAMPAK SAMPING</b><small>Identifikasi area pemeriksaan di atas kapal</small></div>
   <div className="dl-vessel-art" role="img" aria-label="Ilustrasi profil samping KRI Alamang-644, kapal cepat berlambung rendah dengan anjungan di bagian tengah dan haluan runcing">
    <svg viewBox="0 0 1440 430" preserveAspectRatio="xMidYMid meet">
     <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#0c5278" stopOpacity=".12"/><stop offset="1" stopColor="#0877a6" stopOpacity=".55"/></linearGradient>
      <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e6edf0"/><stop offset=".38" stopColor="#9eafb9"/><stop offset=".78" stopColor="#536b7c"/><stop offset="1" stopColor="#263f51"/></linearGradient>
      <linearGradient id="super" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f3f6f7"/><stop offset=".6" stopColor="#b7c5cc"/><stop offset="1" stopColor="#748b99"/></linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#6ad7f8"/><stop offset="1" stopColor="#102f4a"/></linearGradient>
      <linearGradient id="redStripe" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d6534b"/><stop offset="1" stopColor="#651f2c"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="5"/></filter>
      <filter id="shadow"><feGaussianBlur stdDeviation="8"/></filter>
     </defs>
     <path d="M0 342 Q180 323 360 344 T720 344 T1080 344 T1440 342V430H0Z" fill="url(#sea)"/>
     <path d="M0 366 Q170 347 340 366 T680 366 T1020 366 T1360 366" stroke="#54c9ef" strokeWidth="2" fill="none" opacity=".4"/>
     <ellipse cx="720" cy="358" rx="590" ry="22" fill="#061a29" opacity=".55" filter="url(#shadow)"/>
     <!-- Main hull: low-profile fast-attack craft, stern at left and sharp bow at right -->
     <path d="M118 270 L1118 270 Q1232 267 1322 225 L1390 201 Q1364 249 1318 298 Q1275 342 1194 356 Q1080 376 910 377 L270 377 Q174 373 142 342 Q123 320 118 270Z" fill="url(#hull)" stroke="#e7f3f8" strokeWidth="3"/>
     <path d="M126 322 Q340 339 620 342 L1045 342 Q1224 337 1340 265 Q1311 317 1269 345 Q1218 371 1113 376 L280 377 Q177 374 142 344Z" fill="url(#redStripe)" opacity=".95"/>
     <path d="M145 270 H1117 Q1235 267 1322 225" stroke="#f7fbfc" strokeWidth="4" fill="none"/>
     <path d="M158 286 H1124" stroke="#314e62" strokeWidth="4" opacity=".85"/>
     <path d="M182 301 H1120" stroke="#d7e5eb" strokeWidth="1.5" opacity=".75"/>
     <!-- Stern working deck / RHIB zone -->
     <path d="M150 260 L155 222 L188 210 H368 L393 226 L403 268Z" fill="url(#super)" stroke="#506c7e" strokeWidth="3"/>
     <path d="M174 218 H373" stroke="#f8fbfc" strokeWidth="5"/>
     <path d="M183 210 V197 H355 V210" fill="none" stroke="#eaf3f6" strokeWidth="4"/>
     <path d="M196 195 H337" stroke="#1d3b51" strokeWidth="5"/>
     <g fill="#dce8ed" stroke="#4b6576" strokeWidth="2"><path d="M216 181Q245 165 275 181L290 196H205Z"/><path d="M300 181Q326 165 350 181L362 197H291Z"/></g>
     <path d="M223 182 Q249 171 274 182 L285 190 H214Z" fill="#536f82"/>
     <!-- Main deckhouse with stepped profile and bridge -->
     <path d="M410 268 L425 218 L488 204 L518 162 L590 157 L606 128 L771 128 L803 153 L882 156 L917 180 L982 188 L1025 222 L1092 240 L1118 270Z" fill="url(#super)" stroke="#526d7d" strokeWidth="3"/>
     <path d="M518 162 L590 157 L606 128 L771 128 L803 153 L882 156 L917 180 L982 188" stroke="#f4f8fa" strokeWidth="4" fill="none"/>
     <path d="M607 133 H771 L798 156 H601Z" fill="#cbd6dc" stroke="#6e8492" strokeWidth="2"/>
     <!-- Bridge glazing -->
     <path d="M806 158 L876 161 L908 184 L974 192 L992 215 L859 210 L821 187Z" fill="#425f73" stroke="#dcebf1" strokeWidth="3"/>
     <g fill="url(#glass)" stroke="#1e4059" strokeWidth="2">
      <path d="M824 164 L844 165 L858 183 L833 182Z"/><path d="M850 166 L873 168 L890 186 L866 184Z"/><path d="M879 170 L899 174 L915 190 L895 187Z"/><path d="M910 180 L936 184 L949 198 L925 195Z"/><path d="M941 187 L965 193 L976 205 L954 201Z"/>
     </g>
     <path d="M808 157 L976 190" stroke="#f7fbfc" strokeWidth="3"/>
     <!-- Deckhouse side windows and access doors -->
     <g fill="#263f53" stroke="#e0eaf0" strokeWidth="2">
      <rect x="457" y="222" width="40" height="30" rx="2"/><rect x="505" y="218" width="40" height="31" rx="2"/><rect x="552" y="213" width="43" height="36" rx="2"/>
      <rect x="624" y="178" width="34" height="42" rx="2"/><rect x="666" y="177" width="34" height="43" rx="2"/><rect x="708" y="177" width="34" height="43" rx="2"/><rect x="750" y="178" width="34" height="42" rx="2"/>
      <rect x="806" y="225" width="37" height="34" rx="2"/><rect x="850" y="225" width="37" height="34" rx="2"/><rect x="895" y="226" width="37" height="33" rx="2"/>
     </g>
     <g fill="url(#glass)" stroke="#c7e8f2" strokeWidth="1.5">
      <rect x="461" y="226" width="32" height="21"/><rect x="509" y="222" width="32" height="22"/><rect x="556" y="217" width="35" height="26"/>
      <rect x="629" y="182" width="24" height="28"/><rect x="671" y="181" width="24" height="29"/><rect x="713" y="181" width="24" height="29"/><rect x="755" y="182" width="24" height="28"/>
      <rect x="810" y="229" width="29" height="24"/><rect x="854" y="229" width="29" height="24"/><rect x="899" y="230" width="29" height="23"/>
     </g>
     <!-- mast, radar and communications -->
     <path d="M687 128 L697 44 L707 128" stroke="#dfe9ed" strokeWidth="5" fill="#7b909d"/>
     <path d="M691 81 H758 M695 91 H750 M699 103 H741" stroke="#344f64" strokeWidth="4"/>
     <path d="M693 52 L720 35 L742 52 L720 58Z" fill="#dce7eb" stroke="#526b7b" strokeWidth="2"/>
     <path d="M700 44 V20 M700 21 H735 M707 31 L724 12" stroke="#eaf4f7" strokeWidth="3" fill="none"/>
     <path d="M720 15 L736 21 L720 27Z" fill="#c84b4d"/>
     <path d="M755 128 L755 91 L780 76" stroke="#d9e8ed" strokeWidth="3" fill="none"/>
     <path d="M772 76 Q795 66 815 76" stroke="#9eb5c1" strokeWidth="5" fill="none"/>
     <!-- exhaust / vents and deck fittings -->
     <g fill="#526c7d" stroke="#dce8ed" strokeWidth="2">
      <path d="M575 157 V110 H601 V157Z"/><path d="M608 157 V105 H633 V157Z"/><path d="M582 109 H594 M615 104 H627" stroke="#263f53" strokeWidth="4"/>
      <path d="M1024 222 V202 H1054 V222Z"/><path d="M1060 235 V218 H1080 V235Z"/>
     </g>
     <!-- foredeck gun mounting silhouette, no invented weapon detail -->
     <ellipse cx="1149" cy="248" rx="24" ry="8" fill="#718795" stroke="#e4eef2" strokeWidth="2"/>
     <path d="M1138 245 V222 H1147 L1160 226" stroke="#eaf1f4" strokeWidth="5" fill="none"/>
     <!-- stern railings and fittings -->
     <g stroke="#e7f2f6" strokeWidth="2" fill="none">
      <path d="M154 213 H393 M164 200 H366 M183 213 V227 M218 213 V226 M254 213 V226 M290 213 V226 M326 213 V226 M362 213 V226"/>
      <path d="M409 205 H498 M424 192 H511 M435 191 V205 M467 191 V205 M490 191 V205"/>
      <path d="M984 218 H1090 M1004 207 H1083 M1004 207 V218 M1040 207 V218 M1075 207 V218"/>
     </g>
     <!-- hull number and ship identity marking -->
     <text x="1208" y="310" fill="#f2f7f9" stroke="#314d60" strokeWidth="1" paintOrder="stroke" fontSize="43" fontWeight="800" fontStyle="italic" letterSpacing="2">644</text>
     <text x="111" y="404" fill="#b7d4e2" fontSize="14" fontWeight="700" letterSpacing="2">BURITAN</text>
     <text x="1390" y="404" textAnchor="end" fill="#b7d4e2" fontSize="14" fontWeight="700" letterSpacing="2">HALUAN</text>
     <!-- luminous callout positions track the real profile, not a generic cutaway -->
     <g fill="none" stroke="#55d9fa" strokeWidth="2.5" opacity=".95">
      <path d={svgZone==="mesin"||svgZone==="bilga"?"M535 268L535 305L455 305":svgZone==="elektronik"||svgZone==="rekap"?"M848 195L920 116L1030 116":svgZone==="bekal"||svgZone==="opname"?"M470 265L420 305L338 305":"M680 268L680 305L760 305"}/>
     </g>
     <circle cx={svgZone==="mesin"||svgZone==="bilga"?535:svgZone==="elektronik"||svgZone==="rekap"?848:svgZone==="bekal"||svgZone==="opname"?470:680} cy={svgZone==="elektronik"||svgZone==="rekap"?195:268} r="8" fill="#63e6ff" stroke="#e8fbff" strokeWidth="3"/>
    </svg>
    <div className="dl-vessel-caption"><span><b>PROFIL SAMPING</b> · KCR-40</span><span>44,00 m LOA · 7,40 m beam</span></div>
   </div>
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
