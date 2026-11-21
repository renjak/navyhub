"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type Props={supabase:any;unitId:string;userId:string;canManage:boolean;isPreview:boolean};
const wx=(n:number)=>({0:"Cerah",1:"Cerah berawan",2:"Berawan sebagian",3:"Berawan",45:"Kabut",48:"Kabut beku",51:"Gerimis ringan",53:"Gerimis",55:"Gerimis lebat",61:"Hujan ringan",63:"Hujan",65:"Hujan lebat",80:"Hujan lokal",81:"Hujan lokal sedang",82:"Hujan lokal lebat",95:"Badai petir",96:"Badai petir dan hujan es",99:"Badai petir kuat"} as Record<number,string>)[n]||"Kondisi tidak diketahui";
const fmt=(v:any,d=1)=>v==null?"—":Number(v).toFixed(d);
const stamp=(v:string)=>new Date(v).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"});
export default function VesselStatus({supabase,unitId,userId,canManage,isPreview}:Props){
 const [gps,setGps]=useState<any>(null),[weather,setWeather]=useState<any>(null),[marine,setMarine]=useState<any>(null);
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [lat,setLat]=useState(""),[lon,setLon]=useState(""),[speed,setSpeed]=useState(""),[course,setCourse]=useState(""),[satellites,setSatellites]=useState(""),[positionAt,setPositionAt]=useState(()=>new Date().toISOString().slice(0,16));
 const load=useCallback(async()=>{
  if(!unitId)return;setLoading(true);setError("");
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
 const marker=useMemo(()=>gps?{x:((Number(gps.longitude)-94)/(142-94))*100,y:((7-Number(gps.latitude))/(7+12))*100}:null,[gps]);
 const current=weather?.current,mc=marine?.current;
 const hourly=(marine?.hourly?.sea_level_height_msl||[]).filter((v:any)=>typeof v==="number"&&Number.isFinite(v));
 const low=hourly.length?Math.min(...hourly):null,high=hourly.length?Math.max(...hourly):null;
 const stale=gps?Date.now()-new Date(gps.position_at).getTime()>15*60*1000:false;
 async function saveGps(e:React.FormEvent){
  e.preventDefault();setNotice("");setError("");
  if(!canManage||isPreview||!unitId||!userId)return;
  const a=Number(lat),o=Number(lon),s=speed===""?null:Number(speed),c=course===""?null:Number(course),sat=satellites===""?null:Number(satellites);
  if(!Number.isFinite(a)||a< -90||a>90||!Number.isFinite(o)||o< -180||o>180){setError("Koordinat lintang/bujur tidak valid.");return}
  if(s!==null&&(!Number.isFinite(s)||s<0)){setError("Kecepatan harus bernilai nol atau lebih.");return}
  if(c!==null&&(!Number.isFinite(c)||c<0||c>=360)){setError("Haluan harus berada pada rentang 0 sampai kurang dari 360 derajat.");return}
  if(sat!==null&&(!Number.isInteger(sat)||sat<0)){setError("Jumlah satelit harus bilangan bulat nol atau lebih.");return}
  setSaving(true);
  const payload={unit_id:unitId,position_at:new Date(positionAt).toISOString(),latitude:a,longitude:o,speed_knots:s,course_degrees:c,satellites:sat,fix_quality:"ADMIN REPORTED",source:"NAVYHUB ADMIN MASTER",received_at:new Date().toISOString(),reporter_user_id:userId};
  const {error}=await supabase.from("vessel_gps_positions").insert(payload);
  if(error)setError("Posisi GPS tidak tersimpan: "+error.message);
  else{setNotice("Data posisi kapal berhasil disimpan sebagai master GPS. Peta, cuaca, dan data laut diperbarui.");await load()}
  setSaving(false);
 }
 return <section className="navy-maritime">
  <div className="navy-map-shell">
   <div className="navy-map-top"><div><small>FLEET TRACKING · INDONESIAN ARCHIPELAGO</small><h2>Indonesia Maritime Map</h2><p>Posisi kapal berdasarkan master GPS NAVYHUB</p></div><div className={"navy-gps-state "+(gps?(stale?"stale":"live"):"offline")}><i/>{gps?(stale?"GPS DATA AGED":"GPS POSITION AVAILABLE"):"AWAITING GPS DATA"}</div></div>
   <div className="navy-map-canvas">
    <div className="navy-map-grid"/>
    <svg viewBox="0 0 960 430" role="img" aria-label="Peta skematis Kepulauan Indonesia">
     <defs><linearGradient id="seaGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#163c56"/><stop offset="1" stopColor="#071725"/></linearGradient><filter id="islandGlow"><feGaussianBlur stdDeviation="5"/></filter></defs>
     <rect width="960" height="430" fill="url(#seaGlow)"/>
     <g fill="#6d9b91" stroke="#b4d5c8" strokeWidth="1.5" opacity=".9">
      <path d="M70 120 l35 -22 42 8 22 20 -8 19 -34 4 -28 21 -29 -8 -15 -20z M85 183 l24 -12 21 10 -8 22 -29 7z"/>
      <path d="M250 78 l35 -15 48 9 36 23 -9 24 -42 3 -21 18 -42 -8 -24 -25z M279 150 l22 -12 28 11 4 25 -26 10 -24 -13z"/>
      <path d="M350 190 l20 -13 26 12 17 28 -14 15 -33 -12z M390 240 l27 -10 24 14 -7 22 -33 8z"/>
      <path d="M470 130 l35 -16 38 10 22 25 -19 19 -45 -5 -26 -16z M520 183 l18 -12 21 15 -3 26 -21 9 -17 -19z"/>
      <path d="M615 95 l40 -16 48 14 22 26 -21 20 -55 -8 -36 -16z M690 170 l28 -11 31 18 -8 27 -39 7 -20 -19z"/>
      <path d="M760 260 l32 -18 42 9 30 26 -13 22 -49 4 -34 -17z M855 315 l20 -8 18 16 -7 15 -23 -3z"/>
      <path d="M160 285 l23 -15 35 10 24 22 -16 20 -37 -3 -28 -16z"/>
     </g>
     <g fill="none" stroke="#b7d8d0" strokeWidth="1" opacity=".45"><path d="M0 215 H960 M480 0 V430 M0 107 H960 M0 322 H960"/></g>
     {marker&&<g transform={"translate("+Math.max(12,Math.min(948,marker.x*9.6))+","+Math.max(12,Math.min(418,marker.y*4.3))+")"}><circle r="24" fill="#56d8ff" opacity=".15" filter="url(#islandGlow)"/><circle r="12" fill="none" stroke="#70e2ff" strokeWidth="2"><animate attributeName="r" values="8;22;8" dur="2.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.1;1" dur="2.5s" repeatCount="indefinite"/></circle><circle r="5" fill="#a8f2ff" stroke="#fff" strokeWidth="1.5"/></g>}
     <g fill="#d2e9f5" fontSize="12" letterSpacing="2" opacity=".8"><text x="90" y="55">SUMATERA</text><text x="270" y="48">KALIMANTAN</text><text x="420" y="285">JAWA</text><text x="565" y="75">SULAWESI</text><text x="760" y="235">PAPUA</text></g>
    </svg>
    <div className="navy-map-coords">{gps?Number(gps.latitude).toFixed(5)+"°, "+Number(gps.longitude).toFixed(5)+"°":"POSITION NOT AVAILABLE"}</div>
    <div className="navy-map-legend"><span><i/> POSISI GPS KAPAL</span><span>SCHEMATIC MAP · NOT FOR NAVIGATION</span></div>
   </div>
   <div className="navy-map-footer"><span>UNIT · KRI ALAMANG-644</span><span>{gps?"Last position: "+stamp(gps.position_at):"Belum ada data posisi kapal"}</span><button onClick={load} disabled={loading}>{loading?"MEMUAT…":"↻ REFRESH"}</button></div>
  </div>
  <div className="navy-maritime-cards">
   <article className="navy-info-card"><div className="navy-info-head"><span>⌖</span><small>GPS · MASTER POSITION</small></div><b>{gps?fmt(gps.speed_knots)+" kn":"—"}</b><strong>{gps?"Kecepatan kapal":"Belum ada posisi GPS"}</strong><div className="navy-info-meta"><span>Haluan <b>{gps&&gps.course_degrees!=null?fmt(gps.course_degrees,0)+"°":"—"}</b></span><span>Satelit <b>{gps?.satellites??"—"}</b></span></div><small>{gps?"Diterima "+stamp(gps.received_at):"Menunggu input master GPS admin"}</small></article>
   <article className="navy-info-card"><div className="navy-info-head"><span>☼</span><small>WEATHER · VESSEL LOCATION</small></div><b>{current?fmt(current.temperature_2m,0)+"°C":"—"}</b><strong>{current?wx(current.weather_code):"Menunggu koordinat GPS"}</strong><div className="navy-info-meta"><span>Angin <b>{current?fmt(current.wind_speed_10m)+" km/j":"—"}</b></span><span>Hujan <b>{current?fmt(current.precipitation)+" mm":"—"}</b></span></div><small>{current?"Kelembapan "+current.relative_humidity_2m+"% · arah "+current.wind_direction_10m+"°":"Cuaca mengikuti koordinat master GPS"}</small></article>
   <article className="navy-info-card"><div className="navy-info-head"><span>≈</span><small>MARINE · SEA CONDITIONS</small></div><b>{mc?.sea_level_height_msl!=null?fmt(mc.sea_level_height_msl,2)+" m":"—"}</b><strong>Estimasi muka laut terhadap MSL</strong><div className="navy-info-meta"><span>Model tertinggi <b>{high==null?"—":fmt(high,2)+" m"}</b></span><span>Model terendah <b>{low==null?"—":fmt(low,2)+" m"}</b></span></div><small>Gelombang {mc?.wave_height==null?"—":fmt(mc.wave_height)+" m"} · Arus {mc?.ocean_current_velocity==null?"—":fmt(mc.ocean_current_velocity)+" m/s"}</small></article>
  </div>
  {canManage&&!isPreview&&<details className="navy-gps-admin" open><summary><span>ADMIN MASTER · INPUT POSISI GPS KAPAL</span><small>Tambah laporan posisi baru</small></summary><form onSubmit={saveGps}><div className="navy-gps-form-grid"><label>Latitude<input type="number" step="any" min="-90" max="90" value={lat} onChange={e=>setLat(e.target.value)} placeholder="-6.10" required/></label><label>Longitude<input type="number" step="any" min="-180" max="180" value={lon} onChange={e=>setLon(e.target.value)} placeholder="106.88" required/></label><label>Kecepatan (knots)<input type="number" step="any" min="0" value={speed} onChange={e=>setSpeed(e.target.value)} placeholder="Opsional"/></label><label>Haluan (0–359°)<input type="number" step="any" min="0" max="359.999" value={course} onChange={e=>setCourse(e.target.value)} placeholder="Opsional"/></label><label>Jumlah satelit<input type="number" step="1" min="0" value={satellites} onChange={e=>setSatellites(e.target.value)} placeholder="Opsional"/></label><label>Waktu posisi<input type="datetime-local" value={positionAt} onChange={e=>setPositionAt(e.target.value)} required/></label></div><div className="navy-gps-actions"><small>Setiap penyimpanan membuat rekaman posisi baru. Data lama tidak ditimpa.</small><button type="submit" disabled={saving}>{saving?"MENYIMPAN…":"SIMPAN MASTER GPS"}</button></div></form></details>}
  {isPreview&&<div className="navy-gps-note">PREVIEW READ ONLY · Form master GPS dinonaktifkan karena preview masih menggunakan database produksi.</div>}
  {!canManage&&!isPreview&&<div className="navy-gps-note">MASTER GPS hanya dapat dikelola oleh akun ADMIN. Pengguna lain dapat memantau posisi kapal.</div>}
  {error&&<div className="navy-status-error">{error}</div>}{notice&&<div className="navy-status-notice">{notice}</div>}
  <div className="navy-source-note">Cuaca: Open-Meteo. Data laut dan muka laut: model maritim Open-Meteo, bukan pengukuran pasang surut stasiun resmi. Untuk keputusan navigasi, gunakan publikasi dan peringatan resmi BMKG/BIG serta peta laut yang berlaku. Peta di atas bersifat skematis, bukan peta navigasi.</div>
 </section>
}
