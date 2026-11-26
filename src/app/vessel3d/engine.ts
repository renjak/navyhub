// @ts-nocheck
/* WebGL2 renderer for the KRI ALAMANG-644 model in the ALNAV DMS 3D module.
   No dependencies. The hull is lofted from the general-arrangement lines; see data.ts for ship data.
   createEngine returns null when WebGL2 is unavailable so the caller can show a fallback. */
import { ROOMS, TANKS, PART, PARTS } from "./data";

export type EngineMarker = { key: string; label: string; col: string; p?: number[]; w?: number[]; r?: string; lb?: boolean; sel?: boolean; pulse?: boolean };
export type EngineState = { mode?: string; part?: string | null; roomTints?: Record<string, number[]>; tanks?: Record<string, number>; faultParts?: string[]; nav?: { cog: number | null; sog: number }; markers?: EngineMarker[]; ringOn?: boolean };
export type EngineOptions = { marks: HTMLElement; reducedMotion?: boolean; getPads?: () => { L?: number; R?: number; T?: number; B?: number }; onMarker?: (key: string) => void; onLost?: () => void };
export type Engine = { set: (s: EngineState) => void; view: (animate?: boolean) => void; destroy: () => void };

export function createEngine(cv: HTMLCanvasElement, opts: EngineOptions): Engine | null {
const gl=cv.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
if(!gl)return null;
/* ---------- vector + matrix ---------- */
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],scl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]};
const lerp=(a,b,t)=>a+(b-a)*t,lerp3=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const M={
 id(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m},
 mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o},
 persp(f,a,n,fa){const t=1/Math.tan(f/2),o=new Float32Array(16);o[0]=t/a;o[5]=t;o[10]=(fa+n)/(n-fa);o[11]=-1;o[14]=2*fa*n/(n-fa);return o},
 ortho(l,r,b,t,n,f){const o=new Float32Array(16);o[0]=2/(r-l);o[5]=2/(t-b);o[10]=-2/(f-n);o[12]=-(r+l)/(r-l);o[13]=-(t+b)/(t-b);o[14]=-(f+n)/(f-n);o[15]=1;return o},
 view(r,u,d,e){return new Float32Array([r[0],u[0],d[0],0,r[1],u[1],d[1],0,r[2],u[2],d[2],0,-dot(r,e),-dot(u,e),-dot(d,e),1])},
 tr(x,y,z){const m=M.id();m[12]=x;m[13]=y;m[14]=z;return m},
 rx(a){const m=M.id(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m},
 ry(a){const m=M.id(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m},
 rz(a){const m=M.id(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m},
 xf(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]},
 x4(m,p){return [0,1,2,3].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i])},
 chain(...ms){return ms.reduce((a,b)=>M.mul(a,b))}
};

/* ---------- geometry builder (ship coords: x from stern, y to port, z up) ---------- */
let XF=null,CUR=null;
let RAW=false;const W=p=>{if(XF)p=M.xf(XF,p);return RAW?[p[0],p[1],p[2]]:[p[0]-22,p[2],-p[1]]};
const newG=()=>({p:[],n:[],c:[],t:[]});
function tri(a,b,c,col,ta,tb,tc){
 const A=W(a),B=W(b),C=W(c);
 const n=crs(sub(B,A),sub(C,A)),l=Math.hypot(n[0],n[1],n[2]);if(l<1e-10)return;
 CUR.p.push(...A,...B,...C);for(let i=0;i<3;i++){CUR.n.push(n[0]/l,n[1]/l,n[2]/l);CUR.c.push(col[0],col[1],col[2],col[3]??1)}
 if(ta)CUR.t.push(...ta,...tb,...tc);
}
function quad(a,b,c,d,col,uv){if(uv){tri(a,b,c,col,uv[0],uv[1],uv[2]);tri(a,c,d,col,uv[0],uv[2],uv[3])}else{tri(a,b,c,col);tri(a,c,d,col)}}
function cap(r,col){const c=[0,0,0];r.forEach(p=>{c[0]+=p[0];c[1]+=p[1];c[2]+=p[2]});const k=1/r.length;const cc=scl(c,k);for(let j=0;j<r.length;j++)tri(cc,r[j],r[(j+1)%r.length],col)}
function loft(R,col,o={}){
 const m=R[0].length,segs=o.closed?m:m-1;
 for(let i=0;i<R.length-1;i++)for(let j=0;j<segs;j++){if(o.skip&&o.skip(i,j))continue;const j2=(j+1)%m;quad(R[i][j],R[i][j2],R[i+1][j2],R[i+1][j],o.cf?o.cf(i,j):col)}
 if(o.capA)cap(R[0],o.capCol||col);if(o.capB)cap(R[R.length-1],o.capCol||col);
}
function prism(bot,top,z0,z1,col,o={}){loft([bot.map(p=>[p[0],p[1],z0]),top.map(p=>[p[0],p[1],z1])],col,{closed:true,capA:o.capA!==false,capB:o.capB!==false})}
const rectP=(x0,x1,y0,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
const chamf=(x0,x1,y0,y1,c)=>[[x0+c,y0],[x1-c,y0],[x1,y0+c],[x1,y1-c],[x1-c,y1],[x0+c,y1],[x0,y1-c],[x0,y0+c]];
function box(x0,x1,y0,y1,z0,z1,col){const r=rectP(x0,x1,y0,y1);prism(r,r,z0,z1,col)}
function en(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);return [dy/l,-dx/l]}
function offs(poly,d){const n=poly.length;return poly.map((b,i)=>{const a=poly[(i-1+n)%n],c=poly[(i+1)%n],n1=en(a,b),n2=en(b,c),s=1+n1[0]*n2[0]+n1[1]*n2[1];return [b[0]+(n1[0]+n2[0])/s*d,b[1]+(n1[1]+n2[1])/s*d]})}
function frame(a){const h=Math.abs(a[2])<0.9?[0,0,1]:[1,0,0];const u=nrm(crs(a,h));return [u,crs(a,u)]}
function cyl(p0,p1,r0,col,o={}){
 const r1=o.r1??r0,seg=o.seg||20,a=nrm(sub(p1,p0)),[u,v]=frame(a);
 const ring=(p,r)=>{const R=[];for(let k=0;k<seg;k++){const t=k/seg*Math.PI*2;R.push(add(p,add(scl(u,r*Math.cos(t)),scl(v,r*Math.sin(t)))))}return R};
 loft([ring(p0,r0),ring(p1,r1)],col,{closed:true,capA:o.caps!==false,capB:o.caps!==false});
}
function tube(path,r,col,seg=10,closedPath=false){
 const R=path.map((p,i)=>{const n=path.length;const pa=path[closedPath?(i-1+n)%n:Math.max(i-1,0)],pb=path[closedPath?(i+1)%n:Math.min(i+1,n-1)];const [u,v]=frame(nrm(sub(pb,pa)));const ring=[];for(let k=0;k<seg;k++){const t=k/seg*Math.PI*2;ring.push(add(p,add(scl(u,r*Math.cos(t)),scl(v,r*Math.sin(t)))))}return ring});
 if(closedPath)R.push(R[0]);
 loft(R,col,{closed:true,capA:!closedPath,capB:!closedPath});
}
function dome(c,r,col,lat=8,lon=20){const R=[];for(let i=0;i<=lat;i++){const a=Math.PI/2*i/lat,ring=[];for(let k=0;k<lon;k++){const b=k/lon*Math.PI*2;ring.push([c[0]+r*Math.cos(a)*Math.cos(b),c[1]+r*Math.cos(a)*Math.sin(b),c[2]+r*Math.sin(a)])}R.push(ring)}loft(R,col,{closed:true,capA:true})}
/* flat decal on a planar face: a,b bottom edge, a2,b2 top edge */
function faceDecal(a,b,a2,b2,u0,u1,v0,v1,ctr,col=[1,1,1,1]){
 const P=(u,v)=>lerp3(lerp3(a,b,u),lerp3(a2,b2,u),v);
 let n=nrm(crs(sub(b,a),sub(a2,a)));const mid=P((u0+u1)/2,(v0+v1)/2);if(dot(n,sub(mid,ctr))<0)n=scl(n,-1);
 const o=scl(n,0.012),q=[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)].map(p=>add(p,o));
 quad(q[0],q[1],q[2],q[3],col,[[0,0],[1,0],[1,1],[0,1]]);
}
/* conforming decal on a surface given by y=f(x,z) on either side */
function sideDecal(x0,x1,z0,z1,side,f,nx=10,nz=3){
 const P=(i,k)=>{const x=lerp(x0,x1,i/nx),z=lerp(z0,z1,k/nz);return [x,side*(f(x,z)+0.014),z]};
 const U=(i,k)=>[side>0?1-i/nx:i/nx,k/nz];
 for(let i=0;i<nx;i++)for(let k=0;k<nz;k++)quad(P(i,k),P(i+1,k),P(i+1,k+1),P(i,k+1),[1,1,1,1],[U(i,k),U(i+1,k),U(i+1,k+1),U(i,k+1)]);
}

/* ---------- colours ---------- */
const C={hull:[.64,.67,.70,1],paint:[.64,.67,.70,0],sup:[.70,.73,.755,1],deck:[.34,.36,.38,1],mid:[.5,.53,.56,1],dark:[.2,.21,.23,1],black:[.08,.085,.09,1],
 gun:[.47,.5,.53,1],rhib:[.16,.17,.18,1],orange:[.93,.42,.15,1],red:[.85,.08,.12,1],green:[.1,.62,.28,1],white:[.92,.93,.94,1],bronze:[.74,.56,.3,1],raft:[.9,.91,.92,1]};

/* ---------- hull lines (from the side, front and top views) ---------- */
let STEM=[[0,36.7],[0.7,39.0],[1.58,40.37],[2.96,42.0],[4.08,43.76],[4.3,44.0]];
(function(){const o=[];for(let i=0;i<STEM.length-1;i++){const p0=STEM[Math.max(i-1,0)],p1=STEM[i],p2=STEM[i+1],p3=STEM[Math.min(i+2,STEM.length-1)];for(let k=0;k<8;k++){const t=k/8,t2=t*t,t3=t2*t;o.push([0,1].map(d=>.5*(2*p1[d]+(-p0[d]+p2[d])*t+(2*p0[d]-5*p1[d]+4*p2[d]-p3[d])*t2+(-p0[d]+3*p1[d]-3*p2[d]+p3[d])*t3)))}}o.push(STEM[STEM.length-1]);for(let i=1;i<o.length;i++){o[i][0]=Math.max(o[i][0],o[i-1][0]+1e-4);o[i][1]=Math.max(o[i][1],o[i-1][1]+1e-4)}STEM=o})();
function tab(v,ki,ko){if(v<=STEM[0][ki])return STEM[0][ko];for(let i=1;i<STEM.length;i++)if(v<=STEM[i][ki]){const t=(v-STEM[i-1][ki])/(STEM[i][ki]-STEM[i-1][ki]);return lerp(STEM[i-1][ko],STEM[i][ko],t)}return STEM[STEM.length-1][ko]}
const stemZ=x=>tab(x,1,0);
const taper=t=>t<=0?1:t>=1?0:Math.pow(1-Math.pow(t,2.6),0.8);
const keelZ=x=>x>=36.7?stemZ(x):x<7?0.6*Math.pow((7-x)/7,1.6):0;
function chineL(x){const e=40.9;if(x>=e)return null;const ze=stemZ(e);return [3.3*taper((x-20)/(e-20))-(x<3?0.1*(3-x)/3:0),x<=28?0.85:0.85+(ze-0.85)*Math.pow((x-28)/(e-28),2)]}
function knuckleL(x){const e=43.7;if(x>=e)return null;return [3.7*taper((x-25)/(e-25)),x<=30?3.05:3.05+(stemZ(e)-3.05)*Math.pow((x-30)/(e-30),2.2)]}
const deckZ=x=>x<26?4.1+0.1*sstep(8,26,x):4.2+0.1*Math.pow((x-26)/18,1.5);
const deckY=x=>x>=44?0:3.48*taper((x-27)/17);
const zF=x=>deckZ(x)-0.28; /* foredeck surface */
function half(x){const k=keelZ(x),s=[0,stemZ(Math.min(x,44))];const pts=[[0,k],chineL(x)||s,knuckleL(x)||s,[deckY(x),deckZ(x)]];for(let i=1;i<4;i++)pts[i][1]=Math.max(pts[i][1],pts[i-1][1]);return pts}
function hullY(x,z){const p=half(x);if(z<=p[0][1])return 0;for(let i=0;i<3;i++)if(z<=p[i+1][1]){const d=p[i+1][1]-p[i][1];return d<1e-6?p[i+1][0]:lerp(p[i][0],p[i+1][0],(z-p[i][1])/d)}return p[3][0]}
function bottomZ(x,y){const p=half(x);const Yc=p[1][0]||1;return lerp(p[0][1],p[1][1],Math.min(1,Math.abs(y)/Yc))}

/* deckhouse: full-width "high side" + faceted forward block */
const ZT=6.35,ZFL=5.5;
const eN=x=>x<=27.2?1:x<=28.4?lerp(1,.955,(x-27.2)/1.2):x<=30.3?lerp(.955,.55,(x-28.4)/1.9):Math.max(0,lerp(.55,0,(x-30.3)/.9));
const zTop=x=>x<=28.33?ZT:x<=30.59?lerp(ZT,4.91,(x-28.33)/2.26):lerp(4.91,zF(x),Math.min(1,(x-30.59)/.61));
function dhY(x,z){if(x<26.6){const yb=deckY(x),zb=deckZ(x);return lerp(yb,3.05,(z-zb)/(ZT-0.12-zb))}const e=eN(x),zb=zF(x);return e*(3.2-0.147*(z-zb))}

const meshes=[];const decalGroups={};
function decalG(name){return decalGroups[name]||(decalGroups[name]=newG())}
function build(){
 const G=newG();CUR=G;
 /* hull shell */
 const xs=[];for(let x=0;x<30;x+=0.5)xs.push(x);for(let x=30;x<44;x+=0.25)xs.push(x);xs.push(36.7,40.9,43.7,44);
 const XS=[...new Set(xs.map(v=>+v.toFixed(3)))].sort((a,b)=>a-b);
 const R=XS.map(x=>{const h=half(x),P=h.map(([Y,z])=>[x,Y,z]),S=h.map(([Y,z])=>[x,-Y,z]);return [S[3],S[2],S[1],P[0],P[1],P[2],P[3]]});
 loft(R,C.hull,{cf:(i,j)=>(j===0||j===5)?C.hull:C.paint});
 cap(R[0],C.paint);
 /* aft main deck and foredeck */
 const ya=hullY(0.02,3.2)-0.02,yb=hullY(9.95,3.2)-0.02;
 quad([0.02,-ya,3.2],[9.95,-yb,3.2],[9.95,yb,3.2],[0.02,ya,3.2],C.deck);
 const fx=[];for(let x=26.5;x<=44;x+=0.25)fx.push(x);
 for(let i=0;i<fx.length-1;i++){const a=fx[i],b=fx[i+1],za=zF(a),zb=zF(b),ya2=hullY(a,za)-0.015,yb2=hullY(b,zb)-0.015;if(ya2<=0&&yb2<=0)continue;quad([a,-Math.max(ya2,0),za],[b,-Math.max(yb2,0),zb],[b,Math.max(yb2,0),zb],[a,Math.max(ya2,0),za],C.deck)}
 /* deckhouse */
 const ring=(xb,xt,Wb,zb,Wt,zt)=>{const ch=Math.min(0.12,Wt*0.3);return [[xb,-Wb,zb],[xt,-Wt,zt-ch],[xt,-(Wt-ch),zt],[xt,Wt-ch,zt],[xt,Wt,zt-ch],[xb,Wb,zb]]};
 const DH=[{r:ring(10.28,11.16,deckY(10.28),deckZ(10.28),3.05,ZT),open:false}];
 [11.4,13,15,17,19,21,23,25,26.6].forEach(x=>DH.push({r:ring(x,x,deckY(x)-0.012,deckZ(x)-0.06,3.05,ZT),open:true,x,w:3.05}));
 [26.6,27.2,27.6,28.33,30.3,30.59,30.9,31.2].forEach(x=>{const e=eN(x),zb=zF(x)-0.04,zt=Math.max(zTop(x),zb),Wb=3.2*e,Wt=e*Math.max(0,3.2-0.147*(zt-zb));DH.push({r:ring(x,x,Wb,zb,Wt,zt),open:x<=27.6,x,w:Wt})});
 loft(DH.map(d=>d.r),C.sup,{skip:(i,j)=>j===2&&DH[i].open&&DH[i+1].open,capA:true});
 const y32=hullY(9.93,3.2)-0.02,yd=deckY(10.28);
 quad([9.93,-y32,3.2],[9.93,y32,3.2],[10.28,yd,deckZ(10.28)],[10.28,-yd,deckZ(10.28)],C.sup);
 const OP=DH.filter(d=>d.open);
 for(const s of [1,-1])loft(OP.map(d=>[[d.x,s*(d.w-0.12),ZT],[d.x,s*(d.w-0.12),ZFL]]),C.sup);
 loft(OP.map(d=>[[d.x,-(d.w-0.12),ZFL],[d.x,d.w-0.12,ZFL]]),C.deck);
 for(const d of [OP[0],OP[OP.length-1]]){const w=d.w-0.12;quad([d.x,-w,ZT],[d.x,w,ZT],[d.x,w,ZFL],[d.x,-w,ZFL],C.sup)}
 /* bridge */
 const brB=[[22.9,-2.05],[27.55,-2.05],[28.3,-1.35],[28.3,1.35],[27.55,2.05],[22.9,2.05]];
 const brT=brB.map((p,i)=>i>=1&&i<=4?[p[0]+0.18,p[1]]:p);
 prism(brB,brT,ZFL,7.45,C.sup,{capA:false});
 const rf=offs(brT,0.3);prism(rf,rf,7.42,7.5,C.sup);prism(rf,offs(brT,-0.02),7.5,7.64,C.sup);
 /* HV / radio rooms + mast */
 prism(chamf(17.4,23.1,-2.3,2.3,0.12),chamf(17.5,22.75,-2.15,2.15,0.25),ZFL,8.0,C.sup,{capA:false});
 prism(chamf(17.35,20.3,-0.75,0.75,0.1),chamf(16.75,21.0,-0.95,0.95,0.12),ZFL,9.75,C.sup,{capA:false});
 const pf1=chamf(16.7,21.1,-1.88,1.88,0.45);
 prism(chamf(16.83,20.91,-0.924,0.924,0.12),pf1,9.2,9.75,C.sup);prism(pf1,pf1,9.75,9.92,C.sup);
 prism(chamf(17.0,18.9,-0.6,0.6,0.1),chamf(17.25,18.85,-0.55,0.55,0.1),9.92,11.35,C.sup);
 const pf2=chamf(16.35,19.25,-1.65,1.65,0.4);
 prism(chamf(17.25,18.85,-0.55,0.55,0.1),pf2,11.35,11.95,C.sup);prism(pf2,pf2,11.95,12.1,C.sup);
 cyl([16.9,0,12.1],[16.9,0,17.6],0.075,C.sup,{r1:0.045,seg:10});cyl([16.9,0,17.6],[16.9,0,18.6],0.022,C.dark,{seg:6});
 cyl([16.9,-1.05,14.8],[16.9,1.05,14.8],0.035,C.sup,{seg:8});cyl([16.9,-0.7,15.9],[16.9,0.7,15.9],0.03,C.sup,{seg:8});
 box(16.82,16.98,-0.08,0.08,17.3,17.5,C.white);
 cyl([18.0,0,12.1],[18.0,0,13.45],0.13,C.sup);cyl([18.0,0,13.45],[18.0,0,13.58],0.9,C.mid,{seg:28});
 for(const s of [1,-1]){box(17.6,17.95,s*1.42-0.1,s*1.42+0.1,12.1,12.75,C.sup)}
 cyl([18.85,0,12.1],[18.85,0,12.55],0.16,C.sup);prism(chamf(18.6,19.1,-0.25,0.25,0.06),chamf(18.6,19.1,-0.25,0.25,0.06),12.55,13.0,C.mid);cyl([19.1,0,12.78],[19.17,0,12.78],0.13,C.black);
 cyl([20.3,0,9.92],[20.3,0,10.4],0.28,C.sup);prism(chamf(19.95,20.75,-0.35,0.35,0.08),chamf(20.0,20.7,-0.32,0.32,0.08),10.4,11.15,C.sup);
 cyl([20.75,0,10.85],[20.86,0,10.85],0.5,C.mid,{seg:24});cyl([20.86,0,10.85],[20.9,0,10.85],0.18,C.dark);
 cyl([17.05,1.45,9.92],[17.05,1.45,11.2],0.04,C.sup,{seg:8});cyl([17.05,1.45,11.2],[17.05,1.45,11.55],0.09,C.sup,{r1:0.15});
 /* radar pedestals */
 prism(chamf(21.9,22.4,-0.25,0.25,0.06),chamf(21.97,22.33,-0.18,0.18,0.05),8.0,8.38,C.sup);
 box(24.27,24.53,-0.13,0.13,7.64,7.9,C.sup);
 /* bridge roof kit */
 cyl([27.1,1.25,7.64],[27.1,1.25,7.95],0.07,C.sup);cyl([26.95,1.25,8.12],[27.32,1.25,8.12],0.2,C.mid);cyl([27.32,1.25,8.12],[27.35,1.25,8.12],0.17,C.white);
 cyl([25.9,-0.6,7.64],[25.9,-0.6,8.6],0.025,C.dark,{seg:6});
 for(const s of [1,-1]){cyl([24.5,s*2.2,7.64],[24.5,s*2.2,7.8],0.07,C.dark,{seg:8});cyl([24.5,s*2.2,7.8],[24.85,s*2.55,12.9],0.028,C.dark,{r1:0.01,seg:6});
  cyl([11.75,s*2.8,ZT],[11.75,s*2.8,6.5],0.07,C.dark,{seg:8});cyl([11.75,s*2.8,6.5],[11.5,s*3.25,12.4],0.03,C.dark,{r1:0.01,seg:6});}
 box(23.2,23.5,2.05,2.16,6.95,7.15,C.red);box(23.2,23.5,-2.16,-2.05,6.95,7.15,C.green);
 /* machine guns aft of the nav deck */
 for(const s of [1,-1]){
  XF=M.mul(M.tr(12.3,s*2.4,ZFL),M.rz(Math.PI-s*0.5));
  cyl([0,0,0],[0,0,0.95],0.07,C.dark,{seg:8});box(-0.12,0.12,-0.1,0.1,0.95,1.05,C.dark);
  XF=M.chain(M.tr(12.3,s*2.4,ZFL),M.rz(Math.PI-s*0.5),M.tr(0,0,1.08),M.ry(-0.38));
  box(-0.35,0.45,-0.08,0.08,-0.08,0.1,C.dark);cyl([0.45,0,0.01],[1.35,0,0.01],0.026,C.black,{seg:8});
  box(0.15,0.2,-0.32,0.32,-0.2,0.38,C.gun);box(-0.12,0.15,0.08,0.26,-0.14,0.05,C.dark);
  XF=null;
 }
 /* life rafts */
 for(const s of [1,-1])for(const x of [14.15,14.85]){box(x-0.25,x+0.25,s*2.35-0.5,s*2.35+0.5,ZFL,ZFL+0.32,C.mid);cyl([x,s*2.35-0.56,6.08],[x,s*2.35+0.56,6.08],0.28,C.raft,{seg:16});for(const o of [-0.3,0.3])cyl([x,s*2.35+o-0.03,6.08],[x,s*2.35+o+0.03,6.08],0.29,C.mid,{seg:16})}
 /* SATCOM dome */
 cyl([15.9,-1.4,ZFL],[15.9,-1.4,6.6],0.18,C.sup);cyl([15.9,-1.4,6.6],[15.9,-1.4,6.72],0.6,C.sup,{seg:24});dome([15.9,-1.4,6.72],0.62,C.white);
 /* foredeck gun */
 XF=M.tr(34.4,0,zF(34.4));
 cyl([0,0,0],[0,0,0.1],0.88,C.mid,{seg:28});cyl([0,0,0.1],[0,0,0.6],0.56,C.sup,{seg:24});
 for(let k=0;k<16;k++){const a=k/16*Math.PI*2;cyl([0.58*Math.cos(a),0.58*Math.sin(a),0.1],[0.58*Math.cos(a),0.58*Math.sin(a),0.6],0.025,C.sup,{seg:5})}
 prism(chamf(-0.75,0.7,-0.62,0.62,0.12),chamf(-0.65,0.3,-0.55,0.55,0.1),0.6,1.28,C.gun);
 box(-0.55,0.35,0.62,0.95,0.68,1.22,C.dark);box(-0.55,0.35,-0.95,-0.62,0.68,1.22,C.dark);
 cyl([0.3,0,0.92],[0.95,0,0.92],0.11,C.gun);cyl([0.95,0,0.92],[2.0,0,0.92],0.055,C.dark,{seg:10});cyl([2.0,0,0.92],[2.22,0,0.92],0.085,C.dark,{seg:10});
 box(-0.3,0.05,0.25,0.5,1.28,1.55,C.dark);
 XF=null;
 /* foredeck fittings */
 const bitt=(x,y,zb)=>{box(x-0.32,x+0.32,y-0.13,y+0.13,zb,zb+0.05,C.dark);for(const o of [-0.18,0.18]){cyl([x+o,y,zb],[x+o,y,zb+0.36],0.1,C.dark,{seg:10});cyl([x+o,y,zb+0.36],[x+o,y,zb+0.4],0.14,C.dark,{seg:10})}};
 for(const s of [1,-1]){bitt(29.8,s*2.72,zF(29.8));bitt(38.1,s*1.8,zF(38.1));
  cyl([38.9,s*0.45,zF(38.9)],[38.9,s*0.45,zF(38.9)+0.14],0.2,C.dark);
  cyl([38.9,s*0.45,zF(38.9)+0.05],[40.1,s*0.8,zF(40.1)+0.05],0.05,C.black,{seg:4});
  cyl([40.1,s*0.8,zF(40.1)],[40.1,s*0.8,zF(40.1)+0.05],0.17,C.black);
  cyl([32.2,s*0.6,zF(32.2)],[32.2,s*0.6,zF(32.2)+0.45],0.08,C.sup,{seg:10});cyl([32.2,s*0.6,zF(32.2)+0.45],[32.2,s*0.6,zF(32.2)+0.55],0.17,C.sup,{seg:12});}
 box(31.9,32.6,-0.35,0.35,zF(32.3),zF(32.3)+0.08,C.mid);
 cyl([43.55,0,zF(43.55)],[43.55,0,zF(43.55)+1.7],0.035,C.dark,{r1:0.02,seg:8});
 /* railings along the foredeck */
 const rx=[];for(let x=27.0;x<43.45;x+=1.15)rx.push(x);rx.push(43.45);
 for(const s of [1,-1]){
  const posts=rx.map(x=>{const z=deckZ(x);return [x,s*(hullY(x,z)-0.04),z]});
  posts.forEach(p=>cyl(p,add(p,[0,0,0.55]),0.022,C.sup,{seg:6}));
  for(const h of [0.27,0.55])for(let i=0;i<posts.length-1;i++)cyl(add(posts[i],[0,0,h]),add(posts[i+1],[0,0,h]),0.018,C.sup,{seg:6,caps:false});
 }
 {const z=deckZ(43.45),y=hullY(43.45,z)-0.04;for(const h of [0.27,0.55])cyl([43.45,-y,z+h],[43.45,y,z+h],0.018,C.sup,{seg:6,caps:false})}
 /* aft deck: hatches, seats, canopy, RHIB, crane */
 for(const y of [1.9,0,-1.9])box(7.0,9.25,y-0.6,y+0.6,3.2,3.24,C.mid);
 /* two rocket launchers on the aft deck: one trained to port, one to starboard */
 const launcher=(x0,train)=>{
  XF=M.tr(x0,0,3.2);box(-0.5,0.5,-0.5,0.5,0,0.08,C.dark);cyl([0,0,0.08],[0,0,0.72],0.3,C.mid);cyl([0,0,0.72],[0,0,0.82],0.52,C.dark,{seg:24});
  XF=M.chain(M.tr(x0,0,3.2),M.rz(train));for(const k of [-1,1])box(k*0.47-0.05,k*0.47+0.05,-0.3,0.3,0.82,1.45,C.mid);cyl([-0.56,0,1.35],[0.56,0,1.35],0.07,C.dark,{seg:10});
  XF=M.chain(M.tr(x0,0,4.55),M.rz(train),M.rx(0.14));
  box(-0.42,0.42,-2.2,2.2,-0.5,0.5,C.gun);for(const yb of [-1.8,-0.6,0.6,1.8])box(-0.45,0.45,yb-0.06,yb+0.06,-0.53,0.53,C.mid);
  box(-0.3,0.3,-1.2,-0.3,0.5,0.62,C.mid);
  CUR=decalG('tubes');for(const e of [2.2,-2.2])faceDecal([-0.42,e,-0.5],[0.42,e,-0.5],[-0.42,e,0.5],[0.42,e,0.5],0,1,0,1,[0,0,0]);CUR=G;
  XF=null};
 launcher(5.0,0);launcher(6.25,Math.PI);
 XF=M.mul(M.tr(2.1,0,3.7),M.rz(Math.PI/2));
 {const path=[];for(let k=0;k<8;k++)path.push([-2.25+0.45*k,-0.72,0]);for(let k=0;k<=8;k++){const a=-Math.PI/2+Math.PI*k/8;path.push([1.35+0.72*Math.cos(a),0.72*Math.sin(a),0])}for(let k=7;k>=0;k--)path.push([-2.25+0.45*k,0.72,0]);path.forEach(p=>{p[2]=0.14*Math.max(0,(p[0]-0.5)/1.6)});tube(path,0.24,C.rhib,10);
  const hp=[[-2.3,-0.72],[1.3,-0.72],[1.85,-0.42],[2.05,0],[1.85,0.42],[1.3,0.72],[-2.3,0.72]];prism(offs(hp,-0.32),hp,-0.42,-0.05,C.mid);
  box(-0.25,0.35,-0.26,0.26,-0.05,0.72,C.white);box(0.3,0.38,-0.26,0.26,0.72,0.95,C.black);
  for(const px of [-0.5,0.5])for(const py of [-0.42,0.42])cyl([px,py,-0.05],[px,py,1.35],0.025,C.dark,{seg:8});box(-0.6,0.6,-0.5,0.5,1.35,1.43,C.black);
  box(-2.68,-2.28,-0.18,0.18,-0.1,0.62,C.black);box(-2.6,-2.38,-0.06,0.06,-0.8,-0.1,C.black);
  for(const x of [-1.2,1.0])box(x-0.15,x+0.15,-0.6,0.6,-0.5,-0.4,C.dark);}
 XF=null;
 cyl([0.9,2.75,3.2],[0.9,2.75,5.0],0.16,C.sup);cyl([0.9,2.75,5.0],[2.2,0.3,5.9],0.09,C.sup,{seg:8});cyl([2.2,0.3,5.9],[2.2,0.3,4.95],0.012,C.dark,{seg:4});
 cyl([0.3,0,4.1],[0.3,0,5.6],0.03,C.dark,{seg:8});
 box(0.15,0.7,-3.45,-2.95,3.2,3.75,C.sup);box(8.8,9.6,2.95,3.42,3.2,3.8,C.sup);box(3.4,3.9,-3.42,-3.0,3.2,3.7,C.sup);
 for(const s of [1,-1]){bitt(3.0,s*3.15,3.2);bitt(8.4,s*3.15,3.2);
  const pth=[];for(let k=0;k<16;k++){const a=k/16*Math.PI*2;pth.push([6.0+0.3*Math.cos(a),s*3.55,3.72+0.3*Math.sin(a)])}tube(pth,0.07,C.orange,8,true);}
 /* running gear */
 for(const y of [0,1.55,-1.55]){
  const zp=y===0?-0.1:-0.05,hb=bottomZ(8,y);
  cyl([8,y,hb+0.05],[1.75,y,zp],0.065,C.mid,{seg:10});
  cyl([2.5,y,lerp(hb,zp,(8-2.5)/6.25)],[2.5,y,bottomZ(2.5,y)+0.05],0.045,C.mid,{seg:6});
  cyl([1.45,y,zp],[1.9,y,zp],0.13,C.bronze,{r1:0.1});
  for(let k=0;k<4;k++){XF=M.chain(M.tr(1.68,y,zp),M.rx(k*Math.PI/2+0.3),M.rz(0.6));box(-0.03,0.03,-0.15,0.15,0.1,0.56,C.bronze);XF=null}
  box(0.55,1.05,y-0.035,y+0.035,-0.35,bottomZ(0.8,y)+0.05,C.mid);
 }
 meshes.push({g:G,kind:'solid',model:'ship'});

 /* rotating radar arrays (built around their own pivots) */
 CUR=newG();cyl([22.15,0,8.38],[22.15,0,8.52],0.1,C.dark);prism(chamf(21.98,22.32,-1.32,1.32,0.06),chamf(22.04,22.26,-1.3,1.3,0.05),8.52,8.8,C.white);
 meshes.push({g:CUR,kind:'solid',model:'r1',pivot:W([22.15,0,0])});
 CUR=newG();cyl([24.4,0,7.9],[24.4,0,8.0],0.07,C.dark);box(24.3,24.5,-0.66,0.66,8.0,8.18,C.white);
 meshes.push({g:CUR,kind:'solid',model:'r2',pivot:W([24.4,0,0])});

 /* decals */
 CUR=decalG('num');for(const s of [1,-1])sideDecal(31.8,35.3,2.0,2.95,s,hullY,16,4);
 CUR=decalG('anchor');for(const s of [1,-1])sideDecal(38.6,40.0,2.28,2.95,s,hullY,8,3);
 CUR=decalG('fair');for(const s of [1,-1])for(const [x0,x1,z0,z1] of [[29.9,30.45,3.6,3.88],[35.0,35.55,3.68,3.96],[39.7,40.2,3.86,4.1],[2.8,3.4,3.38,3.7],[8.5,9.1,3.38,3.7]])sideDecal(x0,x1,z0,z1,s,hullY,4,2);
 CUR=decalG('glass');
 for(const s of [1,-1]){sideDecal(26.75,27.7,5.52,5.8,s,dhY,4,1);sideDecal(25.0,26.1,5.5,5.75,s,dhY,4,1)}
 const vb=(6.5-ZFL)/(7.45-ZFL),vt=(7.32-ZFL)/(7.45-ZFL),bc=[25.5,0,6.4];
 const face=i=>{const j=(i+1)%6;return [[...brB[i],ZFL],[...brB[j],ZFL],[...brT[i],7.45],[...brT[j],7.45]]};
 const panes=(i,n,u0,u1,gap)=>{const f=face(i),L=Math.hypot(f[1][0]-f[0][0],f[1][1]-f[0][1]),g=gap/L,w=(u1-u0-g*(n-1))/n;for(let k=0;k<n;k++){const a=u0+k*(w+g);faceDecal(f[0],f[1],f[2],f[3],a,a+w,vb,vt,bc)}};
 panes(0,3,0.24,0.97,0.12);panes(4,3,0.03,0.76,0.12);panes(1,1,0.1,0.9,0);panes(3,1,0.1,0.9,0);
 CUR=decalG('cvs');panes(2,3,0.04,0.96,0.1);
 CUR=decalG('door');for(const s of [1,-1])sideDecal(28.8,29.5,4.28,5.2,s,dhY,4,2);
 {const xa=z=>10.28+(z-4.1)*(0.88/2.25);faceDecal([xa(3.25),-0.42,3.25],[xa(3.25),0.42,3.25],[xa(5.15),-0.42,5.15],[xa(5.15),0.42,5.15],0,1,0,1,[15,0,4.5])}
 CUR=decalG('shield');for(const s of [1,-1]){const yb=z=>s*(0.75+0.2*(z-ZFL)/4.25);faceDecal([18.55,yb(8.0),8.0],[19.45,yb(8.0),8.0],[18.55,yb(9.15),9.15],[19.45,yb(9.15),9.15],0,1,0,1,[19,0,8.5])}
 CUR=decalG('badge');{const e=eN(28.6),w=0.3;faceDecal([28.42,-w,zTop(28.42)],[28.42,w,zTop(28.42)],[28.95,-w,zTop(28.95)],[28.95,w,zTop(28.95)],0,1,1,0,[27,0,4])}
 CUR=null;
}
build();
M.sc=(x,y,z)=>{const m=M.id();m[0]=x;m[5]=y;m[10]=z;return m};

/* ---------- rooms and tanks as boxes inside the hull ---------- */
const DZ={bawah:[1.0,3.05],utama:[3.35,5.4],atas:[5.55,7.35]};
function roomGeom(r){
 let [z0,z1]=DZ[r.deck];const xs=[0,1,2,3,4,5,6].map(i=>lerp(r.x0+0.06,r.x1-0.06,i/6));
 if(r.deck==='bawah')z0=Math.max(z0,...xs.map(x=>bottomZ(x,0)+0.15));
 if(r.deck==='utama'){if(r.x0>=26.6)z0=Math.max(z0,...xs.map(x=>zF(x)-0.02));z1=Math.min(z1,...xs.map(x=>zTop(x)-0.12))}
 const zz=Math.min(z1,z0+0.3);
 let Wd=Math.min(...xs.map(x=>{if(r.deck==='atas')return r.id==='anjungan'?2.09:2.29;if(r.deck==='utama')return x>=26.6?dhY(x,zz):Math.min(hullY(x,zz),dhY(x,z1));return hullY(x,zz)}))-0.14;
 Wd=Math.max(Wd,0.3);const ins=Wd>0.9?0.45:0.06;const y=r.side==='F'?[-Wd,Wd]:r.side==='P'?[ins,Wd]:[-Wd,-ins];
 return {x0:r.x0+0.06,x1:r.x1-0.06,y0:y[0],y1:y[1],z0,z1,c:[(r.x0+r.x1)/2,(y[0]+y[1])/2,(z0+z1)/2]};
}
const RG={},RMESH={};
for(const r of ROOMS){const g=roomGeom(r);RG[r.id]=g;CUR=newG();box(g.x0,g.x1,g.y0,g.y1,g.z0,g.z1,[1,1,1,1]);RMESH[r.id]=CUR;CUR=null}
const TG={};
for(const t of TANKS){const o={};CUR=newG();box(t.x0,t.x1,-t.y,t.y,t.z0,t.z1,[1,1,1,1]);o.shell=CUR;CUR=newG();box(t.x0+0.05,t.x1-0.05,-t.y+0.05,t.y-0.05,t.z0+0.03,t.z1-0.03,[1,1,1,1]);o.liq=CUR;CUR=null;TG[t.id]=o}

/* unit sphere + compass ring, built in world units */
RAW=true;CUR=newG();{const R=[];for(let i=0;i<=10;i++){const a=-Math.PI/2+Math.PI*i/10,ring=[];for(let k=0;k<18;k++){const b=k/18*Math.PI*2;ring.push([Math.cos(a)*Math.cos(b),Math.sin(a),Math.cos(a)*Math.sin(b)])}R.push(ring)}loft(R,[1,1,1,1],{closed:true})}const sphereG=CUR;
CUR=newG();for(let k=0;k<72;k++){const a0=k/72*Math.PI*2-0.011,a1=a0+0.022,r1=k%6===0?34.8:33.8,P=(r,a)=>[r*Math.cos(a),0.06,r*Math.sin(a)];quad(P(33,a0),P(r1,a0),P(r1,a1),P(33,a1),[1,1,1,1])}
for(let k=0;k<180;k++){const a0=k/180*Math.PI*2,a1=(k+1)/180*Math.PI*2,P=(r,a)=>[r*Math.cos(a),0.06,r*Math.sin(a)];quad(P(32.8,a0),P(33,a0),P(33,a1),P(32.8,a1),[1,1,1,1])}
tri([0,0.07,-36.6],[-1.1,0.07,-34.9],[1.1,0.07,-34.9],[.91,.07,.11,1]);const ringG=CUR;CUR=null;RAW=false;

/* ---------- textures drawn on canvas ---------- */
if(!CanvasRenderingContext2D.prototype.roundRect)CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){this.rect(x,y,w,h)};
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
function anchorGlyph(x,cx,cy,s,col){x.strokeStyle=col;x.lineWidth=s*0.09;x.lineCap='round';x.beginPath();x.arc(cx,cy-s*0.42,s*0.09,0,7);x.moveTo(cx,cy-s*0.33);x.lineTo(cx,cy+s*0.4);x.moveTo(cx-s*0.22,cy-s*0.2);x.lineTo(cx+s*0.22,cy-s*0.2);x.moveTo(cx-s*0.36,cy+s*0.12);x.quadraticCurveTo(cx-s*0.3,cy+s*0.42,cx,cy+s*0.42);x.quadraticCurveTo(cx+s*0.3,cy+s*0.42,cx+s*0.36,cy+s*0.12);x.stroke()}
const TX={
 num(){const c=mk(512,140),x=c.getContext('2d');x.font='italic 700 138px Saira,"Arial Narrow","Roboto Condensed",Manrope,Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='rgba(232,236,240,.95)';x.fillText('644',262,76);x.fillStyle='#343a41';x.fillText('644',254,72);return c},
 glass(cvs){const c=mk(128,128),x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,'#33424f');g.addColorStop(1,'#0b1218');x.fillStyle=g;x.fillRect(0,0,128,128);x.fillStyle='rgba(255,255,255,.07)';x.beginPath();x.moveTo(24,0);x.lineTo(66,0);x.lineTo(14,128);x.lineTo(-28,128);x.fill();x.strokeStyle='#8e99a3';x.lineWidth=7;x.strokeRect(3.5,3.5,121,121);
  if(cvs){x.strokeStyle='rgba(226,232,238,.92)';x.fillStyle='rgba(226,232,238,.92)';x.lineWidth=5;x.beginPath();x.arc(64,62,30,0,7);x.stroke();x.beginPath();x.arc(64,62,5,0,7);x.fill();x.lineWidth=3;x.beginPath();x.moveTo(30,62);x.lineTo(98,62);x.stroke()}return c},
 anchor(){const c=mk(256,128),x=c.getContext('2d'),g=x.createLinearGradient(0,0,256,0);g.addColorStop(0,'#1b1f24');g.addColorStop(1,'#3a4048');x.fillStyle=g;x.beginPath();x.moveTo(52,10);x.lineTo(250,10);x.lineTo(204,118);x.lineTo(6,118);x.closePath();x.fill();x.strokeStyle='rgba(200,208,214,.5)';x.lineWidth=4;x.stroke();return c},
 fair(){const c=mk(128,64),x=c.getContext('2d');x.fillStyle='#1d2329';x.strokeStyle='#909ba4';x.lineWidth=6;x.beginPath();x.roundRect(6,8,116,48,20);x.fill();x.stroke();return c},
 door(){const c=mk(128,192),x=c.getContext('2d');x.fillStyle='#a2abb3';x.strokeStyle='#5d6770';x.lineWidth=8;x.beginPath();x.roundRect(6,6,116,180,14);x.fill();x.stroke();x.fillStyle='#16202a';x.beginPath();x.roundRect(30,24,68,46,8);x.fill();x.fillStyle='#5d6770';x.fillRect(96,96,14,30);return c},
 shield(){const c=mk(128,160),x=c.getContext('2d');x.beginPath();x.moveTo(64,6);x.lineTo(118,22);x.lineTo(112,96);x.quadraticCurveTo(100,140,64,154);x.quadraticCurveTo(28,140,16,96);x.lineTo(10,22);x.closePath();x.fillStyle='#1c4c92';x.fill();x.lineWidth=7;x.strokeStyle='#d1a42c';x.stroke();anchorGlyph(x,64,80,92,'#d9b247');return c},
 tubes(){const c=mk(168,200),x=c.getContext('2d');x.fillStyle='#5b636a';x.fillRect(0,0,168,200);x.strokeStyle='#8f989f';x.lineWidth=5;x.strokeRect(2.5,2.5,163,195);for(let i=0;i<4;i++)for(let j=0;j<5;j++){const cx=21+42*i,cy=20+40*j;x.beginPath();x.arc(cx,cy,17,0,7);x.fillStyle='#9aa3aa';x.fill();x.beginPath();x.arc(cx,cy,13.5,0,7);x.fillStyle='#0c1013';x.fill()}return c},
 badge(){const c=mk(128,128),x=c.getContext('2d');x.beginPath();x.arc(64,64,58,0,7);x.fillStyle='#c79b2c';x.fill();x.beginPath();x.arc(64,64,44,0,7);x.fillStyle='#4a3b1c';x.fill();anchorGlyph(x,64,66,70,'#e2c060');return c}
};
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
const aniso=gl.getExtension('EXT_texture_filter_anisotropic');
function tex(canvas){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,8);return t}
const TEX={num:tex(TX.num()),glass:tex(TX.glass(false)),cvs:tex(TX.glass(true)),anchor:tex(TX.anchor()),fair:tex(TX.fair()),door:tex(TX.door()),shield:tex(TX.shield()),badge:tex(TX.badge()),tubes:tex(TX.tubes())};
for(const k in decalGroups)meshes.push({g:decalGroups[k],kind:'decal',model:'ship',tex:TEX[k]});

/* ---------- GL plumbing ---------- */
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const cache={};p.u=n=>n in cache?cache[n]:(cache[n]=gl.getUniformLocation(p,n));return p}
function vao(g){const v=gl.createVertexArray();gl.bindVertexArray(v);const put=(loc,arr,n)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,arr instanceof Float32Array?arr:new Float32Array(arr),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,0,0);return b};
 put(0,g.p,3);if(g.n)put(1,g.n,3);if(g.c)put(2,g.c,4);if(g.t&&g.t.length)put(3,g.t,2);gl.bindVertexArray(null);return {vao:v,count:g.p.length/3}}
for(const m of meshes)Object.assign(m,vao(m.g));
const RV={},TV={};for(const r of ROOMS)RV[r.id]=vao(RMESH[r.id]);for(const t of TANKS)TV[t.id]={sv:vao(TG[t.id].shell),lv:vao(TG[t.id].liq)};
const SPH=vao(sphereG),RING=vao(ringG);

const SKY=`uniform vec3 uSun,uHor,uZen;
vec3 sky(vec3 d){float h=max(d.y,0.);vec3 c=mix(uHor,uZen,pow(h,.42));vec2 a=normalize(d.xz+1e-4),b=normalize(uSun.xz);c+=vec3(.95,.55,.3)*pow(max(dot(a,b),0.),5.)*.28*pow(1.-h,7.);c+=vec3(1.,.86,.66)*pow(max(dot(d,uSun),0.),600.)*1.6;if(d.y<0.)c=uHor*mix(1.,.8,min(-d.y*4.,1.));return c;}`;
const P_MAIN=prog(`#version 300 es
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec4 aC;layout(location=3)in vec2 aT;
uniform mat4 uVP,uM,uLVP;out vec3 vW,vN;out vec4 vC,vS;out vec2 vT;out float vH;
void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uM)*aN;vC=aC;vT=aT;vS=uLVP*w;vH=aP.y;gl_Position=uVP*w;}`,
`#version 300 es
precision highp float;precision highp sampler2DShadow;
in vec3 vW,vN;in vec4 vC,vS;in vec2 vT;in float vH;
uniform vec3 uSun,uSunC,uFill,uCam,uCamF,uSkyA,uGnd,uFog;uniform vec4 uTint;uniform float uOrtho,uTexOn,uOut,uShOn,uFogD,uId,uGhost,uFlat;
uniform sampler2D uTex;uniform sampler2DShadow uSh;out vec4 o;
float shadow(){vec3 p=vS.xyz/vS.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;float s=0.;vec2 px=vec2(1./2048.);for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)s+=texture(uSh,vec3(p.xy+vec2(i,j)*px*1.2,p.z-.0006));return s/9.;}
void main(){
 vec3 V=uOrtho>.5?-uCamF:normalize(uCam-vW);vec3 n=normalize(vN);if(dot(n,V)<0.)n=-n;
 vec4 b=vC;
 if(uTexOn>.5){b=texture(uTex,vT);if(b.a<(uOut>.5?.5:.02))discard;}
 else if(vC.a<.5){b.rgb=vH<1.52?vec3(.43,.15,.13):(vH<1.86?vec3(.1,.105,.11):vC.rgb);b.a=1.;}
 b.rgb*=uTint.rgb;
 if(uOut>.5){o=vec4(n*.5+.5,uId);return;}
 float s=uShOn>.5?shadow():1.;float ndl=max(dot(n,uSun),0.);
 vec3 amb=mix(uGnd,uSkyA,n.y*.5+.5);
 vec3 c=b.rgb*(amb+uSunC*ndl*s+vec3(.7,.8,.95)*max(dot(n,uFill),0.)*.25);
 vec3 h=normalize(uSun+V);c+=uSunC*pow(max(dot(n,h),0.),48.)*.12*s;
 c=mix(c,b.rgb,uFlat);
 float d=length(uCam-vW);c=mix(c,uFog,1.-exp(-d*uFogD));
 float a=uTexOn>.5?b.a:uTint.a;
 if(uGhost>0.){float fr=pow(1.-max(dot(n,V),0.),2.);c=mix(c,vec3(.72,.84,.98),.6);a=min(.7,uGhost*(.1+1.1*fr));}
 o=vec4(c,a);}`);
const P_SH=prog(`#version 300 es
layout(location=0)in vec3 aP;uniform mat4 uLVP,uM;void main(){gl_Position=uLVP*uM*vec4(aP,1.);}`,`#version 300 es
precision mediump float;out vec4 o;void main(){o=vec4(1.);}`);
const FSV=`#version 300 es
out vec2 vP;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;vP=p;gl_Position=vec4(p,1.,1.);}`;
const P_SKY=prog(FSV,`#version 300 es
precision highp float;in vec2 vP;uniform vec3 uR,uU,uF;uniform float uTan,uAsp;out vec4 o;${SKY}
void main(){vec3 d=normalize(uF+vP.x*uAsp*uTan*uR+vP.y*uTan*uU);o=vec4(sky(d),1.);}`);
const WL_GLSL=`vec2 L(vec2 w){float c=cos(uYaw),s=sin(uYaw);return vec2(c*w.x-s*w.y,s*w.x+c*w.y);}`;
const P_WATER=prog(`#version 300 es
layout(location=0)in vec3 aP;uniform mat4 uVP,uLVP;uniform float uT,uAmp,uSpd,uYaw;out vec3 vW;out vec4 vS;${WL_GLSL}
float wav(vec2 p){p=L(p);p.x+=uT*uSpd;return uAmp*(.12*sin(dot(p,vec2(.21,.07))+uT*1.1)+.07*sin(dot(p,vec2(-.11,.25))+uT*1.5)+.04*sin(dot(p,vec2(.43,-.31))+uT*2.3));}
void main(){vec3 p=aP;p.y=wav(p.xz);vW=p;vS=uLVP*vec4(p,1.);gl_Position=uVP*vec4(p,1.);}`,
`#version 300 es
precision highp float;precision highp sampler2DShadow;in vec3 vW;in vec4 vS;
uniform vec3 uCam,uCamF,uDeep;uniform float uT,uOrtho,uAmp,uFogD,uSpd,uYaw,uFoamK;uniform float uWL[45];uniform sampler2DShadow uSh;out vec4 o;${SKY}${WL_GLSL}
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float foam(vec2 lp){float sx=lp.x+22.,az=abs(lp.y),fm=0.;vec2 q=vec2(lp.x+uT*uSpd,lp.y);
 float n=vn(q*1.6)*.55+vn(q*4.3)*.3+vn(q*9.7)*.15;
 if(sx>-.5&&sx<44.){float i=clamp(sx,0.,43.99);int k=int(floor(i));float hw=mix(uWL[k],uWL[k+1],fract(i));float d=az-hw;float bow=smoothstep(24.,39.,sx)*(1.-smoothstep(41.,43.,sx));
  fm=max(fm,(1.-smoothstep(0.,.5+1.9*bow,d))*step(-.4,d)*(.45+.55*bow));}
 if(sx<.5){float b=max(-sx,0.);float hw=2.6+b*.09;fm=max(fm,(1.-smoothstep(hw*.35,hw,az))*exp(-b/45.)*.95);
  float arm=abs(az-3.2-.36*b);fm=max(fm,(1.-smoothstep(0.,1.2+.04*b,arm))*exp(-b/60.)*.6);}
 return fm*smoothstep(.55-fm*.45,.85-fm*.3,n);}
vec2 wv(vec2 p,float A,vec2 k,float s){return A*k*cos(dot(p,k)+uT*s);}
void main(){
 vec2 lp=L(vW.xz);vec2 p=lp;p.x+=uT*uSpd;float dd=length(uCam-vW),f1=clamp(1.-dd/420.,0.,1.),f2=clamp(1.-dd/130.,0.,1.);
 vec2 g=wv(p,.12*uAmp,vec2(.21,.07),1.1)+wv(p,.07*uAmp,vec2(-.11,.25),1.5)+wv(p,.04*uAmp,vec2(.43,-.31),2.3)
 +f1*(wv(p,.022,vec2(1.3,.6),3.1)+wv(p,.016,vec2(-.9,1.7),3.7))+f2*(wv(p,.009,vec2(2.9,-2.1),5.3)+wv(p,.006,vec2(-4.3,-3.1),6.7)+wv(p,.004,vec2(6.1,4.7),8.3));
 vec3 n=normalize(vec3(-g.x,1.,-g.y));vec3 V=uOrtho>.5?-uCamF:normalize(uCam-vW);
 float f=.02+.98*pow(1.-max(dot(n,V),0.),5.);vec3 R=reflect(-V,n);R.y=abs(R.y);
 vec3 q=vS.xyz/vS.w*.5+.5;float s=1.;if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.&&q.z<1.){s=0.;for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)s+=texture(uSh,vec3(q.xy+vec2(i,j)/1400.,q.z-.001));s/=9.;}
 vec3 body=uDeep*(.6+.4*max(dot(n,uSun),0.));
 vec3 c=mix(body,sky(R)*.85,f)*mix(.72,1.,s);c+=vec3(1.,.86,.66)*pow(max(dot(R,uSun),0.),350.)*2.*s;
 float fo=uFoamK>0.?foam(lp)*uFoamK:0.;c=mix(c,vec3(.82,.88,.93)*mix(.75,1.,s),fo*.9);
 float d=length(uCam-vW);float fg=1.-exp(-d*uFogD);c=mix(c,uHor,fg);
 o=vec4(c,mix(.86,1.,max(max(f,fg),fo)));}`);
const P_POST=prog(FSV,`#version 300 es
precision highp float;uniform sampler2D uN,uD;uniform vec2 uPx;uniform float uNear,uFar,uOrtho,uK;uniform vec3 uPaper,uInk,uShade,uLt;out vec4 o;
float L(vec2 uv){float d=texture(uD,uv).r;return uOrtho>.5?uNear+d*(uFar-uNear):uNear*uFar/(uFar-d*(uFar-uNear));}
float ed(vec4 c,vec4 s){if(abs(c.a-s.a)>.1)return 1.;if(c.a<.05)return 0.;return dot(c.xyz*2.-1.,s.xyz*2.-1.)<.935?1.:0.;}
void main(){vec2 uv=gl_FragCoord.xy*uPx;vec4 c=texture(uN,uv);vec2 ox=vec2(uPx.x*uK,0.),oy=vec2(0.,uPx.y*uK);
 float e=max(max(ed(c,texture(uN,uv+ox)),ed(c,texture(uN,uv-ox))),max(ed(c,texture(uN,uv+oy)),ed(c,texture(uN,uv-oy))));
 vec2 g=gl_FragCoord.xy*uPx-.5;vec3 base=uPaper*(1.15-.5*length(g));
 if(c.a>.05){float dc=L(uv);float lx=L(uv+ox)+L(uv-ox)-2.*dc,ly=L(uv+oy)+L(uv-oy)-2.*dc,th=.004*dc+.03;if(abs(lx)>th||abs(ly)>th)e=1.;
  base=mix(uPaper,uShade,(1.-max(dot(c.xyz*2.-1.,uLt),0.))*.75);}
 o=vec4(mix(base,uInk,e),1.);}`);

/* shadow map + line-drawing target */
const SM=2048,shT=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shT);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT24,SM,SM);
[[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE],[gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL]].forEach(([k,v])=>gl.texParameteri(gl.TEXTURE_2D,k,v));
const shFB=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shFB);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shT,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
let dFB=null,dCol=null,dDep=null,dW=0,dH=0;
function ensureDrawFB(w,h){if(dFB&&dW===w&&dH===h)return;if(dFB){gl.deleteFramebuffer(dFB);gl.deleteTexture(dCol);gl.deleteTexture(dDep)}
 dW=w;dH=h;const mkT=fmt=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,fmt,w,h);[[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(([k,v])=>gl.texParameteri(gl.TEXTURE_2D,k,v));return t};
 dCol=mkT(gl.RGBA8);dDep=mkT(gl.DEPTH_COMPONENT24);dFB=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,dFB);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,dCol,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,dDep,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
const water=(()=>{const R=[0];let r=1.2;while(r<60){R.push(r);r+=1.2}while(r<2600){R.push(r);r*=1.07}const A=128,P=[];const pt=(r,a)=>[r*Math.cos(a),0,r*Math.sin(a)];for(let i=0;i<R.length-1;i++)for(let k=0;k<A;k++){const a0=k/A*Math.PI*2,a1=(k+1)/A*Math.PI*2,q=[pt(R[i],a0),pt(R[i+1],a0),pt(R[i+1],a1),pt(R[i],a1)];P.push(...q[0],...q[1],...q[2],...q[0],...q[2],...q[3])}return vao({p:new Float32Array(P)})})();
const emptyVAO=gl.createVertexArray();
const WL=new Float32Array(45);for(let i=0;i<45;i++)WL[i]=hullY(i,1.8);
/* ---------- engine state ---------- */
let alive=true,raf=0;
const RM=!!opts.reducedMotion;
const XR=new Set(['tangki','geladak','jaga','latihan']);
const S={mode:'sambut',draw:true,part:null,roomTints:{},tanks:{},faultParts:[],nav:{cog:null,sog:0},markers:[],ringOn:false,touched:false};

/* ---------- camera ---------- */
const FOV=0.6;
const GEO={yaw:-1.25,pitch:.62,tgt:[1,3.4,0],hx:23,hy:9.5};
const VIEWS={status:{yaw:-1.13,pitch:.2,tgt:[.5,4.8,0],hx:23,hy:10.5},telemetri:{yaw:Math.PI/2,pitch:.95,tgt:[0,1,0],hx:37,hy:33},kerusakan:{yaw:-1.0,pitch:.3,tgt:[0,4.5,0],hx:23,hy:10},tangki:{yaw:1.32,pitch:.24,tgt:[1,2.2,0],hx:23,hy:6.5},geladak:GEO,jaga:GEO,latihan:GEO,'putar-ulang':{yaw:Math.PI/2,pitch:.95,tgt:[0,1,0],hx:37,hy:33},sambut:{yaw:-1.05,pitch:.16,tgt:[0,7.2,0],hx:24,hy:10.5}};
const cam={yaw:-1.1,pitch:.2,dist:90,tgt:[0,5,0]};let tween=null;
function pads(){const p=opts.getPads?opts.getPads():null;return {L:0,R:0,T:0,B:0,...(p||{}),W0:Math.max(1,cv.clientWidth),H0:Math.max(1,cv.clientHeight)}}
function viewTarget(mode){const v=(mode==='telemetri'&&S.nav.cog==null)?{...VIEWS.status,yaw:Math.PI/2+.35,pitch:.5}:(VIEWS[mode]||VIEWS.status),P=pads(),t=Math.tan(FOV/2);const Wa=Math.max(P.W0*.3,P.W0-P.L-P.R),Ha=Math.max(P.H0*.25,P.H0-P.T-P.B);
 const dist=Math.max(v.hy*P.H0/Ha,v.hx*P.H0/Wa)/t*1.06,upx=2*dist*t/P.H0;
 const r=[Math.sin(v.yaw),0,-Math.cos(v.yaw)],d=[Math.cos(v.pitch)*Math.cos(v.yaw),Math.sin(v.pitch),Math.cos(v.pitch)*Math.sin(v.yaw)],u=crs(r,scl(d,-1));
 return {yaw:v.yaw,pitch:v.pitch,dist,tgt:add(add(v.tgt,scl(u,(P.T-P.B)/2*upx)),scl(r,-(P.L-P.R)/2*upx))}}
function goView(animate){const to=viewTarget(S.mode);if(!animate||RM){Object.assign(cam,to);tween=null}else{const dy=((to.yaw-cam.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;tween={t0:performance.now(),from:{yaw:cam.yaw,pitch:cam.pitch,dist:cam.dist,tgt:cam.tgt.slice()},to:{...to,yaw:cam.yaw+dy}}}}
function stepTween(now){if(!tween)return;const t=Math.min(1,(now-tween.t0)/800),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,f=tween.from,to=tween.to;cam.yaw=lerp(f.yaw,to.yaw,e);cam.pitch=lerp(f.pitch,to.pitch,e);cam.dist=Math.exp(lerp(Math.log(f.dist),Math.log(to.dist),e));cam.tgt=lerp3(f.tgt,to.tgt,e);if(t>=1)tween=null}
function camera(){const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw);
 const d=[cp*cy,sp,cp*sy],e=add(cam.tgt,scl(d,cam.dist)),r=[sy,0,-cy],f=scl(d,-1),u=crs(r,f),a=cv.clientWidth/Math.max(1,cv.clientHeight),ortho=S.draw;
 let near,far,proj;if(ortho){const hh=cam.dist*Math.tan(FOV/2);near=Math.max(.5,cam.dist-120);far=cam.dist+120;proj=M.ortho(-hh*a,hh*a,-hh,hh,near,far)}else{near=Math.max(.3,cam.dist*.02);far=4000;proj=M.persp(FOV,a,near,far)}
 return {e,r,u,f,d,a,ortho,near,far,vp:M.mul(proj,M.view(r,u,d,e))}}

/* ---------- render ---------- */
const SUN=nrm([.42,.62,-.46]),FILL=nrm([-.35,.3,.88]),HOR=[.17,.23,.32],ZEN=[.025,.05,.1],DEEP=[.012,.045,.08],SUNC=[.88,.78,.66];
let shipM=M.tr(0,-1.8,0),yawNow=0,rA1=0,rA2=0,simT=0,lastNow=performance.now(),dpr=1;
const LVP=(()=>{const c=[0,4,0],L=SUN,e=add(c,scl(L,90)),r=nrm(crs([0,1,0],L)),u=crs(L,r);return M.mul(M.ortho(-30,30,-30,30,10,180),M.view(r,u,L,e))})();
function modelOf(m){if(m.model==='ship')return shipM;const a=m.model==='r1'?rA1:rA2,p=m.pivot;return M.chain(shipM,M.tr(p[0],0,p[2]),M.ry(a),M.tr(-p[0],0,-p[2]))}
function drawMesh(p,v,mtx,tint){gl.uniformMatrix4fv(p.u('uM'),false,mtx);gl.uniform4fv(p.u('uTint'),tint||[1,1,1,1]);gl.bindVertexArray(v.vao);gl.drawArrays(gl.TRIANGLES,0,v.count)}
function drawSolids(p,decals){for(const m of meshes){if((m.kind==='decal')!==decals)continue;
 if(decals){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,m.tex);gl.uniform1i(p.u('uTex'),1);gl.uniform1f(p.u('uTexOn'),1);gl.uniform1f(p.u('uId'),.6)}else{gl.uniform1f(p.u('uTexOn'),0);gl.uniform1f(p.u('uId'),1)}
 drawMesh(p,m,modelOf(m))}gl.uniform1f(p.u('uTexOn'),0)}
function setMainU(p,c,out,shOn){gl.uniformMatrix4fv(p.u('uVP'),false,c.vp);gl.uniformMatrix4fv(p.u('uLVP'),false,LVP);gl.uniform3fv(p.u('uSun'),SUN);gl.uniform3fv(p.u('uSunC'),SUNC);gl.uniform3fv(p.u('uFill'),FILL);gl.uniform3fv(p.u('uCam'),c.e);gl.uniform3fv(p.u('uCamF'),c.f);
 gl.uniform3fv(p.u('uSkyA'),[.4,.48,.62]);gl.uniform3fv(p.u('uGnd'),[.15,.17,.21]);gl.uniform3fv(p.u('uFog'),HOR);gl.uniform1f(p.u('uFogD'),out?0:.0009);gl.uniform1f(p.u('uOrtho'),c.ortho?1:0);gl.uniform1f(p.u('uOut'),out);gl.uniform1f(p.u('uShOn'),shOn);gl.uniform1f(p.u('uGhost'),0);gl.uniform1f(p.u('uFlat'),0);gl.uniform4fv(p.u('uTint'),[1,1,1,1]);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shT);gl.uniform1i(p.u('uSh'),0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,TEX.glass);gl.uniform1i(p.u('uTex'),1)}
function skyU(p){const x=XR.has(S.mode);gl.uniform3fv(p.u('uSun'),SUN);gl.uniform3fv(p.u('uHor'),x?HOR.map(v=>v*.5):HOR);gl.uniform3fv(p.u('uZen'),ZEN)}
function render(){
 const w=cv.width,h=cv.height,c=camera();
 if(S.draw){ensureDrawFB(w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,dFB);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);
  gl.useProgram(P_MAIN);setMainU(P_MAIN,c,1,0);drawSolids(P_MAIN,false);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-4);drawSolids(P_MAIN,true);gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.disable(gl.DEPTH_TEST);gl.useProgram(P_POST);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,dCol);gl.uniform1i(P_POST.u('uN'),2);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,dDep);gl.uniform1i(P_POST.u('uD'),3);
  gl.uniform2f(P_POST.u('uPx'),1/w,1/h);gl.uniform1f(P_POST.u('uNear'),c.near);gl.uniform1f(P_POST.u('uFar'),c.far);gl.uniform1f(P_POST.u('uOrtho'),1);gl.uniform1f(P_POST.u('uK'),Math.max(1,Math.round(dpr*.8)));
  gl.uniform3fv(P_POST.u('uPaper'),[.035,.065,.115]);gl.uniform3fv(P_POST.u('uInk'),[.8,.88,.95]);gl.uniform3fv(P_POST.u('uShade'),[.06,.11,.18]);gl.uniform3fv(P_POST.u('uLt'),nrm(add(add(scl(c.f,-1),scl(c.u,.7)),scl(c.r,-.4))));
  gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(null);return}
 const xray=XR.has(S.mode),moving=S.nav.cog!=null,sog=moving?Math.max(0,S.nav.sog||0):0;
 if(!xray){gl.bindFramebuffer(gl.FRAMEBUFFER,shFB);gl.viewport(0,0,SM,SM);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2.5,6);
  gl.useProgram(P_SH);gl.uniformMatrix4fv(P_SH.u('uLVP'),false,LVP);for(const m of meshes){if(m.kind!=='solid')continue;gl.uniformMatrix4fv(P_SH.u('uM'),false,modelOf(m));gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count)}gl.disable(gl.POLYGON_OFFSET_FILL)}
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clear(gl.DEPTH_BUFFER_BIT);
 gl.disable(gl.DEPTH_TEST);gl.useProgram(P_SKY);gl.uniform3fv(P_SKY.u('uR'),c.r);gl.uniform3fv(P_SKY.u('uU'),c.u);gl.uniform3fv(P_SKY.u('uF'),c.f);gl.uniform1f(P_SKY.u('uTan'),Math.tan(FOV/2));gl.uniform1f(P_SKY.u('uAsp'),c.a);skyU(P_SKY);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(P_MAIN);setMainU(P_MAIN,c,0,xray?0:1);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 if(!xray){drawSolids(P_MAIN,false);gl.enable(gl.BLEND);gl.depthMask(false);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-4);drawSolids(P_MAIN,true);gl.disable(gl.POLYGON_OFFSET_FILL)}
 else{gl.enable(gl.BLEND);gl.depthMask(false);
  for(const r of ROOMS){const t=S.roomTints[r.id];if(t)drawMesh(P_MAIN,RV[r.id],shipM,t)}
  if(S.mode==='tangki')for(const t of TANKS){const fr=S.tanks[t.id];if(fr>0){const lv=Math.min(1,fr),b=t.z0+.03;gl.uniform1f(P_MAIN.u('uFlat'),.35);drawMesh(P_MAIN,TV[t.id].lv,M.chain(shipM,M.tr(0,b,0),M.sc(1,lv,1),M.tr(0,-b,0)),[...t.col,.85]);gl.uniform1f(P_MAIN.u('uFlat'),0)}drawMesh(P_MAIN,TV[t.id].sv,shipM,[.75,.85,1,.24])}
  gl.uniform1f(P_MAIN.u('uGhost'),.9);drawSolids(P_MAIN,false);gl.uniform1f(P_MAIN.u('uGhost'),0)}
 if(!xray){gl.useProgram(P_WATER);gl.uniformMatrix4fv(P_WATER.u('uVP'),false,c.vp);gl.uniformMatrix4fv(P_WATER.u('uLVP'),false,LVP);gl.uniform1f(P_WATER.u('uT'),simT);gl.uniform1f(P_WATER.u('uAmp'),RM?.5:1);gl.uniform3fv(P_WATER.u('uCam'),c.e);gl.uniform3fv(P_WATER.u('uCamF'),c.f);gl.uniform1f(P_WATER.u('uOrtho'),0);gl.uniform3fv(P_WATER.u('uDeep'),DEEP);gl.uniform1f(P_WATER.u('uFogD'),.0011);
  gl.uniform1f(P_WATER.u('uSpd'),sog*.514);gl.uniform1f(P_WATER.u('uYaw'),yawNow);gl.uniform1f(P_WATER.u('uFoamK'),Math.min(1,sog/8));gl.uniform1fv(P_WATER.u('uWL'),WL);skyU(P_WATER);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shT);gl.uniform1i(P_WATER.u('uSh'),0);gl.bindVertexArray(water.vao);gl.drawArrays(gl.TRIANGLES,0,water.count);
  gl.useProgram(P_MAIN);setMainU(P_MAIN,c,0,0);gl.enable(gl.BLEND);
  if(S.ringOn&&moving){gl.uniform1f(P_MAIN.u('uFlat'),1);drawMesh(P_MAIN,RING,M.id(),[1,1,1,.55]);gl.uniform1f(P_MAIN.u('uFlat'),0)}}
 gl.disable(gl.DEPTH_TEST);gl.useProgram(P_MAIN);gl.uniform1f(P_MAIN.u('uFlat'),1);
 const pul=RM?.3:.24+.12*Math.sin(simT*4);
 for(const id of S.faultParts){const p=PART[id];if(!p)continue;const wp=M.xf(shipM,W(p.p));drawMesh(P_MAIN,SPH,M.chain(M.tr(wp[0],wp[1],wp[2]),M.sc(.85,.85,.85)),[1,.3,.32,pul])}
 if(S.mode==='kerusakan'&&S.part&&PART[S.part]){const wp=M.xf(shipM,W(PART[S.part].p));drawMesh(P_MAIN,SPH,M.chain(M.tr(wp[0],wp[1],wp[2]),M.sc(.6,.6,.6)),[1,1,1,.18])}
 gl.uniform1f(P_MAIN.u('uFlat'),0);gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null)}

/* ---------- markers (HTML buttons positioned over the model) ---------- */
const marksEl=opts.marks;let mkEls=[];
function syncMarkers(){const MK=S.markers;while(mkEls.length<MK.length){const b=document.createElement('button');b.type='button';b.className='v3d-mk';b.innerHTML='<i></i><b></b>';marksEl.appendChild(b);mkEls.push(b)}
 mkEls.forEach((b,i)=>{const m=MK[i];if(!m){b.style.display='none';return}b.style.display='';b.dataset.key=m.key;b.style.color=m.col;b.querySelector('b').textContent=m.label;b.setAttribute('aria-label',m.label);b.classList.toggle('lb',!!m.lb);b.classList.toggle('sel',!!m.sel);b.classList.toggle('pulse',!!m.pulse)})}
function placeMarkers(c){const W0=cv.clientWidth,H0=cv.clientHeight,pos=[];S.markers.forEach((m,i)=>{const b=mkEls[i];if(!b)return;const wp=m.w||M.xf(shipM,W(m.p||(m.r&&RG[m.r]?RG[m.r].c:[0,0,0])));const q=M.x4(c.vp,wp);if(q[3]<=0){b.style.visibility='hidden';return}const x=(q[0]/q[3]*.5+.5)*W0,y=(1-(q[1]/q[3]*.5+.5))*H0;b.style.visibility=(x<-20||x>W0+20||y<-20||y>H0+20)?'hidden':'visible';b.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;if(m.lb||m.sel)pos.push({b,x,y})});
 const PD=pads(),lim=W0-PD.R-6;pos.sort((a,b)=>a.y-b.y);const placed=[];for(const P of pos){const lb=P.b.querySelector('b');const w=lb.offsetWidth||lb.textContent.length*7+20;const fl=P.x+24+w>lim&&P.x-24-w>PD.L;P.b.classList.toggle('flip',fl);const x0=fl?P.x-24-w:P.x+24;let off=0;for(const o of [0,-24,24,-48,48,-72,72,-96,96]){const r=[x0,x0+w,P.y+o-12,P.y+o+12];if(!placed.some(q=>q[0]<r[1]&&q[1]>r[0]&&q[2]<r[3]&&q[3]>r[2])){off=o;placed.push(r);break}}lb.style.marginTop=off+'px'}}
const onMarkClick=e=>{const b=e.target.closest('.v3d-mk');if(b&&b.dataset.key&&opts.onMarker)opts.onMarker(b.dataset.key)};
marksEl.addEventListener('click',onMarkClick);

/* ---------- pointer, wheel, resize ---------- */
function resize(){dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}}
const ro=new ResizeObserver(()=>{resize();if(!tween&&!S.touched)goView(false)});ro.observe(cv);resize();
const ptrs=new Map();
function pan(dx,dy){const c=camera(),k=2*cam.dist*Math.tan(FOV/2)/cv.clientHeight;cam.tgt=add(cam.tgt,add(scl(c.r,-dx*k),scl(c.u,dy*k)))}
const onDown=e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});tween=null;S.touched=true};
const onMove=e=>{const p=ptrs.get(e.pointerId);if(!p)return;
 if(ptrs.size===1){const dx=e.clientX-p.x,dy=e.clientY-p.y;if(e.buttons===2||e.shiftKey)pan(dx,dy);else{cam.yaw+=dx*.006;cam.pitch=Math.min(Math.PI/2,Math.max(XR.has(S.mode)?-.6:.01,cam.pitch+dy*.006))}}
 else if(ptrs.size===2){const ids=[...ptrs.keys()],o=ptrs.get(ids[0]===e.pointerId?ids[1]:ids[0]);const d0=Math.hypot(p.x-o.x,p.y-o.y),d1=Math.hypot(e.clientX-o.x,e.clientY-o.y);if(d0>0&&d1>0)cam.dist=Math.min(600,Math.max(8,cam.dist*d0/d1));pan((e.clientX-p.x)/2,(e.clientY-p.y)/2)}
 ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY})};
const onUp=e=>ptrs.delete(e.pointerId);
const onWheel=e=>{e.preventDefault();tween=null;S.touched=true;cam.dist=Math.min(600,Math.max(8,cam.dist*Math.exp(e.deltaY*.0012)))};
const onCtx=e=>e.preventDefault();
const onLost=e=>{e.preventDefault();alive=false;cancelAnimationFrame(raf);if(opts.onLost)opts.onLost()};cv.addEventListener('webglcontextlost',onLost);
cv.addEventListener('pointerdown',onDown);cv.addEventListener('pointermove',onMove);cv.addEventListener('pointerup',onUp);cv.addEventListener('pointercancel',onUp);cv.addEventListener('wheel',onWheel,{passive:false});cv.addEventListener('contextmenu',onCtx);

/* ---------- loop ---------- */
goView(false);
function loop(now){if(!alive)return;const dt=Math.min(.1,(now-lastNow)/1000);lastNow=now;stepTween(now);
 if(!document.hidden){simT+=dt;
  if(S.mode==='sambut'&&!RM&&!ptrs.size&&!tween)cam.yaw+=dt*.12;
  const target=S.nav.cog!=null?(90-(S.nav.heading!=null?S.nav.heading:S.nav.cog))*Math.PI/180:0;const dy=((target-yawNow+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;yawNow+=dy*Math.min(1,dt*3);
  if(!RM){rA1+=dt*2.5;rA2+=dt*3.3}
  const bob=RM||S.draw?0:1,roll=.018*Math.sin(simT*.9)*bob,pit=.008*Math.sin(simT*.63+1)*bob,hv=.06*Math.sin(simT*.75)*bob;
  shipM=M.chain(M.tr(0,hv,0),M.ry(yawNow),M.rx(roll),M.rz(pit),M.tr(0,-1.8,0));
  render();placeMarkers(camera())}
 raf=requestAnimationFrame(loop)}
raf=requestAnimationFrame(loop);

return {
 set(p){const prev=S.mode;Object.assign(S,p);if('markers' in p)syncMarkers();if(p.mode&&p.mode!==prev){S.draw=p.mode==='sambut';S.touched=false;requestAnimationFrame(()=>goView(true))}},
 view(animate){S.touched=false;goView(!!animate)},
 destroy(){alive=false;cancelAnimationFrame(raf);ro.disconnect();cv.removeEventListener('pointerdown',onDown);cv.removeEventListener('pointermove',onMove);cv.removeEventListener('pointerup',onUp);cv.removeEventListener('pointercancel',onUp);cv.removeEventListener('wheel',onWheel);cv.removeEventListener('contextmenu',onCtx);cv.removeEventListener('webglcontextlost',onLost);marksEl.removeEventListener('click',onMarkClick);marksEl.innerHTML='';mkEls=[]}
};
}
