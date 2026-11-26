/* Affiche uniquement les géométries et les doses renvoyées par l'analyse du Worker. */
function paintGeoZoneMap(ctx,field,collection,isDose) {
  if (!collection?.features?.length || !field.imageBounds) return;
  const b=field.imageBounds;
  const X=lon=>96+(lon-b[0])/(b[2]-b[0])*768;
  const Y=lat=>80+(b[3]-lat)/(b[3]-b[1])*480;
  const colors={low:"#90b8df",medium:"#497da9",high:"#173d63",variable:"#d5ae6d",unknown:"#e2e8ef"};
  const rates=isDose?collection.features.map(f=>f.properties?.dose).filter(Number.isFinite):[];
  const min=Math.min(...rates),max=Math.max(...rates);
  ctx.save();ctx.globalAlpha=.88;
  for(const feature of collection.features) {
    const polygons=feature.geometry?.type==="MultiPolygon"?feature.geometry.coordinates:[];
    ctx.fillStyle=isDose&&Number.isFinite(feature.properties?.dose)
      ? palette(max>min?(feature.properties.dose-min)/(max-min):.5)
      : colors[feature.properties?.zone] || colors.unknown;
    for(const polygon of polygons) {
      ctx.beginPath();
      for(const ring of polygon) {
        ring.forEach(([lon,lat],i)=>i?ctx.lineTo(X(lon),Y(lat)):ctx.moveTo(X(lon),Y(lat)));
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
  }
  ctx.restore();
}

function paintWorkerZoneCells(ctx,field,layer) {
  const map=field.zoneMapData?.revision===field.revision?field.zoneMapData:null;
  if (!map) return;
  const isDose=layer==="dose";
  paintGeoZoneMap(ctx,field,isDose?map.dose:map.historical,isDose);
}

function paintFieldIndex(ctx, field, layer, date) {
  const result = field.indexMaps?.get(date);
  if (!result) return;
  const [west, south, east, north] = field.imageBounds;
  const project = ([lon, lat]) => [96 + (lon - west) / (east - west) * 768, 80 + (north - lat) / (north - south) * 480];
  const property = layer === "evi" ? "evi" : "ndvi";
  const median = result.observations[0].ndviMedian;
  ctx.save();
  ctx.beginPath();
  for (const ring of field.geometry.coordinates) {
    ring.forEach((point, i) => (i ? ctx.lineTo(...project(point)) : ctx.moveTo(...project(point))));
    ctx.closePath();
  }
  ctx.clip("evenodd");
  ctx.globalAlpha = .84;
  for (const pixel of result.pixels) {
    const value = pixel[property];
    ctx.fillStyle = palette(layer === "contrast" ? .5 + (value - median) * 2.35 : (value - .25) / .50);
    pathPolygon(ctx, pixel.ring.map(project));
    ctx.fill();
  }
  ctx.restore();
}
