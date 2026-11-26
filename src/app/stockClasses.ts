/* Supply classes shared by Stock and Dashboard. */
type RowData=Record<string,any>;
export type StockClass={id:string;title:string;name:string;description:string;defaultCategory:string;subgroups:string[]};
export const stockClasses:StockClass[]=[
 {id:"I",title:"CLASS I",name:"SUBSISTENCE",description:"Food, drinking water and ship provisions",defaultCategory:"Class I · Subsistence",subgroups:["Fresh water","Dry provisions","Cold storage","Bottled drinking water"]},
 {id:"III",title:"CLASS III",name:"FUEL",description:"HSD as main ship fuel and rescue boat fuel",defaultCategory:"BBM",subgroups:["HSD · main ship fuel","Rescue boat fuel"]},
 {id:"IV",title:"CLASS IV",name:"DAMAGE CONTROL",description:"Firefighting, leak control and emergency repair equipment",defaultCategory:"Class IV · Damage Control",subgroups:["Firefighting","Emergency repair material","Flood/leak control","Support equipment"]},
 {id:"V",title:"CLASS V",name:"AMMUNITION",description:"Ammunition inventory with restricted access and accountability records",defaultCategory:"Amunisi",subgroups:["Restricted inventory and reconciliation"]},
 {id:"VIII",title:"CLASS VIII",name:"MEDICAL STORES",description:"Medicines and medical supplies",defaultCategory:"Class VIII · Medical Stores",subgroups:["Medicines","First aid and wound care","Medical consumables","Diagnostics"]},
 {id:"IX",title:"CLASS IX",name:"SPARE PARTS",description:"Spare parts for engines, electronics, electrical and deck equipment",defaultCategory:"Class IX · Spare Parts",subgroups:["Engines","Electronics and electrical","Ropes and deck equipment","Paint and maintenance materials"]}
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
