import {NextResponse} from "next/server";

export async function POST(request:Request){
  const expected=process.env.VESSEL_GPS_INGEST_TOKEN;
  if(!expected)return NextResponse.json({ok:false,error:"GPS ingest is not configured on this deployment."},{status:503});
  const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  if(!supplied||supplied!==expected)return NextResponse.json({ok:false,error:"Unauthorized GPS gateway."},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return NextResponse.json({ok:false,error:"Supabase connection is not configured."},{status:503});
  let body:any;
  try{body=await request.json()}catch{return NextResponse.json({ok:false,error:"Request body must be valid JSON."},{status:400})}
  const latitude=Number(body.latitude),longitude=Number(body.longitude);
  if(!Number.isFinite(latitude)||latitude < -90||latitude > 90||!Number.isFinite(longitude)||longitude < -180||longitude > 180){
    return NextResponse.json({ok:false,error:"Valid latitude and longitude are required."},{status:400});
  }
  const optionalNumber=(v:any)=>v===null||v===undefined||v===""?null:Number(v);
  const payload={
    p_token:supplied,
    p_latitude:latitude,
    p_longitude:longitude,
    p_speed_knots:optionalNumber(body.speed_knots),
    p_course_degrees:optionalNumber(body.course_degrees),
    p_satellites:body.satellites==null?null:Math.trunc(Number(body.satellites)),
    p_fix_quality:body.fix_quality==null?null:String(body.fix_quality).slice(0,80),
    p_position_at:body.position_at||new Date().toISOString(),
    p_source:String(body.source||"onboard_gps").slice(0,80)
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
