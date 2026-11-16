const SENTINEL_HOST='deafrica-sentinel-2.s3.af-south-1.amazonaws.com';
const EARTH_SEARCH_HOST='sentinel-cogs.s3.us-west-2.amazonaws.com';
const C1_DEAFRICA_HOST='deafrica-sentinel-2-l2a-c1.s3.af-south-1.amazonaws.com';
const C1_EARTH_SEARCH_HOST='e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com';

/** Convert only the public DE Africa Sentinel bucket to HTTPS; never follow a STAC asset host. */
export function sentinelAssetUrl(href:unknown):string{
 if(typeof href!=='string'||href.length>2000)throw new Error('Asset Sentinel-2 invalide.');
 let url:URL;
 if(href.startsWith('s3://deafrica-sentinel-2/'))url=new URL(href.slice('s3://deafrica-sentinel-2/'.length),`https://${SENTINEL_HOST}/`);
 else if(href.startsWith('s3://deafrica-sentinel-2-l2a-c1/'))url=new URL(href.slice('s3://deafrica-sentinel-2-l2a-c1/'.length),`https://${C1_DEAFRICA_HOST}/`);
 else {try{url=new URL(href);}catch{throw new Error('URL Sentinel-2 invalide.');}}
 const prefix=[C1_DEAFRICA_HOST,C1_EARTH_SEARCH_HOST].includes(url.hostname)?'/sentinel-2-c1-l2a/':'/sentinel-s2-l2a-cogs/';
 if(url.protocol!=='https:'||![SENTINEL_HOST,EARTH_SEARCH_HOST,C1_DEAFRICA_HOST,C1_EARTH_SEARCH_HOST].includes(url.hostname)||url.username||url.password||url.port||url.search||url.hash||!url.pathname.startsWith(prefix))throw new Error('Asset Sentinel-2 hors du catalogue public autorisé.');
 return url.toString();
}

