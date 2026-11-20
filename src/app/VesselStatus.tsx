"use client";
import {useCallback,useEffect,useState} from "react";
type Props={supabase:any;unitId:string};
const WIB="Asia/Jakarta";
const stamp=(v:string)=>new Date(v).toLocaleString("id-ID",{timeZone:WIB,day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const weatherLabel=(code:number)=>({0:"Cerah",1:"Cerah berawan",2:"Berawan sebagian",3:"Berawan",45:"Kabut",48:"Kabut beku",51:"Gerimis ringan",53:"Gerimis",55:"Gerimis lebat",61:"Hujan ringan",63:"Hujan",65:"Hujan lebat",80:"Hujan lokal",81:"Hujan lokal sedang",82:"Hujan lokal lebat",95:"Badai petir",96:"Badai petir dan hujan es",99:"Badai petir kuat"} as Record<number,string>)[code]||"Kondisi tidak diketahui";
export default function VesselStatus({supabase,unitId}:Props){
 const [gps,setGps]=useState<any>(null),[weather,setWeather]=useState<any>(null),[marine,setMarine]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{
  if(!unitId)return;setBusy(true);setError("");
  const {data,error:gError}=await supabase.from("vessel_gps_positions").select("*").eq("unit_id",unitId).order("position_at",{ascending:false}).limit(1).maybeSingle();
  if(gError){setError("Data GPS tidak dapat dibaca: "+gError.message);setGps(null);setWeather(null);setMarine(null);setBusy(false);return}
  setGps(data||null);
  if(!data){setWeather(null);setMarine(null);setBusy(false);return}
  if(Date.now()-new Date(data.position_at).getTime()>15*60*1000){setWeather(null);setMarine(null);setError("Koordinat GPS terakhir lebih dari 15 menit. Cuaca dan pasang surut tidak ditampilkan agar tidak menyesatkan.");setBusy(false);return}
  try{
   const lat=Number(data.latitude),lon=Number(data.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error("Koordinat GPS tidak valid.");
   const weatherUrl="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FJakarta";
   const marineUrl="https://marine-api.open-meteo.com/v1/marine?latitude="+lat+"&longitude="+lon+"&current=wave_height,sea_level_height_msl,ocean_current_velocity,ocean_current_direction&hourly=sea_level_height_msl&forecast_days=1&timezone=Asia%2FJakarta&cell_selection=sea";
   const [wr,mr]=await Promise.all([fetch(weatherUrl,{cache:"no-store"}),fetch(marineUrl,{cache:"no-store"})]);
   if(!wr.ok)throw new Error("Layanan prakiraan cuaca gagal merespons ("+wr.status+").");
   const wd=await wr.json();setWeather(wd);
   if(mr.ok)setMarine(await mr.json());else setMarine(null);
  }catch(e:any){setError(e?.message||"Data cuaca maritim tidak dapat dimuat.");setWeather(null);setMarine(null)}
  setBusy(false);
 },[supabase,unitId]);
 useEffect(()=>{load();const timer=window.setInterval(load,60000);return()=>window.clearInterval(timer)},[load]);
 const stale=gps?Date.now()-new Date(gps.position_at).getTime()>15*60*1000:false;
 const hourly=marine?.hourly?.sea_level_height_msl||[];
 const usable=hourly.filter((x:any)=>typeof x==="number"&&Number.isFinite(x));
 const tideLow=usable.length?Math.min(...usable):null,tideHigh=usable.length?Math.max(...usable):null;
 const current=weather?.current,marineCurrent=marine?.current;
 return <section className="vessel-status">
  <div className="vessel-status-head"><div><small>COMMAND CENTER · LIVE VESSEL DATA</small><h3>Status Kapal Hari Ini</h3><p>Koordinat GPS kapal menjadi acuan lokasi cuaca dan estimasi pasang surut.</p></div><button onClick={load} disabled={busy}>{busy?"Memperbarui...":"↻ Perbarui data"}</button></div>
  <div className="vessel-status-grid">
   <article className="vessel-status-card gps"><div className="vessel-status-card-head"><span>⌖</span><small>POSISI KAPAL · GPS</small><i className={gps?(stale?"stale":"live"):"offline"}>{gps?(stale?"DATA LAMA":"GPS FIX"):"BELUM TERHUBUNG"}</i></div>
    {gps?<><b className="vessel-coordinates">{Number(gps.latitude).toFixed(5)}°, {Number(gps.longitude).toFixed(5)}°</b><div className="vessel-gps-meta"><span>Kecepatan <b>{gps.speed_knots==null?"—":Number(gps.speed_knots).toFixed(1)+" kn"}</b></span><span>Haluan <b>{gps.course_degrees==null?"—":Number(gps.course_degrees).toFixed(0)+"°"}</b></span><span>Satelit <b>{gps.satellites??"—"}</b></span></div><small>Update GPS: {stamp(gps.position_at)} WIB · {gps.fix_quality||gps.source||"GPS"}</small></>:<><b>Menunggu sinyal GPS kapal</b><p>Belum ada koordinat GPS onboard yang masuk ke NAVYHUB. Sistem tidak menggunakan lokasi perangkat pengguna sebagai pengganti posisi kapal.</p></>}
   </article>
   <article className="vessel-status-card"><div className="vessel-status-card-head"><span>☼</span><small>CUACA DI POSISI KAPAL</small><i className={current?"live":"offline"}>{current?"MODEL TERBARU":"MENUNGGU GPS"}</i></div>
    {current?<><b className="vessel-weather-temp">{Math.round(current.temperature_2m)}°C</b><strong>{weatherLabel(current.weather_code)}</strong><div className="vessel-gps-meta"><span>Terasa <b>{Math.round(current.apparent_temperature)}°C</b></span><span>Angin <b>{Number(current.wind_speed_10m).toFixed(1)} km/jam</b></span><span>Hujan <b>{current.precipitation??0} mm</b></span></div><small>Kelembapan {current.relative_humidity_2m??"—"}% · Arah angin {current.wind_direction_10m??"—"}°</small></>:<><b>Belum tersedia</b><p>Prakiraan otomatis aktif setelah posisi GPS kapal tersedia.</p></>}
   </article>
   <article className="vessel-status-card"><div className="vessel-status-card-head"><span>≈</span><small>LAUT · PASANG SURUT</small><i className={marineCurrent?"live":"offline"}>{marineCurrent?"MODEL MARITIM":"MENUNGGU GPS"}</i></div>
    {marineCurrent?<><b className="vessel-weather-temp">{marineCurrent.sea_level_height_msl==null?"—":Number(marineCurrent.sea_level_height_msl).toFixed(2)+" m"}</b><strong>Tinggi muka laut model terhadap MSL</strong><div className="vessel-gps-meta"><span>Estimasi tertinggi <b>{tideHigh==null?"—":tideHigh.toFixed(2)+" m"}</b></span><span>Estimasi terendah <b>{tideLow==null?"—":tideLow.toFixed(2)+" m"}</b></span><span>Gelombang <b>{marineCurrent.wave_height==null?"—":Number(marineCurrent.wave_height).toFixed(1)+" m"}</b></span></div><small>Arus {marineCurrent.ocean_current_velocity==null?"—":Number(marineCurrent.ocean_current_velocity).toFixed(1)+" m/s"} · {marineCurrent.ocean_current_direction??"—"}°</small></>:<><b>Belum tersedia</b><p>Estimasi pasang surut menunggu koordinat GPS kapal.</p></>}
   </article>
  </div>
  {error&&<div className="vessel-status-error">{error}</div>}
  <div className="vessel-status-foot">Sumber prakiraan cuaca: Open-Meteo · <a href="https://maritim.bmkg.go.id/" target="_blank" rel="noreferrer">BMKG Maritim</a> untuk informasi dan peringatan resmi. Estimasi muka laut Open-Meteo adalah keluaran model, resolusi dan akurasinya terbatas di pesisir; bukan data ukur stasiun BIG dan bukan pengganti peta laut, tide table resmi, atau keputusan navigasi. {gps&&<span>Koordinat terakhir diterima {stamp(gps.received_at||gps.position_at)} WIB.</span>}</div>
 </section>;
}
