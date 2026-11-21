"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Props={supabase:any;unitId:string;userId:string};
const WIB="Asia/Jakarta";
const stamp=(v:string)=>new Date(v).toLocaleString("id-ID",{timeZone:WIB,day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"});
const weatherLabel=(code:number)=>({0:"Cerah",1:"Cerah berawan",2:"Berawan sebagian",3:"Berawan",45:"Kabut",48:"Kabut beku",51:"Gerimis ringan",53:"Gerimis",55:"Gerimis lebat",61:"Hujan ringan",63:"Hujan",65:"Hujan lebat",80:"Hujan lokal",81:"Hujan lokal sedang",82:"Hujan lokal lebat",95:"Badai petir",96:"Badai petir dan hujan es",99:"Badai petir kuat"} as Record<number,string>)[code]||"Kondisi tidak diketahui";
export default function VesselStatus({supabase,unitId,userId}:Props){
 const [gps,setGps]=useState<any>(null),[weather,setWeather]=useState<any>(null),[marine,setMarine]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sharing,setSharing]=useState(false),[gpsMessage,setGpsMessage]=useState("GPS perangkat belum diaktifkan.");
 const watchId=useRef<number|null>(null),lastSent=useRef(0);
 const load=useCallback(async()=>{
  if(!unitId)return;setBusy(true);
  const {data,error:gError}=await supabase.from("vessel_gps_positions").select("*").eq("unit_id",unitId).order("position_at",{ascending:false}).limit(1).maybeSingle();
  if(gError){setError("Data GPS tidak dapat dibaca: "+gError.message);setGps(null);setBusy(false);return}
  setGps(data||null);
  if(!data){setWeather(null);setMarine(null);setBusy(false);return}
  if(Date.now()-new Date(data.position_at).getTime()>15*60*1000){setWeather(null);setMarine(null);setError("Koordinat terakhir lebih dari 15 menit. Cuaca dan kondisi laut tidak ditampilkan agar tidak menyesatkan.");setBusy(false);return}
  try{
   const lat=Number(data.latitude),lon=Number(data.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error("Koordinat GPS tidak valid.");
   const wu="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FJakarta";
   const mu="https://marine-api.open-meteo.com/v1/marine?latitude="+lat+"&longitude="+lon+"&current=wave_height,sea_level_height_msl,ocean_current_velocity,ocean_current_direction&hourly=sea_level_height_msl&forecast_days=1&timezone=Asia%2FJakarta&cell_selection=sea";
   const [wr,mr]=await Promise.all([fetch(wu,{cache:"no-store"}),fetch(mu,{cache:"no-store"})]);
   if(!wr.ok)throw new Error("Layanan prakiraan cuaca gagal ("+wr.status+").");
   setWeather(await wr.json());setMarine(mr.ok?await mr.json():null);setError("");
  }catch(e:any){setError(e?.message||"Data cuaca maritim tidak dapat dimuat.");setWeather(null);setMarine(null)}
  setBusy(false);
 },[supabase,unitId]);
 useEffect(()=>{load();const t=window.setInterval(load,60000);return()=>window.clearInterval(t)},[load]);
 const stopSharing=()=>{if(watchId.current!==null&&typeof navigator!=="undefined"&&navigator.geolocation)navigator.geolocation.clearWatch(watchId.current);watchId.current=null;setSharing(false);setGpsMessage("Berbagi lokasi dihentikan pada perangkat ini.");};
 useEffect(()=>()=>{if(watchId.current!==null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId.current)},[]);
 const startSharing=()=>{
  if(!navigator.geolocation){setGpsMessage("Browser/perangkat ini tidak mendukung GPS lokasi.");return}
  if(!window.isSecureContext){setGpsMessage("GPS browser memerlukan koneksi HTTPS yang aman.");return}
  if(watchId.current!==null)return;
  setGpsMessage("Meminta izin lokasi perangkat…");
  watchId.current=navigator.geolocation.watchPosition(async pos=>{
   const now=Date.now();
   setSharing(true);setGpsMessage("GPS aktif · akurasi ±"+Math.round(pos.coords.accuracy)+" meter.");
   if(now-lastSent.current<30000)return;
   lastSent.current=now;
   const c=pos.coords;
   const {error:insertError}=await supabase.from("vessel_gps_positions").insert({
    unit_id:unitId,reporter_user_id:userId,position_at:new Date(pos.timestamp).toISOString(),
    latitude:c.latitude,longitude:c.longitude,
    speed_knots:c.speed==null?null:c.speed*1.943844,
    course_degrees:c.heading,accuracy_m:c.accuracy,
    fix_quality:"Browser GPS · ±"+Math.round(c.accuracy)+" m",
    source:"browser_device_gps"
   });
   if(insertError){setGpsMessage("Lokasi terdeteksi tetapi gagal dikirim: "+insertError.message);return}
   setGpsMessage("Posisi perangkat berhasil dikirim · ±"+Math.round(c.accuracy)+" m.");
   load();
  },err=>{
   const messages:Record<number,string>={1:"Izin lokasi ditolak. Izinkan Location untuk NAVYHUB melalui pengaturan browser.",2:"Lokasi tidak tersedia. Aktifkan Location Services/GPS perangkat.",3:"Permintaan lokasi timeout. Coba aktifkan kembali GPS."};
   setGpsMessage(messages[err.code]||"GPS perangkat mengalami kendala.");
   if(err.code===1)stopSharing();
  },{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
  setSharing(true);
 };
 const stale=gps?Date.now()-new Date(gps.position_at).getTime()>15*60*1000:false;
 const hourly=marine?.hourly?.sea_level_height_msl||[],usable=hourly.filter((x:any)=>typeof x==="number"&&Number.isFinite(x));
 const tideLow=usable.length?Math.min(...usable):null,tideHigh=usable.length?Math.max(...usable):null;
 const current=weather?.current,mc=marine?.current;
 return <section className="vessel-status">
  <div className="vessel-status-head"><div><small>COMMAND CENTER · LIVE VESSEL DATA</small><h3>Status Kapal Hari Ini</h3><p>Posisi diperbarui dari GPS perangkat personel yang diberi izin berbagi lokasi.</p></div><button onClick={load} disabled={busy}>{busy?"Memperbarui…":"↻ Perbarui data"}</button></div>
  <div className="vessel-status-grid">
   <article className="vessel-status-card gps"><div className="vessel-status-card-head"><span>⌖</span><small>POSISI KAPAL · GPS PERANGKAT</small><i className={gps?(stale?"stale":"live"):"offline"}>{gps?(stale?"DATA LAMA":"GPS TERCATAT"):"MENUNGGU GPS"}</i></div>
    {gps?<><b className="vessel-coordinates">{Number(gps.latitude).toFixed(5)}°, {Number(gps.longitude).toFixed(5)}°</b><div className="vessel-gps-meta"><span>Akurasi <b>{gps.accuracy_m==null?"—":"±"+Math.round(gps.accuracy_m)+" m"}</b></span><span>Kecepatan <b>{gps.speed_knots==null?"—":Number(gps.speed_knots).toFixed(1)+" kn"}</b></span><span>Haluan <b>{gps.course_degrees==null?"—":Number(gps.course_degrees).toFixed(0)+"°"}</b></span></div><small>Update: {stamp(gps.position_at)} WIB · {gps.source==="browser_device_gps"?"GPS perangkat pengguna":gps.fix_quality||gps.source||"GPS"}</small>{gps.reporter_user_id&&<small>Pelapor: {gps.reporter_user_id===userId?"Perangkat Anda":"Personel terdaftar"}</small>}</>:<><b>Belum ada posisi GPS</b><p>Aktifkan berbagi lokasi dari perangkat yang berada di kapal untuk mengirim koordinat.</p></>}
    <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(255,255,255,.12)"}}><button onClick={sharing?stopSharing:startSharing} style={{marginRight:10}}>{sharing?"Hentikan berbagi GPS":"Aktifkan GPS perangkat ini"}</button><small style={{display:"block",marginTop:9}}>{gpsMessage}</small><small style={{display:"block",marginTop:6,opacity:.75}}>Lokasi hanya dikirim setelah izin browser diberikan. Gunakan satu perangkat yang berada di kapal sebagai pelapor utama agar posisi kapal tidak tertimpa lokasi personel di darat.</small></div>
   </article>
   <article className="vessel-status-card"><div className="vessel-status-card-head"><span>☼</span><small>CUACA DI POSISI TERCATAT</small><i className={current?"live":"offline"}>{current?"MODEL TERBARU":"MENUNGGU GPS"}</i></div>{current?<><b className="vessel-weather-temp">{Math.round(current.temperature_2m)}°C</b><strong>{weatherLabel(current.weather_code)}</strong><div className="vessel-gps-meta"><span>Terasa <b>{Math.round(current.apparent_temperature)}°C</b></span><span>Angin <b>{Number(current.wind_speed_10m).toFixed(1)} km/jam</b></span><span>Hujan <b>{current.precipitation??0} mm</b></span></div><small>Kelembapan {current.relative_humidity_2m??"—"}% · Arah angin {current.wind_direction_10m??"—"}°</small></>:<><b>Belum tersedia</b><p>Prakiraan otomatis aktif setelah posisi GPS tersedia.</p></>}</article>
   <article className="vessel-status-card"><div className="vessel-status-card-head"><span>≈</span><small>LAUT · PASANG SURUT</small><i className={mc?"live":"offline"}>{mc?"MODEL MARITIM":"MENUNGGU GPS"}</i></div>{mc?<><b className="vessel-weather-temp">{mc.sea_level_height_msl==null?"—":Number(mc.sea_level_height_msl).toFixed(2)+" m"}</b><strong>Tinggi muka laut model terhadap MSL</strong><div className="vessel-gps-meta"><span>Estimasi tertinggi <b>{tideHigh==null?"—":tideHigh.toFixed(2)+" m"}</b></span><span>Estimasi terendah <b>{tideLow==null?"—":tideLow.toFixed(2)+" m"}</b></span><span>Gelombang <b>{mc.wave_height==null?"—":Number(mc.wave_height).toFixed(1)+" m"}</b></span></div><small>Arus {mc.ocean_current_velocity==null?"—":Number(mc.ocean_current_velocity).toFixed(1)+" m/s"} · {mc.ocean_current_direction??"—"}°</small></>:<><b>Belum tersedia</b><p>Estimasi pasang surut menunggu koordinat GPS.</p></>}</article>
  </div>
  {error&&<div className="vessel-status-error">{error}</div>}
  <div className="vessel-status-foot">Sumber prakiraan: Open-Meteo · <a href="https://maritim.bmkg.go.id/" target="_blank" rel="noreferrer">BMKG Maritim</a> untuk informasi dan peringatan resmi. Estimasi model bukan data ukur stasiun dan bukan pengganti peta laut, tide table resmi, atau keputusan navigasi. Lokasi yang diterima adalah lokasi perangkat pelapor, bukan sensor posisi kapal khusus.</div>
 </section>;
}
