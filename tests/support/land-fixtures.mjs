import {assessLandGeometry} from '../../lib/seasonal/land.ts';
export const fixtureTime=new Date().toISOString();
/** @type {import('../../lib/seasonal/parcel.ts').ParcelPolygon} */
export const testParcel={type:'Polygon',coordinates:[[[1.2,9.5],[1.2004,9.5],[1.2004,9.5004],[1.2,9.5004],[1.2,9.5]]]};
export function landFixture(shape,value=40){return assessLandGeometry(shape,[{id:'worldcover',status:'available',provider:'Test only',product:'Synthetic fixture, not satellite acquisition',version:'test-1',referencePeriod:null,observedAt:null,acquiredAt:fixtureTime,resolutionM:10,crs:'EPSG:4326',cells:[{id:'test-cell',value,geometry:shape}],reason:null,assets:[],limitations:['Synthetic test only']}],fixtureTime);}
