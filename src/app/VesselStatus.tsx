"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type Props={supabase:any;unitId:string;userId:string;canManage:boolean};
const wx=(n:number)=>({0:"Cerah",1:"Cerah berawan",2:"Berawan sebagian",3:"Berawan",45:"Kabut",48:"Kabut beku",51:"Gerimis ringan",53:"Gerimis",55:"Gerimis lebat",61:"Hujan ringan",63:"Hujan",65:"Hujan lebat",80:"Hujan lokal",81:"Hujan lokal sedang",82:"Hujan lokal lebat",95:"Badai petir",96:"Badai petir dan hujan es",99:"Badai petir kuat"} as Record<number,string>)[n]||"Kondisi tidak diketahui";
const fmt=(v:any,d=1)=>v==null?"—":Number(v).toFixed(d);
const stamp=(v:string)=>new Date(v).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"});
export default function VesselStatus({supabase,unitId,userId,canManage}:Props){
 const [gps,setGps]=useState<any>(null),[weather,setWeather]=useState<any>(null),[marine,setMarine]=useState<any>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[mapOpen,setMapOpen]=useState(false);
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
 useEffect(()=>{load();const t=window.setInterval(load,30000);return()=>window.clearInterval(t)},[load]);
 const publishPosition=useCallback(async(pos:GeolocationPosition)=>{
  const now=new Date().toISOString();
  const payload={unit_id:unitId,position_at:now,latitude:pos.coords.latitude,longitude:pos.coords.longitude,speed_knots:pos.coords.speed==null?null:Math.max(0,pos.coords.speed*1.943844),course_degrees:pos.coords.heading==null?null:((pos.coords.heading%360)+360)%360,satellites:null,fix_quality:"BROWSER HIGH ACCURACY GPS",source:"ADMIN DEVICE GPS",received_at:now,reporter_user_id:userId,accuracy_m:pos.coords.accuracy??null};
  const {data,error}=await supabase.from("vessel_gps_positions").upsert(payload,{onConflict:"unit_id"}).select("id,unit_id,position_at,latitude,longitude,speed_knots,course_degrees,satellites,fix_quality,source,received_at,accuracy_m,reporter_user_id").single();
  if(error){setError("GPS perangkat admin gagal dibagikan: "+error.message);return}
  setGps(data);setNotice("Master GPS diperbarui otomatis setiap 30 detik dari lokasi perangkat admin dan dibagikan ke seluruh pengguna unit.");setError("");
 },[supabase,unitId,userId]);
 const geoError=useCallback((err:GeolocationPositionError)=>{
  setError(err.code===1?"Izin lokasi ditolak. Aktifkan Location Services dan pilih Allow untuk NAVYHUB pada pengaturan browser.":err.code===2?"Lokasi perangkat belum tersedia. Periksa GPS dan layanan lokasi.":"GPS belum merespons. NAVYHUB akan mencoba kembali dalam 30 detik.");
 },[]);
 useEffect(()=>{
  if(!canManage||!unitId||!userId||typeof navigator==="undefined"||!navigator.geolocation)return;
  let active=true;
  const requestPosition=()=>{
   if(!active)return;
   navigator.geolocation.getCurrentPosition(pos=>{if(active)void publishPosition(pos)},err=>{if(active)geoError(err)},{enableHighAccuracy:true,maximumAge:0,timeout:25000});
  };
  requestPosition();
  const timer=window.setInterval(requestPosition,30000);
  return()=>{active=false;window.clearInterval(timer)};
 },[canManage,unitId,userId,publishPosition,geoError]);
 const current=weather?.current,mc=marine?.current;
 const hourly=(marine?.hourly?.sea_level_height_msl||[]).filter((v:any)=>typeof v==="number"&&Number.isFinite(v));
 const low=hourly.length?Math.min(...hourly):null,high=hourly.length?Math.max(...hourly):null;
 const stale=gps?Date.now()-new Date(gps.position_at).getTime()>15*60*1000:false;
 const mapSrc=useMemo(()=>{
  const bbox="94.5%2C-11.5%2C141.5%2C6.5";
  const marker=gps?"&marker="+encodeURIComponent(Number(gps.latitude)+","+Number(gps.longitude)):"";
  return "https://www.openstreetmap.org/export/embed.html?bbox="+bbox+"&layer=mapnik"+marker;
 },[gps?.latitude,gps?.longitude]);
  return <section className="navy-maritime">
  {mapOpen&&<div className="navy-map-modal" role="dialog" aria-modal="true" aria-label="Peta maritim Indonesia" onClick={e=>{if(e.target===e.currentTarget)setMapOpen(false)}}><div className="navy-map-dialog"><div className="navy-map-shell">
   <div className="navy-map-top"><div><small>FLEET TRACKING · INDONESIAN ARCHIPELAGO</small><h2>Peta Maritim Indonesia</h2><p>Peta geografis OpenStreetMap · posisi dari master GPS NAVYHUB</p></div><div className="navy-map-top-actions"><div className={"navy-gps-state "+(gps?(stale?"stale":"live"):"offline")}><i/>{gps?(stale?"GPS DATA AGED":"GPS POSITION AVAILABLE"):"AWAITING GPS DATA"}</div><button type="button" className="navy-map-close" onClick={()=>setMapOpen(false)} aria-label="Tutup peta">✕</button></div></div>
   <div className="navy-map-canvas navy-map-real"><iframe title="Peta geografis Indonesia dengan posisi GPS kapal" src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>
    <div className="navy-map-coords">{gps?Number(gps.latitude).toFixed(5)+"°, "+Number(gps.longitude).toFixed(5)+"°":"MENUNGGU POSISI GPS"}</div>
    <div className="navy-map-legend"><span><i/> POSISI GPS KAPAL</span><span>OPENSTREETMAP · MAPNIK</span></div>
   </div>
   <div className="navy-map-footer"><span>UNIT · KRI ALAMANG-644</span><span>{gps?"Last position: "+stamp(gps.position_at):"Belum ada data posisi kapal"}</span><button onClick={load} disabled={loading}>{loading?"MEMUAT…":"↻ REFRESH"}</button><a href={gps?"https://www.openstreetmap.org/?mlat="+gps.latitude+"&mlon="+gps.longitude+"#map=7/"+gps.latitude+"/"+gps.longitude:"https://www.openstreetmap.org/#map=5/-2.5/118"} target="_blank" rel="noreferrer">BUKA PETA ↗</a></div>
  </div></div></div>}
  <div className="navy-maritime-cards">
   <button type="button" className="navy-info-card navy-coordinate-card" onClick={()=>setMapOpen(true)} aria-label="Buka peta Indonesia berdasarkan koordinat GPS"><div className="navy-info-head"><span>⌖</span><small>GPS · KOORDINAT KAPAL</small><i>BUKA PETA ↗</i></div><b className="navy-coordinate-value">{gps?Number(gps.latitude).toFixed(5)+"°, "+Number(gps.longitude).toFixed(5)+"°":"—"}</b><strong>{gps?"Koordinat master GPS · KRI ALAMANG-644":"Belum ada posisi GPS"}</strong><div className="navy-info-meta"><span>Kecepatan <b>{gps?fmt(gps.speed_knots)+" kn":"—"}</b></span><span>Haluan <b>{gps&&gps.course_degrees!=null?fmt(gps.course_degrees,0)+"°":"—"}</b></span></div><small>{gps?"Diperbarui "+stamp(gps.position_at):"Menunggu izin lokasi dan sinyal GPS perangkat admin"} · Tekan untuk membuka peta</small></button>
   <article className="navy-info-card"><div className="navy-info-head"><span>☼</span><small>WEATHER · VESSEL LOCATION</small></div><b>{current?fmt(current.temperature_2m,0)+"°C":"—"}</b><strong>{current?wx(current.weather_code):"Menunggu koordinat GPS"}</strong><div className="navy-info-meta"><span>Angin <b>{current?fmt(current.wind_speed_10m)+" km/j":"—"}</b></span><span>Hujan <b>{current?fmt(current.precipitation)+" mm":"—"}</b></span></div><small>{current?"Kelembapan "+current.relative_humidity_2m+"% · arah "+current.wind_direction_10m+"°":"Cuaca mengikuti koordinat master GPS"}</small></article>
   <article className="navy-info-card"><div className="navy-info-head"><span>≈</span><small>MARINE · SEA CONDITIONS</small></div><b>{mc?.sea_level_height_msl!=null?fmt(mc.sea_level_height_msl,2)+" m":"—"}</b><strong>Estimasi muka laut terhadap MSL</strong><div className="navy-info-meta"><span>Model tertinggi <b>{high==null?"—":fmt(high,2)+" m"}</b></span><span>Model terendah <b>{low==null?"—":fmt(low,2)+" m"}</b></span></div><small>Gelombang {mc?.wave_height==null?"—":fmt(mc.wave_height)+" m"} · Arus {mc?.ocean_current_velocity==null?"—":fmt(mc.ocean_current_velocity)+" m/s"}</small></article>
  </div>
  {canManage&&<div className="navy-gps-admin"><strong>ADMIN MASTER GPS · AUTO REFRESH 30 DETIK</strong><p>Admin diminta mengizinkan akses lokasi perangkat. Setelah izin diberikan, NAVYHUB mengambil posisi otomatis setiap 30 detik dan membagikannya sebagai master GPS untuk seluruh akun unit.</p><small>{gps?"PELACAKAN OTOMATIS AKTIF · PEMBARUAN SETIAP 30 DETIK":"MENUNGGU IZIN / SINYAL GPS PERANGKAT ADMIN"}</small><button type="button" onClick={()=>{if(typeof navigator!=="undefined"&&navigator.geolocation)navigator.geolocation.getCurrentPosition(pos=>void publishPosition(pos),geoError,{enableHighAccuracy:true,maximumAge:0,timeout:25000})}}>IZINKAN / AKTIFKAN LOKASI</button></div>}
  {!canManage&&<div className="navy-gps-note">MASTER GPS dikelola oleh Admin unit. Semua pengguna dapat memantau posisi terbaru yang sama.</div>}
  {error&&<div className="navy-status-error">{error}</div>}{notice&&<div className="navy-status-notice">{notice}</div>}
  <div className="navy-source-note">Peta dasar: OpenStreetMap (Mapnik), peta geografis interaktif dengan garis pantai dan pulau. Cuaca: Open-Meteo. Data laut adalah model maritim, bukan pengukuran pasang surut stasiun resmi. Peta ini bukan peta laut untuk navigasi; gunakan ENC/peta laut resmi dan publikasi keselamatan pelayaran untuk keputusan navigasi.</div>
 </section>
}
