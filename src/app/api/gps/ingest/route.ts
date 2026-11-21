import {NextResponse} from "next/server";

type NmeaFix = {
  latitude:number; longitude:number; speed_knots:number|null; course_degrees:number|null;
  satellites:number|null; fix_quality:string|null; position_at:string|null;
};

function checksumOk(sentence:string){
  const star=sentence.indexOf("*");
  if(star<0)return true;
  const expected=sentence.slice(star+1,star+3).trim().toUpperCase();
  let sum=0;
  for(let i=1;i<star;i++)sum^=sentence.charCodeAt(i);
  return sum.toString(16).padStart(2,"0").toUpperCase()===expected;
}
function coordinate(raw:string,hemisphere:string,degreeDigits:number){
  if(!raw||!hemisphere)return null;
  const degrees=Number(raw.slice(0,degreeDigits));
  const minutes=Number(raw.slice(degreeDigits));
  if(!Number.isFinite(degrees)||!Number.isFinite(minutes)||minutes<0||minutes>=60)return null;
  let value=degrees+minutes/60;
  if(hemisphere==="S"||hemisphere==="W")value=-value;
  if(!["N","S","E","W"].includes(hemisphere))return null;
  return value;
}
function parseNmea(sentences:string[]):NmeaFix|null{
  let rmc:any=null,gga:any=null;
  for(const raw of sentences){
    const line=raw.trim();
    if(!line.startsWith("$")||!checksumOk(line))continue;
    const fields=line.slice(1).split("*")[0].split(",");
    const type=fields[0].slice(-3).toUpperCase();
    if(type==="RMC"&&fields[2]==="A")rmc=fields;
    if(type==="GGA"&&Number(fields[6])>0)gga=fields;
  }
  const source=rmc||gga;
  if(!source)return null;
  const lat=rmc?coordinate(rmc[3],rmc[4],2):coordinate(gga[2],gga[3],2);
  const lon=rmc?coordinate(rmc[5],rmc[6],3):coordinate(gga[4],gga[5],3);
  if(lat===null||lon===null)return null;
  let positionAt:string|null=null;
  if(rmc&&/^\\d{6}$/.test(rmc[9]||"")&&/^\\d{6}(\\.\\d+)?$/.test(rmc[1]||"")){
    const day=Number(rmc[9].slice(0,2)),month=Number(rmc[9].slice(2,4)),yy=Number(rmc[9].slice(4,6));
    const year=yy>=80?1900+yy:2000+yy;
    const hh=Number(rmc[1].slice(0,2)),mm=Number(rmc[1].slice(2,4)),ss=Number(rmc[1].slice(4,6));
    const date=new Date(Date.UTC(year,month-1,day,hh,mm,ss));
    if(date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day)positionAt=date.toISOString();
  }
  const speed=rmc&&rmc[7]!==""?Number(rmc[7]):null;
  const course=rmc&&rmc[8]!==""?Number(rmc[8]):null;
  const sats=gga&&gga[7]!==""?Number(gga[7]):null;
  const quality=gga?({1:"GPS fix",2:"DGPS fix",4:"RTK fixed",5:"RTK float"} as Record<number,string>)[Number(gga[6])]||("NMEA fix quality "+gga[6]):"RMC valid fix";
  return {latitude:lat,longitude:lon,speed_knots:speed!==null&&Number.isFinite(speed)?speed:null,course_degrees:course!==null&&Number.isFinite(course)?course:null,satellites:sats!==null&&Number.isFinite(sats)?Math.trunc(sats):null,fix_quality:quality,position_at:positionAt};
}

export async function POST(request:Request){
  const expected=process.env.VESSEL_GPS_INGEST_TOKEN;
  if(!expected)return NextResponse.json({ok:false,error:"GPS ingest is not configured on this deployment."},{status:503});
  const supplied=request.headers.get("authorization")?.replace(/^Bearer\\s+/i,"")||"";
  if(!supplied||supplied!==expected)return NextResponse.json({ok:false,error:"Unauthorized GPS gateway."},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return NextResponse.json({ok:false,error:"Supabase connection is not configured."},{status:503});
  let body:any;
  try{body=await request.json()}catch{return NextResponse.json({ok:false,error:"Request body must be valid JSON."},{status:400})}

  // Accept either already-parsed coordinates or raw NMEA 0183 RMC/GGA sentences.
  let fix:NmeaFix|null=null;
  const nmeaLines=typeof body.nmea==="string"?body.nmea.split(/\\r?\\n/):Array.isArray(body.nmea_sentences)?body.nmea_sentences.filter((x:any)=>typeof x==="string"):[];
  if(nmeaLines.length){
    fix=parseNmea(nmeaLines);
    if(!fix)return NextResponse.json({ok:false,error:"No valid NMEA 0183 RMC/GGA position fix was found. Check sentence status and checksum."},{status:422});
  }
  const latitude=Number(fix?.latitude??body.latitude),longitude=Number(fix?.longitude??body.longitude);
  if(!Number.isFinite(latitude)||latitude < -90||latitude > 90||!Number.isFinite(longitude)||longitude < -180||longitude > 180){
    return NextResponse.json({ok:false,error:"Valid latitude and longitude are required."},{status:400});
  }
  const optionalNumber=(v:any)=>v===null||v===undefined||v===""?null:Number(v);
  const payload={
    p_token:supplied,
    p_latitude:latitude,
    p_longitude:longitude,
    p_speed_knots:optionalNumber(fix?.speed_knots??body.speed_knots),
    p_course_degrees:optionalNumber(fix?.course_degrees??body.course_degrees),
    p_satellites:fix?.satellites??(body.satellites==null?null:Math.trunc(Number(body.satellites))),
    p_fix_quality:fix?.fix_quality??(body.fix_quality==null?null:String(body.fix_quality).slice(0,80)),
    p_position_at:fix?.position_at??body.position_at??new Date().toISOString(),
    p_source:String(body.source||(fix?"nmea0183_gateway":"onboard_gps")).slice(0,80)
  };
  if(payload.p_speed_knots!==null&&(!Number.isFinite(payload.p_speed_knots)||payload.p_speed_knots<0))return NextResponse.json({ok:false,error:"speed_knots must be a non-negative number."},{status:400});
  if(payload.p_course_degrees!==null&&(!Number.isFinite(payload.p_course_degrees)||payload.p_course_degrees<0||payload.p_course_degrees>360))return NextResponse.json({ok:false,error:"course_degrees must be between 0 and 360."},{status:400});
  if(payload.p_satellites!==null&&(!Number.isFinite(payload.p_satellites)||payload.p_satellites<0))return NextResponse.json({ok:false,error:"satellites must be a non-negative integer."},{status:400});
  const response=await fetch(url+"/rest/v1/rpc/ingest_vessel_gps",{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":key,"Authorization":"Bearer "+key},
    body:JSON.stringify(payload),
    cache:"no-store"
  });
  const text=await response.text();
  if(!response.ok)return NextResponse.json({ok:false,error:"GPS database rejected the update.",detail:text.slice(0,500)},{status:response.status});
  let result:any={ok:true};try{result=JSON.parse(text)}catch{}
  return NextResponse.json(result,{status:200});
}
