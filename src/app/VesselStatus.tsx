"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type Props={supabase:any;unitId:string;userId:string;canManage:boolean};
const wx=(n:number)=>({0:"Cerah",1:"Cerah berawan",2:"Berawan sebagian",3:"Berawan",45:"Kabut",48:"Kabut beku",51:"Gerimis ringan",53:"Gerimis",55:"Gerimis lebat",61:"Hujan ringan",63:"Hujan",65:"Hujan lebat",80:"Hujan lokal",81:"Hujan lokal sedang",82:"Hujan lokal lebat",95:"Badai petir",96:"Badai petir dan hujan es",99:"Badai petir kuat"} as Record<number,string>)[n]||"Kondisi tidak diketahui";
const fmt=(v:any,d=1)=>v==null?"—":Number(v).toFixed(d);
const stamp=(v:string)=>new Date(v).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"});
export default function VesselStatus({supabase,unitId,userId,canManage}:Props){
 const [gps,setGps]=useState<any>(null),[weather,setWeather]=useState<any>(null),[marine,setMarine]=useState<any>(null);
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [lat,setLat]=useState(""),[lon,setLon]=useState(""),[speed,setSpeed]=useState(""),[course,setCourse]=useState(""),[satellites,setSatellites]=useState(""),[positionAt,setPositionAt]=useState(()=>new Date().toISOString().slice(0,16));
 const load=useCallback(async()=>{
  if(!unitId){setLoading(false);return}setLoading(true);setError("");
  const {data,error}=await supabase.from("vessel_gps_positions").select("id,unit_id,position_at,latitude,longitude,speed_knots,course_degrees,satellites,fix_quality,source,received_at,accuracy_m,reporter_user_id").eq("unit_id",unitId).order("position_at",{ascending:false}).limit(1).maybeSingle();
  if(error){setError("Data GPS gagal dibaca: "+error.message);setLoading(false);return}
  setGps(data||null);
  if(data){
   setLat(String(data.latitude));setLon(String(data.longitude));setSpeed(data.speed_knots==null?"":String(data.speed_knots));setCourse(data.course_degrees==null?"":String(data.course_degrees));setSatellites(data.satellites==null?"":String(data.satellites));
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
 useEffect(()=>{
  if(!canManage||!unitId||!userId||typeof navigator==="undefined"||!navigator.geolocation)return;
  let active=true;
  const publish=async(pos:GeolocationPosition)=>{
   if(!active)return;
   const now=new Date().toISOString();
   const payload={unit_id:unitId,position_at:now,latitude:pos.coords.latitude,longitude:pos.coords.longitude,speed_knots:pos.coords.speed==null?null:Math.max(0,pos.coords.speed*1.943844),course_degrees:pos.coords.heading==null?null:((pos.coords.heading%360)+360)%360,satellites:null,fix_quality:"BROWSER HIGH ACCURACY GPS",source:"ADMIN DEVICE GPS",received_at:now,reporter_user_id:userId,accuracy_m:pos.coords.accuracy??null};
   const {data,error}=await supabase.from("vessel_gps_positions").upsert(payload,{onConflict:"unit_id"}).select("id,unit_id,position_at,latitude,longitude,speed_knots,course_degrees,satellites,fix_quality,source,received_at,accuracy_m,reporter_user_id").single();
   if(!active)return;
   if(error){setError("GPS perangkat admin gagal dibagikan: "+error.message);return}
   setGps(data);setLat(String(data.latitude));setLon(String(data.longitude));setPositionAt(now);setNotice("Master GPS diperbarui otomatis dari lokasi aktual perangkat admin dan dibagikan ke seluruh pengguna unit.");setError("");
  };
  const watchId=navigator.geolocation.watchPosition(publish,err=>{if(!active)return;setError(err.code===1?"Izin lokasi ditolak. Aktifkan Location Services dan izinkan akses lokasi untuk NAVYHUB.":err.code===2?"Lokasi perangkat belum tersedia. Periksa GPS dan layanan lokasi.":"GPS belum merespons. NAVYHUB akan mencoba kembali saat posisi tersedia.")},{enableHighAccuracy:true,maximumAge:0,timeout:25000});
  return()=>{active=false;navigator.geolocation.clearWatch(watchId)};
 },[canManage,unitId,userId,supabase]);
 const current=weather?.current,mc=marine?.current;
 const hourly=(marine?.hourly?.sea_level_height_msl||[]).filter((v:any)=>typeof v==="number"&&Number.isFinite(v));
 const low=hourly.length?Math.min(...hourly):null,high=hourly.length?Math.max(...hourly):null;
 const stale=gps?Date.now()-new Date(gps.position_at).getTime()>15*60*1000:false;
 const mapSrc=useMemo(()=>{
  const bbox="94.5%2C-11.5%2C141.5%2C6.5";
  const marker=gps?"&marker="+encodeURIComponent(Number(gps.latitude)+","+Number(gps.longitude)):"";
  return "https://www.openstreetmap.org/export/embed.html?bbox="+bbox+"&layer=mapnik"+marker;
 },[gps?.latitude,gps?.longitude]);
 async function saveGps(e:React.FormEvent){
  e.preventDefault();setNotice("");setError("");
  if(!canManage||!unitId||!userId)return;
  const a=Number(lat),o=Number(lon),s=speed===""?null:Number(speed),c=course===""?null:Number(course),sat=satellites===""?null:Number(satellites);
  if(!Number.isFinite(a)||a< -90||a>90||!Number.isFinite(o)||o< -180||o>180){setError("Koordinat lintang/bujur tidak valid.");return}
  if(s!==null&&(!Number.isFinite(s)||s<0)){setError("Kecepatan harus bernilai nol atau lebih.");return}
  if(c!==null&&(!Number.isFinite(c)||c<0||c>=360)){setError("Haluan harus berada pada rentang 0 sampai kurang dari 360 derajat.");return}
  if(sat!==null&&(!Number.isInteger(sat)||sat<0)){setError("Jumlah satelit harus bilangan bulat nol atau lebih.");return}
  setSaving(true);
  const payload={unit_id:unitId,position_at:new Date(positionAt).toISOString(),latitude:a,longitude:o,speed_knots:s,course_degrees:c,satellites:sat,fix_quality:"ADMIN REPORTED",source:"NAVYHUB ADMIN MASTER",received_at:new Date().toISOString(),reporter_user_id:userId};
  const {error}=await supabase.from("vessel_gps_positions").insert(payload);
  if(error)setError("Posisi GPS tidak tersimpan: "+error.message);
  else{setNotice("Master GPS unit berhasil diperbarui. Seluruh pengguna pada unit ini akan melihat posisi terbaru.");await load()}
  setSaving(false);
 }
 return <section className="navy-maritime">
  <div className="navy-map-shell">
   <div className="navy-map-top"><div><small>FLEET TRACKING · INDONESIAN ARCHIPELAGO</small><h2>Peta Maritim Indonesia</h2><p>Peta geografis OpenStreetMap · posisi dari master GPS NAVYHUB</p></div><div className={"navy-gps-state "+(gps?(stale?"stale":"live"):"offline")}><i/>{gps?(stale?"GPS DATA AGED":"GPS POSITION AVAILABLE"):"AWAITING GPS DATA"}</div></div>
   <div className="navy-map-canvas navy-map-real"><iframe title="Peta geografis Indonesia dengan posisi GPS kapal" src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>
    <div className="navy-map-coords">{gps?Number(gps.latitude).toFixed(5)+"°, "+Number(gps.longitude).toFixed(5)+"°":"MENUNGGU POSISI GPS"}</div>
    <div className="navy-map-legend"><span><i/> POSISI GPS KAPAL</span><span>OPENSTREETMAP · MAPNIK</span></div>
   </div>
   <div className="navy-map-footer"><span>UNIT · KRI ALAMANG-644</span><span>{gps?"Last position: "+stamp(gps.position_at):"Belum ada data posisi kapal"}</span><button onClick={load} disabled={loading}>{loading?"MEMUAT…":"↻ REFRESH"}</button><a href={gps?"https://www.openstreetmap.org/?mlat="+gps.latitude+"&mlon="+gps.longitude+"#map=7/"+gps.latitude+"/"+gps.longitude:"https://www.openstreetmap.org/#map=5/-2.5/118"} target="_blank" rel="noreferrer">BUKA PETA ↗</a></div>
  </div>
  <div className="navy-maritime-cards">
   <article className="navy-info-card"><div className="navy-info-head"><span>⌖</span><small>GPS · MASTER POSITION</small></div><b>{gps?fmt(gps.speed_knots)+" kn":"—"}</b><strong>{gps?"Kecepatan kapal":"Belum ada posisi GPS"}</strong><div className="navy-info-meta"><span>Haluan <b>{gps&&gps.course_degrees!=null?fmt(gps.course_degrees,0)+"°":"—"}</b></span><span>Satelit <b>{gps?.satellites??"—"}</b></span></div><small>{gps?"Diterima "+stamp(gps.received_at):"Menunggu input master GPS admin"}</small></article>
   <article className="navy-info-card"><div className="navy-info-head"><span>☼</span><small>WEATHER · VESSEL LOCATION</small></div><b>{current?fmt(current.temperature_2m,0)+"°C":"—"}</b><strong>{current?wx(current.weather_code):"Menunggu koordinat GPS"}</strong><div className="navy-info-meta"><span>Angin <b>{current?fmt(current.wind_speed_10m)+" km/j":"—"}</b></span><span>Hujan <b>{current?fmt(current.precipitation)+" mm":"—"}</b></span></div><small>{current?"Kelembapan "+current.relative_humidity_2m+"% · arah "+current.wind_direction_10m+"°":"Cuaca mengikuti koordinat master GPS"}</small></article>
   <article className="navy-info-card"><div className="navy-info-head"><span>≈</span><small>MARINE · SEA CONDITIONS</small></div><b>{mc?.sea_level_height_msl!=null?fmt(mc.sea_level_height_msl,2)+" m":"—"}</b><strong>Estimasi muka laut terhadap MSL</strong><div className="navy-info-meta"><span>Model tertinggi <b>{high==null?"—":fmt(high,2)+" m"}</b></span><span>Model terendah <b>{low==null?"—":fmt(low,2)+" m"}</b></span></div><small>Gelombang {mc?.wave_height==null?"—":fmt(mc.wave_height)+" m"} · Arus {mc?.ocean_current_velocity==null?"—":fmt(mc.ocean_current_velocity)+" m/s"}</small></article>
  </div>
  {canManage&&<details className="navy-gps-admin" open><summary><span>ADMIN MASTER · PENGATURAN POSISI GPS UNTUK SELURUH UNIT</span><small>Hanya Admin yang dapat memperbarui</small></summary><form onSubmit={saveGps}><div className="navy-gps-form-grid"><label>Latitude<input type="number" step="any" min="-90" max="90" value={lat} onChange={e=>setLat(e.target.value)} placeholder="-6.10" required/></label><label>Longitude<input type="number" step="any" min="-180" max="180" value={lon} onChange={e=>setLon(e.target.value)} placeholder="106.88" required/></label><label>Kecepatan (knots)<input type="number" step="any" min="0" value={speed} onChange={e=>setSpeed(e.target.value)} placeholder="Opsional"/></label><label>Haluan (0–359°)<input type="number" step="any" min="0" max="359.999" value={course} onChange={e=>setCourse(e.target.value)} placeholder="Opsional"/></label><label>Jumlah satelit<input type="number" step="1" min="0" value={satellites} onChange={e=>setSatellites(e.target.value)} placeholder="Opsional"/></label><label>Waktu posisi<input type="datetime-local" value={positionAt} onChange={e=>setPositionAt(e.target.value)} required/></label></div><div className="navy-gps-actions"><small>Admin memasukkan satu koordinat master untuk unit. Data terbaru otomatis dibaca oleh seluruh akun unit. Riwayat posisi lama tetap tersimpan.</small><button type="submit" disabled={saving}>{saving?"MENYIMPAN…":"SIMPAN MASTER GPS UNTUK SEMUA"}</button></div></form></details>}
  {!canManage&&<div className="navy-gps-note">MASTER GPS dikelola oleh Admin unit. Semua pengguna dapat memantau posisi terbaru yang sama.</div>}
  {error&&<div className="navy-status-error">{error}</div>}{notice&&<div className="navy-status-notice">{notice}</div>}
  <div className="navy-source-note">Peta dasar: OpenStreetMap (Mapnik), peta geografis interaktif dengan garis pantai dan pulau. Cuaca: Open-Meteo. Data laut adalah model maritim, bukan pengukuran pasang surut stasiun resmi. Peta ini bukan peta laut untuk navigasi; gunakan ENC/peta laut resmi dan publikasi keselamatan pelayaran untuk keputusan navigasi.</div>
 </section>
}
