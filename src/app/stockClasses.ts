/* Supply classes shared by Stock and Dashboard. */
type RowData=Record<string,any>;
export type StockClass={id:string;title:string;name:string;description:string;defaultCategory:string;subgroups:string[]};
export const stockClasses:StockClass[]=[
 {id:"I",title:"CLASS I",name:"SUBSISTENCE",description:"Bahan makanan, air minum dan kebutuhan konsumsi kapal",defaultCategory:"Class I · Subsistence",subgroups:["Air Tawar","Perbekalan kering","Cold storage","Air minum galon"]},
 {id:"III",title:"CLASS III",name:"FUEL",description:"HSD sebagai bahan bakar utama kapal dan bahan bakar skoci",defaultCategory:"BBM",subgroups:["HSD · Bahan bakar utama kapal","Bahan Bakar Skoci"]},
 {id:"IV",title:"CLASS IV",name:"DAMAGE CONTROL",description:"Perlengkapan pemadam, penanggulangan kebocoran dan perbaikan darurat",defaultCategory:"Class IV · Damage Control",subgroups:["Pemadam kebakaran","Material perbaikan darurat","Pengendalian banjir/kebocoran","Peralatan pendukung"]},
 {id:"V",title:"CLASS V",name:"AMMUNITION",description:"Inventaris amunisi dengan akses terbatas dan pencatatan akuntabilitas",defaultCategory:"Amunisi",subgroups:["Inventaris dan rekonsiliasi terbatas"]},
 {id:"VIII",title:"CLASS VIII",name:"MEDICAL STORES",description:"Obat-obatan dan perlengkapan kesehatan",defaultCategory:"Class VIII · Medical Stores",subgroups:["Obat-obatan","P3K dan wound care","Bahan medis habis pakai","Diagnostik"]},
 {id:"IX",title:"CLASS IX",name:"SPARE PARTS",description:"Suku cadang mesin, elektronika, listrik dan perlengkapan geladak",defaultCategory:"Class IX · Spare Parts",subgroups:["Mesin","Elektronika dan listrik","Tali-temali dan deck equipment","Cat dan bahan pemeliharaan"]}
];
export function itemBelongsToStockClass(item:RowData,classId:string){
 if(item.supply_class)return String(item.supply_class)===classId;
 const c=String(item.category||"").toLowerCase().trim();
 if(classId==="I")return ["air tawar","class i · subsistence","subsistence","provisions"].includes(c)||c.startsWith("class i -");
 if(classId==="III")return ["bbm","class iii · fuel","fuel","hsd","bahan bakar"].includes(c)||c.startsWith("class iii -");
 if(classId==="IV")return c.includes("damage control")||c.startsWith("class iv");
 if(classId==="V")return c==="amunisi"||c.includes("class v");
 if(classId==="VIII")return c.includes("medical stores")||c.startsWith("class viii");
 if(classId==="IX")return c.includes("spare parts")||c.startsWith("class ix");
 return false;
}
