import test from 'node:test';
import assert from 'node:assert/strict';
import {basemapTilePlan,framePoint,imageScale,parcelImageCoverage} from '../lib/seasonal/imagery-display.ts';
const b=[1,8,1.003,8.002];
test('Esri tile requests are bounded, retain a fixed recipient and avoid the failing export endpoint',()=>{
 const p=basemapTilePlan(b);assert.ok(p.z<=19&&p.z>10);assert.ok(p.tiles.length>0&&p.tiles.length<=30);
 for(const t of p.tiles){const u=new URL(t.src);assert.equal(u.origin,'https://services.arcgisonline.com');assert.match(u.pathname,/World_Imagery\/MapServer\/tile\//);assert.ok(Number.isFinite(t.left)&&Number.isFinite(t.top)&&t.width>0&&t.height>0);}
 assert.equal(basemapTilePlan(b,-1).z,p.z-1);
 assert.throws(()=>basemapTilePlan(b,-3));assert.throws(()=>basemapTilePlan([0,0,300,80]));
});
test('tile seams remain aligned in the same geographic frame as the observation and contour',()=>{
 const p=basemapTilePlan(b),row=p.tiles.filter(t=>t.top===p.tiles[0].top);
 for(let i=1;i<row.length;i++)assert.ok(Math.abs(row[i-1].left+row[i-1].width-row[i].left)<1e-7);
 const south=p.tiles.find(t=>t.top>p.tiles[0].top)!;assert.ok(Math.abs(p.tiles[0].top+p.tiles[0].height-south.top)<1e-7);
 assert.deepEqual(framePoint([b[0],b[3]],b),[0,0]);assert.deepEqual(framePoint([b[2],b[1]],b),[640,400]);
 const scale=imageScale(b);assert.ok(scale.pixels>0&&scale.pixels<=160);assert.ok(scale.meters>0);
});
test('coverage uses only pixels in the parcel and excludes holes rather than nearby vegetation',()=>{
 const rgba=new Uint8ClampedArray(64*40*4),outer=[[0,0],[640,0],[640,400],[0,400],[0,0]];
 for(let y=0;y<40;y++)for(let x=0;x<32;x++)rgba[(y*64+x)*4+3]=255;
 assert.equal(parcelImageCoverage(rgba,64,40,[outer]).percent,50);
 const right=[[320,0],[640,0],[640,400],[320,400],[320,0]];
 assert.equal(parcelImageCoverage(rgba,64,40,[right]).percent,0,'An image outside the contour does not make the parcel covered');
 assert.equal(parcelImageCoverage(rgba,64,40,[outer,right]).percent,100,'Holes are excluded from the denominator');
});
test('a subpixel parcel is unquantified rather than reported as zero or fully covered',()=>{
 const tiny=[[0,0],[1,0],[1,1],[0,1],[0,0]];
 assert.equal(parcelImageCoverage(new Uint8ClampedArray(64*40*4),64,40,[tiny]).percent,null);
});
