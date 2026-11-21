"use client";
import {useEffect,useRef,useState} from "react";

type DevicePosition={latitude:number;longitude:number;accuracy:number;updatedAt:Date};

export default function VesselStatus(){
 const [position,setPosition]=useState<DevicePosition|null>(null);
 const [message,setMessage]=useState("GPS perangkat belum diaktifkan.");
 const [active,setActive]=useState(false);
 const watchRef=useRef<number|null>(null);

 const stop=()=>{
  if(typeof navigator!=="undefined"&&navigator.geolocation&&watchRef.current!==null){
   navigator.geolocation.clearWatch(watchRef.current);
  }
  watchRef.current=null;
  setActive(false);
  setMessage("Pembacaan GPS dihentikan pada perangkat ini.");
 };

 const start=()=>{
  if(typeof navigator==="undefined"||!navigator.geolocation){
   setMessage("Browser/perangkat ini tidak mendukung layanan lokasi.");
   return;
  }
  if(!window.isSecureContext){
   setMessage("GPS perangkat memerlukan koneksi HTTPS yang aman.");
   return;
  }
  if(watchRef.current!==null)return;
  setMessage("Meminta izin lokasi perangkat…");
  watchRef.current=navigator.geolocation.watchPosition(
   (result)=>{
    setPosition({
     latitude:result.coords.latitude,
     longitude:result.coords.longitude,
     accuracy:result.coords.accuracy,
     updatedAt:new Date(result.timestamp)
    });
    setActive(true);
    setMessage("Lokasi perangkat berhasil dibaca. Data hanya ditampilkan di perangkat ini.");
   },
   (error)=>{
    const messages:Record<number,string>={
     1:"Izin lokasi ditolak. Izinkan akses lokasi untuk NAVYHUB di pengaturan browser.",
     2:"Lokasi tidak tersedia. Periksa Location Services/GPS perangkat.",
     3:"Permintaan lokasi melewati batas waktu. Silakan coba lagi."
    };
    setMessage(messages[error.code]||"GPS perangkat tidak dapat diakses.");
    setActive(false);
    if(error.code===1){
     if(watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current);
     watchRef.current=null;
    }
   },
   {enableHighAccuracy:true,maximumAge:5000,timeout:20000}
  );
  setActive(true);
 };

 useEffect(()=>()=>{if(typeof navigator!=="undefined"&&navigator.geolocation&&watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current)},[]);

 return <section className="vessel-status">
  <div className="vessel-status-head">
   <div>
    <small>DEVICE SERVICES · LOCATION</small>
    <h3>GPS Perangkat</h3>
    <p>Membaca lokasi perangkat yang sedang membuka NAVYHUB setelah pengguna memberikan izin.</p>
   </div>
   <button onClick={active?stop:start}>{active?"Hentikan GPS":"Aktifkan GPS perangkat"}</button>
  </div>
  <div className="vessel-status-grid">
   <article className="vessel-status-card gps">
    <div className="vessel-status-card-head">
     <span>⌖</span><small>LOKASI PERANGKAT</small>
     <i className={active?"live":"offline"}>{active?"GPS AKTIF":"NONAKTIF"}</i>
    </div>
    {position?<>
     <b className="vessel-coordinates">{position.latitude.toFixed(6)}°, {position.longitude.toFixed(6)}°</b>
     <div className="vessel-gps-meta">
      <span>Akurasi <b>±{Math.round(position.accuracy)} m</b></span>
      <span>Status <b>{active?"Terhubung":"Terakhir terbaca"}</b></span>
     </div>
     <small>Pembaruan: {position.updatedAt.toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"medium"})}</small>
     <div style={{marginTop:14,borderRadius:14,overflow:"hidden"}}>
      <iframe title="Peta lokasi perangkat" width="100%" height="260" style={{border:0,display:"block"}} loading="lazy" src={"https://www.openstreetmap.org/export/embed.html?bbox="+(position.longitude-0.01)+","+(position.latitude-0.01)+","+(position.longitude+0.01)+","+(position.latitude+0.01)+"&layer=mapnik&marker="+position.latitude+","+position.longitude}/>
     </div>
    </>:<><b>Menunggu izin lokasi</b><p>Tekan Aktifkan GPS perangkat, lalu izinkan akses lokasi pada browser atau perangkat.</p></>}
    <small style={{display:"block",marginTop:12}}>{message}</small>
   </article>
   <article className="vessel-status-card">
    <div className="vessel-status-card-head"><span>ⓘ</span><small>PRIVASI & SUMBER DATA</small><i className="live">LOKAL</i></div>
    <b>Lokasi perangkat, bukan posisi kapal</b>
    <p>Koordinat berasal dari sensor lokasi perangkat/browser. NAVYHUB tidak mengirim koordinat ini ke database, tidak menganggapnya sebagai posisi KRI, dan tidak menggunakan data AIS.</p>
    <small>Ketepatan lokasi bergantung pada perangkat, izin browser, sinyal satelit, dan pengaturan layanan lokasi.</small>
   </article>
  </div>
 </section>;
}
