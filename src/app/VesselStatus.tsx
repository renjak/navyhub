"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type PositionRow={latitude:number;longitude:number;accuracy_m:number|null;position_at:string;reporter_user_id:string|null};

type Props={supabase:any;unitId:string;userId:string;isAdmin:boolean};

export default function VesselStatus({supabase,unitId,userId,isAdmin}:Props){
 const [position,setPosition]=useState<PositionRow|null>(null);
 const [message,setMessage]=useState(isAdmin?"GPS admin belum diaktifkan.":"Menunggu posisi kapal dari akun admin.");
 const [active,setActive]=useState(false);
 const [loading,setLoading]=useState(true);
 const watchRef=useRef<number|null>(null);
 const lastSentRef=useRef<number>(0);

 const loadLatest=useCallback(async()=>{
  if(!unitId)return;
  const {data,error}=await supabase.from("vessel_gps_positions")
   .select("latitude,longitude,accuracy_m,position_at,reporter_user_id")
   .eq("unit_id",unitId).order("position_at",{ascending:false}).limit(1).maybeSingle();
  if(!error&&data)setPosition(data);
  if(error)setMessage("Gagal membaca posisi kapal dari database.");
  setLoading(false);
 },[supabase,unitId]);

 useEffect(()=>{
  loadLatest();
  const poll=window.setInterval(loadLatest,15000);
  return()=>window.clearInterval(poll);
 },[loadLatest]);

 const stop=()=>{
  if(typeof navigator!=="undefined"&&navigator.geolocation&&watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current);
  watchRef.current=null;setActive(false);setMessage("Pengiriman posisi kapal dihentikan oleh admin.");
 };

 const start=()=>{
  if(!isAdmin){setMessage("Hanya akun ADMIN yang dapat menjadi sumber posisi kapal.");return;}
  if(!unitId||!userId){setMessage("Profil admin belum siap. Muat ulang halaman.");return;}
  if(typeof navigator==="undefined"||!navigator.geolocation){setMessage("Perangkat/browser tidak mendukung layanan lokasi.");return;}
  if(!window.isSecureContext){setMessage("GPS memerlukan koneksi HTTPS yang aman.");return;}
  if(watchRef.current!==null)return;
  setMessage("Meminta izin GPS dari perangkat admin…");
  watchRef.current=navigator.geolocation.watchPosition(async(result)=>{
   setActive(true);
   const now=Date.now();
   if(now-lastSentRef.current<15000)return;
   lastSentRef.current=now;
   const payload={
    unit_id:unitId,
    reporter_user_id:userId,
    latitude:result.coords.latitude,
    longitude:result.coords.longitude,
    accuracy_m:result.coords.accuracy,
    position_at:new Date(result.timestamp).toISOString(),
    source:"admin_device_gps",
    fix_quality:"browser_geolocation"
   };
   const {error}=await supabase.from("vessel_gps_positions").insert(payload);
   if(error){setMessage("GPS terbaca, tetapi database menolak penyimpanan posisi. Periksa hak akses admin.");return;}
   setPosition({...payload});
   setMessage("Posisi kapal berhasil diperbarui dari GPS perangkat admin.");
  },(error)=>{
   const messages:Record<number,string>={1:"Izin lokasi ditolak. Izinkan akses lokasi untuk NAVYHUB.",2:"Lokasi perangkat tidak tersedia. Periksa GPS perangkat admin.",3:"Permintaan GPS melewati batas waktu. Coba lagi."};
   setMessage(messages[error.code]||"GPS perangkat admin tidak dapat diakses.");
   setActive(false);
   if(error.code===1){if(watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current);watchRef.current=null;}
  },{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
  setActive(true);
 };

 useEffect(()=>()=>{if(typeof navigator!=="undefined"&&navigator.geolocation&&watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current)},[]);

 const age=position?Date.now()-new Date(position.position_at).getTime():Infinity;
 const stale=age>120000;
 const coords=position?position.latitude.toFixed(6)+", "+position.longitude.toFixed(6):"Belum tersedia";

 return <section className="vessel-status">
  <div className="vessel-status-head"><div><small>COMMAND CENTER · SHIP POSITION</small><h3>Posisi KRI Alamang-644</h3><p>Satu sumber posisi resmi: GPS perangkat dari akun ADMIN.</p></div>
   {isAdmin&&<button onClick={active?stop:start}>{active?"Hentikan GPS Admin":"Aktifkan GPS Admin"}</button>}
  </div>
  <div className="vessel-status-grid">
   <article className="vessel-status-card gps">
    <div className="vessel-status-card-head"><span>⌖</span><small>POSISI KAPAL · SUMBER ADMIN</small><i className={position&&!stale?"live":"offline"}>{!position?"BELUM ADA DATA":stale?"DATA LAMA":active&&isAdmin?"GPS AKTIF":"POSISI TERSIMPAN"}</i></div>
    {position?<><b className="vessel-coordinates">{coords}</b><div className="vessel-gps-meta"><span>Akurasi <b>{position.accuracy_m==null?"—":"±"+Math.round(position.accuracy_m)+" m"}</b></span><span>Status <b>{stale?"Tidak diperbarui": "Tersedia"}</b></span></div><small>Pembaruan: {new Date(position.position_at).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"medium"})}</small><div style={{marginTop:14,borderRadius:14,overflow:"hidden"}}><iframe title="Peta posisi KRI Alamang-644" width="100%" height="260" style={{border:0,display:"block"}} loading="lazy" src={"https://www.openstreetmap.org/export/embed.html?bbox="+(position.longitude-0.01)+","+(position.latitude-0.01)+","+(position.longitude+0.01)+","+(position.latitude+0.01)+"&layer=mapnik&marker="+position.latitude+","+position.longitude}/></div></>:<><b>{loading?"Memuat posisi…":"Menunggu posisi admin"}</b><p>Posisi kapal akan tampil setelah admin mengaktifkan GPS dari perangkat yang berada di kapal.</p></>}
    <small style={{display:"block",marginTop:12}}>{message}</small>
   </article>
   <article className="vessel-status-card"><div className="vessel-status-card-head"><span>ⓘ</span><small>SUMBER & OTORISASI</small><i className="live">ADMIN ONLY</i></div><b>{isAdmin?"Akun ini menjadi sumber posisi kapal":"Posisi dibagikan oleh akun admin"}</b><p>{isAdmin?"Hanya akun dengan role admin yang dapat mengaktifkan GPS dan mengirim koordinat. Pastikan perangkat admin berada di atas kapal.":"Akun ini hanya membaca posisi terakhir yang dikirim akun admin. Akun non-admin tidak dapat mengubah atau mengirim posisi kapal."}</p><small>GPS kapal eksternal dan AIS tidak digunakan. Data posisi dibagikan melalui database sesuai unit kapal.</small></article>
  </div>
 </section>;
}
