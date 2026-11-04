/** FAO56, table 24 / equation 90. Seasonal response, not a local calibration. */
export const KY_VERSION='FAO56-table24-seasonal-2';
export const FAO_SOURCE='https://www.fao.org/4/x0490e/x0490e0e.htm';
export const SEASONAL_KY:Record<string,number>={maize:1.25,sorghum:.9,soybean:.85,groundnut:.7,tomato:1.05,cabbage:.95,watermelon:1.1,onion:1.1,'bell-pepper':1.1};

/** Conservative operating range shared by absolute and relative water responses. */
export function seasonalWaterFactor(eta:number,etm:number,ky:number):number|null{
 if(![eta,etm,ky].every(Number.isFinite)||etm<=0||eta<0||eta>etm+1e-7)return null;
 const ratio=eta/etm,factor=1-ky*(1-ratio);
 return ratio<.5||factor<0||factor>1?null:factor;
}
