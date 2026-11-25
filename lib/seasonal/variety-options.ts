/** National reference for maize in Togo; cycle is sowing to 50% maturity. */
export type TogoMaizeVariety = {
 id: string; name: string; synonym: string; daysMin: number; daysMax: number; campaignName: string;
};
export const TOGO_MAIZE_VARIETY_SOURCE = {
 title: "ANAMET / Ministère de l’Agriculture du Togo, Bulletin agro-hydro-météorologique 2024, n° 002, tableau 2.5",
 published: "2024-04-23",
 url: "https://agriculture.gouv.tg/wp-content/uploads/2024/05/BULLETIN-GTP-2-1.pdf",
};
export const TOGO_MAIZE_VARIETIES: TogoMaizeVariety[] = [
 {id:"tzee",name:"TZEE",synonym:"TZEE W Pop STR QPM",daysMin:80,daysMax:85,campaignName:"TZEE (TZEE W Pop STR QPM)"},
 {id:"iken-ne",name:"Ikenne",synonym:"Ikenne 9449 SR",daysMin:100,daysMax:105,campaignName:"Ikenne (Ikenne 9449 SR)"},
 {id:"sotubaka",name:"Sotubaka",synonym:"",daysMin:100,daysMax:110,campaignName:"Sotubaka"},
 {id:"opeaburo",name:"Opeaburo",synonym:"",daysMin:110,daysMax:115,campaignName:"Opeaburo"},
 {id:"lamatessi",name:"Lamatessi",synonym:"NU88 237",daysMin:110,daysMax:120,campaignName:"Lamatessi (NU88 237)"},
 {id:"adeta",name:"Adéta",synonym:"NU86012",daysMin:110,daysMax:120,campaignName:"Adéta (NU86012)"},
 {id:"samaz",name:"Samaz",synonym:"Sammaz 52",daysMin:110,daysMax:120,campaignName:"Samaz (Sammaz 52)"},
 {id:"tzpb",name:"TZPB",synonym:"TZPB SR W Bénin",daysMin:115,daysMax:120,campaignName:"TZPB (TZPB SR W Bénin)"},
];
export function varietyMaturityWindow(sowingDate:string,daysMin:number,daysMax:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(sowingDate)||!Number.isFinite(Date.parse(sowingDate))||new Date(sowingDate+"T12:00:00Z").toISOString().slice(0,10)!==sowingDate)throw new Error("Date de semis invalide.");
 if(!Number.isInteger(daysMin)||!Number.isInteger(daysMax)||daysMin<1||daysMax<daysMin||daysMax>366)throw new Error("Plage de cycle invalide.");
 const start=Date.parse(sowingDate+"T12:00:00Z");
 const date=(days:number)=>new Date(start+days*86400000).toISOString().slice(0,10);
 return {from:date(daysMin),to:date(daysMax)};
}
