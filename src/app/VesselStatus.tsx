"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";

type Props={supabase:any;unitId:string;userId:string;canManage:boolean};
const wx=(n:number)=>({0:"Cerah",1:"Cerah berawan",2:"Berawan sebagian",3:"Berawan",45:"Kabut",48:"Kabut beku",51:"Gerimis ringan",53:"Gerimis",55:"Gerimis lebat",61:"Hujan ringan",63:"Hujan",65:"Hujan lebat",80:"Hujan lokal",81:"Hujan lokal sedang",82:"Hujan lokal lebat",95:"Badai petir",96:"Badai petir dan hujan es",99:"Badai petir kuat"} as Record<number,string>)[n]||"Kondisi tidak diketahui";
const fmt=(v:any,d=1)=>v==null?"—":Number(v).toFixed(d);
const stamp=(v:string)=>new Date(v).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"});
export default function VesselStatus({supabase,unitId,userId,canManage}:Props){
 const [gps,setGps]=useState<any>(null),[weather,setWeather]=useState<any>(null),[marine,setMarine]=useState<any>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[mapOpen,setMapOpen]=useState(false);
 const [tracking,setTracking]=useState(false),[trackingStatus,setTrackingStatus]=useState("STOPPED"),[lastSentAt,setLastSentAt]=useState<string|null>(null);
 const [simMode,setSimMode]=useState(false),[simGps,setSimGps]=useState<any>({latitude:1.08000,longitude:104.22000,speed_knots:8.2,course_degrees:62,position_at:new Date().toISOString(),source:"SIMULATION"}),[simHeading,setSimHeading]=useState(64);
 const trackingTimer=useRef<number|null>(null),trackingEnabled=useRef(false),requestPending=useRef(false);
 const load=useCallback(async()=>{
  if(!unitId){setLoading(false);return}setLoading(true);setError("");
  const {data,error}=await supabase.from("vessel_gps_positions").select("id,unit_id,position_at,latitude,longitude,speed_knots,course_degrees,satellites,fix_quality,source,received_at,accuracy_m,reporter_user_id").eq("unit_id",unitId).order("position_at",{ascending:false}).limit(1).maybeSingle();
  if(error){setError("Data GPS gagal dibaca: "+error.message);setLoading(false);return}
  setGps(data||null);
  if(data){
   try{
    const q="latitude="+encodeURIComponent(data.latitude)+"&longitude="+encodeURIComponent(data.longitude)+"&timezone=Asia%2FJakarta";
    const [w,m]=await Promise.all([
     fetch("https://api.open-meteo.com/v1/forecast?"+q+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1",{cache:"no-store"}),
     fetch("https://marine-api.open-meteo.com/v1/marine?"+q+"&current=wave_height,sea_level_height_msl,ocean_current_velocity,ocean_current_direction&hourly=sea_level_height_msl&forecast_days=1&cell_selection=sea",{cache:"no-store"})
    ]);
    if(!w.ok)throw new Error("Layanan cuaca gagal merespons ("+w.status+").");
    setWeather(await w.json());setMarine(m.ok?await m.json():null);
   }catch(e:any){setError(e?.message||"Data cuaca dan laut tidak dapat dimuat.");setWeather(null);setMarine(null)}
  }else{setWeather(null);setMarine(null)}
  setLoading(false);
 },[supabase,unitId]);
 useEffect(()=>{load();const t=window.setInterval(load,60000);return()=>window.clearInterval(t)},[load]);
 const publishPosition=useCallback(async(pos:GeolocationPosition)=>{
  if(requestPending.current)return;
  requestPending.current=true;setError("");
  try{
   const {data:{session},error:sessionError}=await supabase.auth.getSession();
   if(sessionError||!session?.access_token)throw new Error("Sesi Admin tidak tersedia. Silakan masuk kembali.");
   const positionAt=new Date(pos.timestamp).toISOString();
   const speed=pos.coords.speed==null?null:Math.max(0,pos.coords.speed*1.943844);
   const course=pos.coords.heading==null?null:((pos.coords.heading%360)+360)%360;
   const accuracy=pos.coords.accuracy??null;
   const response=await fetch("/api/gps",{
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({latitude:pos.coords.latitude,longitude:pos.coords.longitude,speed_knots:speed,course_degrees:course,accuracy_m:accuracy,position_at:positionAt,fix_quality:"Lokasi perangkat Admin; proksi posisi kapal, bukan GPS onboard",source:"admin_device_gps"})
   });
   const result=await response.json().catch(()=>({error:"Respons server tidak valid."}));
   if(!response.ok)throw new Error(result.error||"Lokasi perangkat gagal dikirim.");
   setGps((previous:any)=>({...previous,unit_id:unitId,latitude:pos.coords.latitude,longitude:pos.coords.longitude,speed_knots:speed,course_degrees:course,accuracy_m:accuracy,position_at:positionAt,received_at:result.received_at||new Date().toISOString(),source:"admin_device_gps",reporter_user_id:userId}));
   setLastSentAt(positionAt);setTrackingStatus("ACTIVE");
   setNotice("Master GPS aktif. Posisi perangkat Admin dibagikan sebagai proksi posisi KRI; bukan pembacaan GPS onboard terpisah.");
  }catch(error:any){
   setTrackingStatus("ERROR");setError(error?.message||"Posisi perangkat gagal dikirim.");
  }finally{requestPending.current=false}
 },[supabase,unitId,userId]);
 const geoError=useCallback((err:GeolocationPositionError)=>{
  setTrackingStatus("ERROR");
  setError(err.code===1?"Izin lokasi ditolak. Aktifkan Location Services dan izinkan ALNAV DMS pada pengaturan Safari/browser.":err.code===2?"Lokasi perangkat belum tersedia. Periksa GPS dan layanan lokasi.":"GPS perangkat belum merespons. Sistem akan mencoba kembali sesuai interval.");
 },[]);
 const requestDeviceFix=useCallback(()=>{
  if(!trackingEnabled.current||requestPending.current)return;
  if(typeof navigator==="undefined"||!navigator.geolocation){setTrackingStatus("UNAVAILABLE");setError("Perangkat ini tidak menyediakan layanan lokasi.");return;}
  setTrackingStatus("ACQUIRING");
  navigator.geolocation.getCurrentPosition(pos=>{void publishPosition(pos)},geoError,{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
 },[publishPosition,geoError]);
 const startMasterGps=useCallback(()=>{
  if(typeof navigator==="undefined"||!navigator.geolocation){setError("Perangkat ini tidak menyediakan layanan lokasi.");setTrackingStatus("UNAVAILABLE");return;}
  if(trackingEnabled.current)return;
  trackingEnabled.current=true;setTracking(true);setTrackingStatus("ACQUIRING");setError("");
  setNotice("Master GPS perangkat Admin diaktifkan. Pertahankan ALNAV DMS tetap terbuka agar pembaruan berjalan.");
  requestDeviceFix();
  trackingTimer.current=window.setInterval(requestDeviceFix,30000);
 },[requestDeviceFix]);
 const stopMasterGps=useCallback(()=>{
  trackingEnabled.current=false;
  if(trackingTimer.current!==null){window.clearInterval(trackingTimer.current);trackingTimer.current=null}
  setTracking(false);setTrackingStatus("STOPPED");
  setNotice("Pembaruan Master GPS dihentikan. Posisi terakhir tetap tersimpan dan akan berubah menjadi STALE setelah melewati batas kesegaran.");
 },[]);
 useEffect(()=>()=>{trackingEnabled.current=false;if(trackingTimer.current!==null)window.clearInterval(trackingTimer.current)},[]);
 const gpsSourceLabel=(source:string|null|undefined)=>source==="onboard_gps"?"GPS onboard (gateway)":source==="admin_device_gps"?"Lokasi perangkat Admin":source==="KRI_ALAMANG_644_MASTER_GPS"?"Data lama · sumber perangkat belum terverifikasi":source||"Sumber posisi tidak diketahui";
 const simEnvironment={temperature_2m:29.4,relative_humidity_2m:78,precipitation:0.2,weather_code:2,wind_speed_10m:11.6,wind_direction_10m:48};
 const simSea={sea_level_height_msl:0.42,wave_height:0.7,ocean_current_velocity:0.8,ocean_current_direction:125};
 const current=simMode?simEnvironment:weather?.current,mc=simMode?simSea:marine?.current;
 const shownGps=simMode?simGps:gps;
 useEffect(()=>{
  if(!simMode)return;
  const timer=window.setInterval(()=>{
   setSimGps((p:any)=>{
    const nextHeading=(Number(p.course_degrees)+((Math.sin(Date.now()/11000)*2.8)+360))%360;
    const speed=8.2+Math.sin(Date.now()/9000)*0.7;
    const distanceNm=speed*(2/3600);
    const rad=nextHeading*Math.PI/180;
    const lat=p.latitude+(distanceNm/60)*Math.cos(rad);
    const lon=p.longitude+(distanceNm/(60*Math.max(0.2,Math.cos(p.latitude*Math.PI/180))))*Math.sin(rad);
    return {latitude:lat,longitude:lon,speed_knots:speed,course_degrees:nextHeading,satellites:12,fix_quality:"3D FIX · SIMULATED",accuracy_m:2.4+Math.abs(Math.sin(Date.now()/5000))*0.8,position_at:new Date().toISOString(),source:"SIMULATION"};
   });
   setSimHeading((h:number)=>((h+((Math.sin(Date.now()/7000))*1.6)+360)%360));
  },2000);
  return ()=>window.clearInterval(timer);
 },[simMode]);
 const hourly=(marine?.hourly?.sea_level_height_msl||[]).filter((v:any)=>typeof v==="number"&&Number.isFinite(v));
 const low=simMode?0.38:hourly.length?Math.min(...hourly):null,high=simMode?0.46:hourly.length?Math.max(...hourly):null;
 const stale=gps?Date.now()-new Date(gps.position_at).getTime()>(gps.source==="admin_device_gps"?2:15)*60*1000:false;
 const mapSrc=useMemo(()=>{
  const bbox="94.5%2C-11.5%2C141.5%2C6.5";
  const marker=shownGps?"&marker="+encodeURIComponent(Number(shownGps.latitude)+","+Number(shownGps.longitude)):"";
  return "https://www.openstreetmap.org/export/embed.html?bbox="+bbox+"&layer=mapnik"+marker;
 },[shownGps?.latitude,shownGps?.longitude]);
  return <section className="navy-maritime">
  {mapOpen&&<div className="navy-map-modal" role="dialog" aria-modal="true" aria-label="Peta maritim Indonesia" onClick={e=>{if(e.target===e.currentTarget)setMapOpen(false)}}><div className="navy-map-dialog"><div className="navy-map-shell">
   <div className="navy-map-top"><div><small>FLEET TRACKING · INDONESIAN ARCHIPELAGO</small><h2>Peta Maritim Indonesia</h2><p>Posisi terakhir tercatat KRI Alamang-644</p></div><div className="navy-map-top-actions"><div className={"navy-gps-state "+(gps?(stale?"stale":"live"):"offline")}><i/>{gps?(stale?"GPS DATA AGED":"GPS POSITION AVAILABLE"):"AWAITING GPS DATA"}</div><button type="button" className="navy-map-close" onClick={()=>setMapOpen(false)} aria-label="Tutup peta">✕</button></div></div>
   <div className="navy-map-canvas navy-map-real"><iframe title="Peta geografis Indonesia dengan posisi GPS kapal" src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>
    <div className="navy-map-coords">{gps?Number(gps.latitude).toFixed(5)+"°, "+Number(gps.longitude).toFixed(5)+"°":"MENUNGGU POSISI GPS"}</div>
    <div className="navy-map-legend"><span><i/> {simMode?"POSISI SIMULASI · BUKAN GPS REAL":"POSISI TERCATAT KRI ALAMANG-644"}</span><span>OPENSTREETMAP · MAPNIK</span></div>
   </div>
   <div className="navy-map-footer"><span>UNIT · KRI ALAMANG-644</span><span>{shownGps?(simMode?"SIMULATION: ":"Last position: ")+stamp(shownGps.position_at):"Belum ada data posisi kapal"}</span><button onClick={load} disabled={loading}>{loading?"MEMUAT…":"↻ REFRESH"}</button><a href={shownGps?"https://www.openstreetmap.org/?mlat="+shownGps.latitude+"&mlon="+shownGps.longitude+"#map=7/"+shownGps.latitude+"/"+shownGps.longitude:"https://www.openstreetmap.org/#map=5/-2.5/118"} target="_blank" rel="noreferrer">BUKA PETA ↗</a></div>
  </div></div></div>}
  <section className="navy-telemetry-command" aria-label="Telemetri navigasi kapal">
   <div className="navy-telemetry-heading">
    <div><small>ALAMANG NAVAL DATA MANAGEMENT SYSTEM</small><h2>VESSEL NAVIGATION · KRI ALAMANG-644</h2><p>Telemetri posisi dan pergerakan kapal dari sumber yang tercatat</p></div>
    <span className={"navy-telemetry-freshness " + (simMode ? "is-live" : gps ? (stale ? "is-stale" : "is-live") : "is-offline")}><i/>{simMode?"SIMULATION ACTIVE":gps?(stale?"STALE DATA":"DATA RECEIVED"):"NO GPS DATA"}</span>
   </div>
   <div className="navy-telemetry-grid">
    <article className="navy-telemetry-compass"><div className="navy-telemetry-label">COURSE OVER GROUND <span>COG</span></div><div className="navy-compass-dial"><span className="navy-compass-n">N</span><span className="navy-compass-e">E</span><span className="navy-compass-s">S</span><span className="navy-compass-w">W</span><div className="navy-compass-needle" style={{transform:"rotate("+Number(shownGps.course_degrees)+"deg)"}}><i/><b/></div><div className="navy-compass-center"/></div><strong>{shownGps?.course_degrees!=null?fmt(shownGps.course_degrees,0)+"°":"—"}</strong></article>
    <div className="navy-telemetry-readouts">
     <article className="navy-telemetry-value"><small>SHIP HEADING · GYRO 360°</small><div className="navy-gyro-readout"><div className="navy-gyro-dial"><span>N</span><i style={{transform:"rotate("+simHeading+"deg)"}}/><b/></div><strong>{simMode?fmt(simHeading,0).padStart(3,"0")+"°":"—"}</strong></div></article>
     <article className="navy-telemetry-value"><small>SPEED OVER GROUND</small><b>{shownGps?.speed_knots!=null?fmt(shownGps.speed_knots,1)+" kn":"—"}</b></article>
     <article className="navy-telemetry-value"><small>GPS COORDINATES</small><b className="navy-telemetry-coordinate">{shownGps?Number(shownGps.latitude).toFixed(5)+"°, "+Number(shownGps.longitude).toFixed(5)+"°":"—"}</b><button type="button" onClick={()=>setMapOpen(true)}>BUKA PETA INDONESIA ↗</button></article>
    </div>
    <div className="navy-telemetry-readouts navy-telemetry-readouts-meta">
     <article className="navy-telemetry-value"><small>GPS FIX QUALITY</small><b>{shownGps?.fix_quality||"—"}</b><span>{shownGps?.satellites!=null?shownGps.satellites+" satelit":"—"}</span></article>
     <article className="navy-telemetry-value"><small>POSITION ACCURACY</small><b>{shownGps?.accuracy_m!=null?fmt(shownGps.accuracy_m,1)+" m":"—"}</b></article>
     <article className="navy-telemetry-value"><small>TELEMETRY SOURCE</small><b className="navy-telemetry-source">{simMode?"SIMULATED GPS + GYRO":gpsSourceLabel(gps.source)}</b><span>{stamp(shownGps.position_at)}</span></article>
    </div>}
   </div>
   <div className="navy-telemetry-note"><b>CATATAN NAVIGASI</b><span>COG menunjukkan arah gerak, bukan arah haluan (Heading). Heading simulasi ditampilkan terpisah sebagai demonstrasi gyro 360° dan tidak dianggap data gyro onboard. Matikan simulasi untuk kembali ke data GPS aktual.</span></div>
  </section>
  <div className="navy-maritime-cards">
   <article className="navy-info-card"><div className="navy-info-head"><span>☼</span><small>WEATHER · VESSEL LOCATION</small></div><b>{current?fmt(current.temperature_2m,0)+"°C":"—"}</b><strong>{current?wx(current.weather_code):"Menunggu koordinat GPS"}</strong><div className="navy-info-meta"><span>Angin <b>{current?fmt(current.wind_speed_10m)+" km/j":"—"}</b></span><span>Hujan <b>{current?fmt(current.precipitation)+" mm":"—"}</b></span></div><small>{current?"Kelembapan "+current.relative_humidity_2m+"% · arah "+current.wind_direction_10m+"°":"Cuaca mengikuti koordinat posisi terakhir"}</small></article>
   <article className="navy-info-card"><div className="navy-info-head"><span>≈</span><small>MARINE · SEA CONDITIONS</small></div><b>{mc?.sea_level_height_msl!=null?fmt(mc.sea_level_height_msl,2)+" m":"—"}</b><strong>Estimasi muka laut terhadap MSL</strong><div className="navy-info-meta"><span>Model tertinggi <b>{high==null?"—":fmt(high,2)+" m"}</b></span><span>Model terendah <b>{low==null?"—":fmt(low,2)+" m"}</b></span></div><small>Gelombang {mc?.wave_height==null?"—":fmt(mc.wave_height)+" m"} · Arus {mc?.ocean_current_velocity==null?"—":fmt(mc.ocean_current_velocity)+" m/s"}</small></article>
  </div>
  {canManage&&<div className="navy-gps-admin"><div className="navy-gps-admin-main"><div><span className="navy-gps-compact-state">DEMO NAVIGATION</span><small>Lintasan sintetis untuk uji gerak GPS dan gyro 360°. Tidak mengubah posisi GPS produksi.</small></div><button type="button" className={simMode?"stop":"start"} onClick={()=>setSimMode(v=>!v)}>{simMode?"HENTIKAN SIMULASI":"AKTIFKAN SIMULASI"}</button></div><div className="navy-gps-admin-main"><div><span className={"navy-gps-compact-state"+(tracking?" is-active":"")}>{tracking?"MASTER GPS AKTIF":"MASTER GPS TIDAK AKTIF"}</span><small>{trackingStatus==="ACTIVE"?"Perangkat Admin mengirim posisi":trackingStatus==="ACQUIRING"?"Mengambil posisi GPS perangkat":trackingStatus==="ERROR"?"Periksa izin/koneksi GPS":trackingStatus==="UNAVAILABLE"?"GPS perangkat tidak tersedia":"Sumber posisi belum diaktifkan"}{lastSentAt?" · terakhir dikirim "+stamp(lastSentAt):""}</small></div><button type="button" className={tracking?"stop":"start"} onClick={tracking?stopMasterGps:startMasterGps}>{tracking?"HENTIKAN MASTER GPS":"AKTIFKAN MASTER GPS"}</button></div></div>}
  {error&&<div className="navy-status-error">{error}</div>}{notice&&<div className="navy-status-notice">{notice}</div>}
 </section>
}
