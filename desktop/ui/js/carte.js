/* Données et interface intégrées pour une ouverture locale du fichier. */
const AERIAL_IMAGE = "assets/terrain.webp";

const DAYS = [6, 11, 16, 20, 25];
const WORLD = { width: 960, height: 640 };
const CELL = 10;
const STORAGE_KEY = "agriprevision.maquette.desktop.v2";
const LAYERS = { satellite: "Satellite", ndvi: "NDVI", contrast: "NDVI contrasté", evi: "EVI", zones: "Zones historiques", dose: "Carte de doses" };
const NAMES = ["Faible", "Moyenne", "Élevée"];
const ZONE_COLORS = ["#eec379", "#98bda9", "#35866e"];
const DOSES = [30, 45, 60];
const RAMP = [[222, 113, 74], [235, 185, 82], [178, 203, 106], [100, 164, 104], [41, 116, 79]];
const DEMO_FIELDS = [
  {
    id: "kpele", name: "Champ de Kpélé", crop: "Maïs", area: 17.64, sowing: "12 sept. 2026", rain: 24,
    ndvi: [.43, .49, .54, .58, .62], notePoint: [333, 366],
    action: "Observer la bordure ouest",
    actionDetail: "La vigueur y est plus faible sur les dernières images. Comparez l’état des plants et l’humidité du sol avec le reste du champ.",
    shape: [[248, 418], [250, 372], [267, 326], [290, 267], [311, 245], [518, 194], [539, 182], [602, 189], [691, 209], [702, 223], [688, 290], [665, 365], [646, 423], [607, 484], [571, 475], [480, 456], [367, 435], [307, 429]]
  },
  {
    id: "sodji", name: "Bas-fond Sodji", crop: "Riz", area: 8.4, sowing: "28 août 2026", rain: 28,
    ndvi: [.50, .55, .62, .65, .68], notePoint: [160, 151],
    action: "Vérifier l’état du bas-fond",
    actionDetail: "Comparez la zone basse avec la partie haute du champ lors du prochain passage.",
    shape: [[64, 76], [90, 44], [139, 53], [202, 72], [247, 77], [285, 96], [314, 113], [306, 169], [287, 218], [269, 273], [228, 256], [190, 241], [143, 225], [107, 202], [91, 175], [78, 142]]
  },
  {
    id: "adeta", name: "Parcelle Adéta", crop: "Sorgho", area: 5.21, sowing: "1 oct. 2026", rain: 19,
    ndvi: [.34, .40, .46, .50, .56], notePoint: [752, 456],
    action: "Revoir la limite sud",
    actionDetail: "Suivez l’évolution des bandes de vigueur après les pluies de la semaine.",
    shape: [[609, 500], [628, 461], [656, 422], [685, 404], [723, 387], [775, 363], [891, 405], [875, 468], [850, 516], [849, 574], [831, 615], [763, 594], [679, 567], [645, 544], [610, 523]]
  }
];
const DEMO_NOTES = [
  { id: "k-1", fieldId: "kpele", point: [333, 366], title: "Bordure ouest à revoir", body: "Vigueur plus faible près de la piste. Vérifier les plants lors du prochain passage.", label: "23 nov. 2026" },
  { id: "k-2", fieldId: "kpele", point: [547, 378], title: "Couverture régulière au centre", body: "Les rangs sont réguliers sur cette partie du champ.", label: "16 nov. 2026" },
  { id: "s-1", fieldId: "sodji", point: [167, 169], title: "Niveau d’eau à vérifier", body: "Observer le bas de la parcelle lors du prochain passage.", label: "20 nov. 2026" }
];

const iconPaths = {
  brand: "M2.5 8.5 12 3l9.5 5.5L12 14z M2.5 12l9.5 5.5 9.5-5.5 M2.5 15.5 12 21l9.5-5.5 M12 7.4l3.1 1.8-3.1 1.8L8.9 9.2z",
  fields: "M3.5 5.5l5.7-2 5.6 2 5.7-2v15l-5.7 2-5.6-2-5.7 2z M9.2 3.5v15 M14.8 5.5v15",
  compare: "M3.5 5.5h17v13h-17z M12 5.5v13 M7.6 12h1 M15.4 12h1",
  layers: "M3 8l9-4.5L21 8l-9 4.5z M3 12l9 4.5 9-4.5 M3 16l9 4.5 9-4.5",
  note: "M5 3.5h10l4 4v13H5z M14.5 3.5v4.7H19 M8.5 12h7 M8.5 15.8h5.5",
  calendar: "M4 5.5h16v15H4z M4 9.5h16 M8 3.5v4 M16 3.5v4 M8.5 14h2.2 M13.5 14h2.2 M8.5 17h2.2",
  search: "M10.5 4.5a6 6 0 1 0 0 12 6 6 0 1 0 0-12 M15 15l4.5 4.5",
  plus: "M5 12h14 M12 5v14",
  minus: "M5 12h14",
  rain: "M7 15.5a3.5 3.5 0 0 1-.4-7 5 5 0 0 1 9.5 1.5 2.8 2.8 0 0 1 .7 5.5H7 M8.5 18l-1 2 M12.5 18l-1 2 M16.5 18l-1 2",
  pin: "M12 21s6.6-4.7 6.6-11a6.6 6.6 0 1 0-13.2 0C5.4 16.3 12 21 12 21z M12 7.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 1 0 0-4.4",
  expand: "M8.5 4.5h-4v4 M15.5 4.5h4v4 M4.5 15.5v4h4 M19.5 15.5v4h-4",
  contract: "M4.5 8.5h4v-4 M19.5 8.5h-4v-4 M4.5 15.5h4v4 M19.5 15.5h-4v4",
  target: "M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12 M12 3v3 M12 18v3 M3 12h3 M18 12h3 M12 11.5h.01",
  left: "M14.5 6.5 9 12l5.5 5.5",
  right: "M9.5 6.5 15 12l-5.5 5.5",
  link: "M10.5 13.5l3-3 M8.9 16.9l-1.7 1.7a3.2 3.2 0 1 1-4.5-4.5L7 9.8a3.2 3.2 0 0 1 4.1-.3 M15.1 7.1l1.7-1.7a3.2 3.2 0 1 1 4.5 4.5L17 14.2a3.2 3.2 0 0 1-4.1.3"
};

const element = (id) => document.getElementById(id);
const mapCanvases = [element("map-a"), element("map-b")];
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const indexNumber = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedIndex = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const saved = readSaved();
const fields = DEMO_FIELDS.concat(saved.fields);
const localFields = fields.slice();
const notes = DEMO_NOTES.concat(saved.notes);
const geography = new Map();
const state = {
  fieldId: "kpele", view: "fields", layer: "ndvi", zoneLayer: "zones", day: DAYS.length - 1,
  comparisonDays: [1, DAYS.length - 1], comparisonLayers: ["ndvi", "ndvi"],
  camera: { x: 480, y: 328, zoom: 1 }, noteId: null, expanded: false,
  draft: null, notePoint: null
};
const aerial = new Image();
let drawRequested = false;
let messageTimer = 0;
let pan = null;

function readSaved() {
  try {
    const item = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { fields: Array.isArray(item.fields) ? item.fields : [], notes: Array.isArray(item.notes) ? item.notes : [] };
  } catch {
    return { fields: [], notes: [] };
  }
}

function persist() {
  try {
    if (!fields.some(field => field.remote)) localFields.splice(0, localFields.length, ...fields);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      fields: localFields.slice(DEMO_FIELDS.length),
      notes: notes.slice(DEMO_NOTES.length)
    }));
    return true;
  } catch {
    return false;
  }
}

function putText(id, value) {
  element(id).textContent = value;
}

function makeNode(tag, className, value) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (value !== undefined) result.textContent = value;
  return result;
}

function makeIcon(name, small = false) {
  const canvas = makeNode("canvas", small ? "icon small" : "icon");
  canvas.dataset.icon = name;
  canvas.setAttribute("aria-hidden", "true");
  return canvas;
}

function paintIcons() {
  document.querySelectorAll("canvas[data-icon]").forEach((canvas) => {
    const color = getComputedStyle(canvas).color;
    const key = canvas.dataset.icon + color;
    if (canvas.dataset.drawn === key) return;
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.65;
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.stroke(new Path2D(iconPaths[canvas.dataset.icon]));
    canvas.dataset.drawn = key;
  });
}

function currentField() {
  return fields.find((field) => field.id === state.fieldId);
}

function dateLabel(i, withYear = false) {
  return DAYS[i] + " nov." + (withYear ? " 2026" : "");
}

function sameIndex(layer) {
  return layer === "ndvi" || layer === "contrast";
}

function observedIndex(field, day, layer = "ndvi") {
  if (!field.ndvi) return null;
  const ndvi = field.ndvi[day];
  return layer === "evi" ? ndvi * .83 - .03 : ndvi;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function contains(shape, x, y) {
  let inside = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, yi] = shape[i];
    const [xj, yj] = shape[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function blob(x, y, cx, cy, wx, wy) {
  return Math.exp(-(((x - cx) / wx) ** 2 + ((y - cy) / wy) ** 2));
}

function spatialData(field) {
  if (geography.has(field.id)) return geography.get(field.id);
  const xs = field.shape.map(([x]) => x);
  const ys = field.shape.map(([, y]) => y);
  const bounds = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const width = bounds.x1 - bounds.x0;
  const height = bounds.y1 - bounds.y0;
  const center = [(bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2];
  const tiles = [];
  const totals = [0, 0, 0];
  const sums = DAYS.map(() => 0);
  let samples = 0;

  if (field.ndvi) {
    for (let y = Math.floor(bounds.y0 / CELL) * CELL; y < bounds.y1; y += CELL) {
      for (let x = Math.floor(bounds.x0 / CELL) * CELL; x < bounds.x1; x += CELL) {
        const u = (x + CELL / 2 - bounds.x0) / width;
        const v = (y + CELL / 2 - bounds.y0) / height;
        const texture = Math.sin(x * 18.321 + y * 78.119) * 24634.1;
        const noise = (texture - Math.floor(texture) - .5) * .042;
        const weak = blob(u, v, .23, .60, .23, .30);
        const ridge = blob(u, v, .65, .35, .27, .34);
        const edge = blob(u, v, .59, .91, .37, .17);
        const bands = .028 * Math.sin(u * 19 + v * 9) + .019 * Math.cos(v * 22 - u * 5);
        const stable = -.27 * weak + .15 * ridge - .09 * edge + bands + noise;
        const trend = DAYS.map((_, i) =>
          stable + i / (DAYS.length - 1) * (
            .085 * blob(u, v, .46, .55, .27, .40) - .032 * weak + .022 * Math.sin(u * 9 + v * 7)
          )
        );
        const zone = stable < -.09 ? 0 : stable < .045 ? 1 : 2;
        if (contains(field.shape, x + CELL / 2, y + CELL / 2)) {
          totals[zone] += 1;
          trend.forEach((v, i) => { sums[i] += v; });
          samples += 1;
        }
        tiles.push({ x, y, trend, zone });
      }
    }
  }

  const marks = sums.map((sum) => sum / Math.max(1, samples));
  const areas = totals.map((count) => Math.round(field.area * count / Math.max(1, samples) * 100) / 100);
  if (samples) {
    const largest = totals.indexOf(Math.max(...totals));
    areas[largest] += Math.round((field.area - areas.reduce((a, b) => a + b, 0)) * 100) / 100;
  }
  const result = { bounds, center, width, height, tiles, marks, areas };
  geography.set(field.id, result);
  return result;
}

function palette(value) {
  const scaled = clamp(value, 0, 1) * (RAMP.length - 1);
  const first = Math.min(RAMP.length - 2, Math.floor(scaled));
  const mix = scaled - first;
  const rgb = RAMP[first].map((channel, i) => Math.round(channel + (RAMP[first + 1][i] - channel) * mix));
  return "rgb(" + rgb.join(",") + ")";
}

function activeLayer(field) {
  if (field.remote) return field.imageLayer === "ndvi" ? "ndvi" : "satellite";
  if (!state.draft && state.view === "decisions") return decisionLayer(field);
  if (state.draft || !field.ndvi || state.view === "notes" || state.view === "campaign") return "satellite";
  return state.view === "zones" ? state.zoneLayer : state.layer;
}

function isComparing() {
  const field = currentField();
  return !state.draft && state.view === "compare" && (field.remote || !!field.ndvi);
}

function projection(width, height) {
  const field = currentField();
  const camera = state.camera;
  const fullScale = Math.max(width / WORLD.width, height / WORLD.height);
  const area = spatialData(field);
  const baseScale = hasSplitMap()
    ? clamp(width / (Math.max(area.width * 1.24, 290)), height / (WORLD.height * 2.55), fullScale)
    : fullScale;
  const scale = baseScale * camera.zoom;
  const halfX = width / (2 * scale);
  const halfY = height / (2 * scale);
  const centerX = halfX * 2 > WORLD.width
    ? WORLD.width / 2
    : clamp(camera.x, halfX, WORLD.width - halfX);
  const centerY = halfY * 2 > WORLD.height
    ? clamp(camera.y, WORLD.height * .30, WORLD.height * .70)
    : clamp(camera.y, halfY, WORLD.height - halfY);
  return { scale, left: width / 2 - centerX * scale, top: height / 2 - centerY * scale, centerX, centerY };
}

function matchCanvas(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext("2d", { alpha: canvas.classList.contains("chart") });
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function pathPolygon(ctx, shape) {
  ctx.beginPath();
  shape.forEach(([x, y], i) => {
    if (!i) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function paintAerial(ctx, width, height, frame, day, layer, side = null) {
  if (currentField().remote) {
    ctx.fillStyle = "#e9eee5";
    ctx.fillRect(0, 0, width, height);
    const field = currentField();
    const date = side === null ? field.imageDate : field.compareDates?.[side];
    const key = date + ":" + (layer === "ndvi" ? "ndvi" : "rgb");
    const image = field.remoteImages?.get(key);
    if (image?.complete && image.naturalWidth) {
      ctx.save();
      ctx.translate(frame.left, frame.top);
      ctx.scale(frame.scale, frame.scale);
      ctx.drawImage(image, 96, 80, 768, 480);
      ctx.restore();
    }
    ctx.fillStyle = "#61766a";
    ctx.font = "600 12px Agri Sans, Open Sans, sans-serif";
    ctx.fillText(image ? "Image du " + date + " · Digital Earth Africa" :
      "Contour de la campagne · image à charger", 24, 32);
    return;
  }
  ctx.fillStyle = "#40563c";
  ctx.fillRect(0, 0, width, height);
  if (!aerial.naturalWidth) return;
  const scaledWidth = WORLD.width * frame.scale;
  const scaledHeight = WORLD.height * frame.scale;
  const brightness = layer === "satellite" ? .87 + .025 * (day % 3) : .74;
  ctx.imageSmoothingQuality = "high";
  for (let tileY = -1; tileY <= 1; tileY++) {
    for (let tileX = -1; tileX <= 1; tileX++) {
      const x = frame.left + tileX * scaledWidth;
      const y = frame.top + tileY * scaledHeight;
      if (x >= width || x + scaledWidth <= 0 || y >= height || y + scaledHeight <= 0) continue;
      ctx.save();
      ctx.filter = "brightness(" + brightness + ") saturate(.88)";
      ctx.translate(x + (tileX ? scaledWidth : 0), y + (tileY ? scaledHeight : 0));
      ctx.scale(tileX ? -1 : 1, tileY ? -1 : 1);
      ctx.drawImage(aerial, 0, 0, scaledWidth + .6, scaledHeight + .6);
      ctx.restore();
    }
  }
}

function paintOverlay(ctx, field, layer, day) {
  if (field.remote) { paintWorkerZoneCells(ctx,field); return; }
  if (layer === "satellite" || !field.ndvi) return;
  if (paintDecisionOverlay(ctx,field,layer)) return;
  const { tiles, marks } = spatialData(field);
  const base = observedIndex(field, day, layer);
  ctx.save();
  pathPolygon(ctx, field.shape);
  ctx.clip();
  ctx.globalAlpha = layer === "zones" || layer === "dose" ? .84 : .82;
  for (const tile of tiles) {
    const local = tile.trend[day] - marks[day];
    if (layer === "zones" || layer === "dose") {
      ctx.fillStyle = ZONE_COLORS[tile.zone];
    } else if (layer === "contrast") {
      ctx.fillStyle = palette(.5 + local * 2.35);
    } else {
      const value = base + local * (layer === "evi" ? .83 : 1);
      ctx.fillStyle = palette((value - .25) / .50);
    }
    ctx.fillRect(tile.x, tile.y, CELL + .35, CELL + .35);
  }
  ctx.restore();
}

function renderMap(canvas, layer, day) {
  const surface = matchCanvas(canvas);
  if (!surface) return;
  const { ctx, width, height } = surface;
  const frame = projection(width, height);
  const field = currentField();
  paintAerial(ctx, width, height, frame, day, layer,
    field.remote && isComparing() ? (canvas.id === "map-b" ? 1 : 0) : null);
  if (field.remote && !field.geometryAvailable) {
    ctx.fillStyle = "#3d594a";
    ctx.font = "600 16px Agri Sans, Open Sans, sans-serif";
    ctx.fillText("Contour indisponible pour cette campagne", 24, 85);
    return;
  }
  ctx.save();
  ctx.translate(frame.left, frame.top);
  ctx.scale(frame.scale, frame.scale);

  const pump = !field.remote && state.view === "decisions" && decisionState.topic === "water" &&
    chooseDraft(field,"water").mode === "pump" ? computePump(chooseDraft(field,"water")) : null;
  if (pump) {
    pump.rows.filter(row => !row.missing && row.minutes > 0).forEach(row => paintOverlay(ctx,row.field,"irrigation",day));
  } else if (!state.draft) paintOverlay(ctx, field, layer, day);
  if (!hasSplitMap() && !field.remote) {
    fields.filter((item) => item.id !== field.id).forEach((item) => paintOutline(ctx, item.shape, frame.scale, false));
  }
  paintOutline(ctx, field.shape, frame.scale, !state.draft);

  if (state.draft) paintDraft(ctx, state.draft.shape, frame.scale);
  ctx.restore();

  if (!state.draft && state.view === "notes") paintPins(ctx, field, frame);
  if (!state.draft && state.view !== "notes") {
    const displayFields = hasSplitMap() || field.remote ? [field] : fields;
    for (const item of displayFields) {
      paintMapLabel(ctx, item, frame, width, height, item.id === field.id, layer, day);
    }
  }
  if (!state.draft) paintDecisionPoints(ctx,field,frame);
}

function paintOutline(ctx, shape, scale, active) {
  pathPolygon(ctx, shape);
  ctx.strokeStyle = active ? "#1d3422c7" : "#152913b5";
  ctx.lineWidth = (active ? 4.7 : 3.2) / scale;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.strokeStyle = active ? "#fff2c5" : "#f7fff1da";
  ctx.lineWidth = (active ? 2.35 : 1.3) / scale;
  ctx.stroke();
}

function paintMapLabel(ctx, field, frame, width, height, active, layer, day) {
  const [x, y] = spatialData(field).center;
  const cx = x * frame.scale + frame.left;
  const cy = y * frame.scale + frame.top;
  if (cx < 53 || cx > width - 53 || cy < 75 || cy > height - 110) return;
  const title = field.name.length > 23 ? field.name.slice(0, 22) + "…" : field.name;
  const value = layer === "ndvi" || layer === "contrast" || layer === "evi" ? observedIndex(field, day, layer) : null;
  let suffix = active && value !== null ? " · " + indexNumber.format(value) : "";
  if (!suffix && active && !hasSplitMap()) suffix = " · " + number.format(field.area) + " ha";
  const text = title + suffix;
  ctx.font = (active ? "650 " : "580 ") + "13px Agri Sans, Open Sans, Segoe UI, sans-serif";
  const labelWidth = ctx.measureText(text).width + 20;
  ctx.beginPath();
  ctx.roundRect(cx - labelWidth / 2, cy - 15, labelWidth, 30, 6);
  ctx.fillStyle = active ? "#153128ec" : "#1c3629d4";
  ctx.fill();
  ctx.strokeStyle = active ? "#f5eed399" : "#f4fff14f";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f9fff5";
  ctx.fillText(text, cx, cy + .5);
}

function paintPins(ctx, field, frame) {
  for (const note of notes.filter((item) => item.fieldId === field.id)) {
    const x = note.point[0] * frame.scale + frame.left;
    const y = note.point[1] * frame.scale + frame.top;
    const chosen = state.noteId === note.id;
    ctx.beginPath();
    ctx.arc(x, y - 12, 12, 0, Math.PI * 2);
    ctx.fillStyle = chosen ? "#ffde99" : "#fcfff7";
    ctx.fill();
    ctx.strokeStyle = "#1b4f38";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 12, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#1b4f38";
    ctx.fill();
    ctx.fillRect(x - 1, y, 2, 5);
    if (chosen) {
      const label = note.title.length > 27 ? note.title.slice(0, 26) + "…" : note.title;
      ctx.font = "600 13px Agri Sans, Open Sans, Segoe UI, sans-serif";
      const w = 18 + ctx.measureText(label).width;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y + 10, w, 28, 6);
      ctx.fillStyle = "#142d24eb";
      ctx.fill();
      ctx.fillStyle = "#f9fff5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y + 24);
    }
  }
}

function paintDraft(ctx, shape, scale) {
  if (!shape.length) return;
  pathPolygon(ctx, shape);
  ctx.fillStyle = "#ddedaf40";
  if (shape.length > 2) ctx.fill();
  ctx.lineWidth = 2 / scale;
  ctx.strokeStyle = "#fff2c5";
  ctx.stroke();
  for (const [x, y] of shape) {
    ctx.beginPath();
    ctx.arc(x, y, 4.5 / scale, 0, Math.PI * 2);
    ctx.fillStyle = "#fff3ca";
    ctx.fill();
  }
}

function paintTrend() {
  const field = currentField();
  if (!field.ndvi || state.view !== "fields") return;
  const canvas = element("trend");
  const surface = matchCanvas(canvas);
  if (!surface) return;
  const { ctx, width, height } = surface;
  const layer = activeLayer(field);
  const values = DAYS.map((_, i) => observedIndex(field, i, layer));
  const xs = DAYS.map((_, i) => 6 + (width - 12) * (DAYS[i] - DAYS[0]) / (DAYS.at(-1) - DAYS[0]));
  const low = Math.min(...values) - .055;
  const high = Math.max(...values) + .045;
  const ys = values.map((n) => height - 5 - (height - 10) * (n - low) / (high - low));

  ctx.strokeStyle = "#e3ebe2";
  ctx.lineWidth = 1;
  for (const y of [8, Math.round(height / 2), height - 4]) {
    ctx.beginPath();
    ctx.moveTo(0, y + .5);
    ctx.lineTo(width, y + .5);
    ctx.stroke();
  }

  ctx.beginPath();
  xs.forEach((x, i) => { if (i === 0) ctx.moveTo(x, ys[i]); else ctx.lineTo(x, ys[i]); });
  ctx.lineTo(xs.at(-1), height - 4);
  ctx.lineTo(xs[0], height - 4);
  ctx.closePath();
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, "#e0eee2");
  shade.addColorStop(1, "#f7fbf5");
  ctx.fillStyle = shade;
  ctx.fill();

  ctx.beginPath();
  xs.forEach((x, i) => { if (i === 0) ctx.moveTo(x, ys[i]); else ctx.lineTo(x, ys[i]); });
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.strokeStyle = "#43886b";
  ctx.lineWidth = 2;
  ctx.stroke();

  xs.forEach((x, i) => {
    ctx.beginPath();
    ctx.arc(x, ys[i], i === state.day ? 4.5 : 2.3, 0, Math.PI * 2);
    ctx.fillStyle = i === state.day ? "#fff" : "#499074";
    ctx.strokeStyle = "#176248";
    ctx.fill();
    if (i === state.day) ctx.stroke();
  });
  canvas.setAttribute("aria-label", DAYS.map((_, i) => dateLabel(i) + " : " + indexNumber.format(values[i])).join(", "));
}

function paintThumb(canvas, field) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width, height = canvas.height;
  const area = spatialData(field);
  ctx.fillStyle = "#546947";
  ctx.fillRect(0, 0, width, height);
  if (field.remote) {
    ctx.fillStyle = "#dce8dd";
    ctx.fillRect(0, 0, width, height);
    if (!field.geometryAvailable) return;
    ctx.save();
    ctx.scale(width / WORLD.width, height / WORLD.height);
    paintOutline(ctx, field.shape, width / WORLD.width, field.id === state.fieldId);
    ctx.restore();
    return;
  }
  const worldWidth = Math.min(Math.max(area.width * 1.22, 40), WORLD.height * width / height, WORLD.width);
  const worldHeight = worldWidth * height / width;
  const x = clamp(area.center[0] - worldWidth / 2, 0, WORLD.width - worldWidth);
  const y = clamp(area.center[1] - worldHeight / 2, 0, WORLD.height - worldHeight);
  const scale = width / worldWidth;
  if (aerial.naturalWidth) {
    const f = aerial.naturalWidth / WORLD.width;
    ctx.drawImage(aerial, x * f, y * f, worldWidth * f, worldHeight * f, 0, 0, width, height);
  }
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);
  ctx.globalAlpha = .6;
  paintOverlay(ctx, field, "ndvi", state.day);
  ctx.globalAlpha = 1;
  paintOutline(ctx, field.shape, scale * 2.4, field.id === state.fieldId);
  ctx.restore();
}

function scheduleDraw() {
  if (drawRequested) return;
  drawRequested = true;
  requestAnimationFrame(() => {
    drawRequested = false;
    if (isComparing()) {
      mapCanvases.forEach((canvas, i) => renderMap(canvas,
        currentField().remote ? currentField().compareLayers?.[i] || "satellite" : state.comparisonLayers[i],
        state.comparisonDays[i]));
    } else if (isDecisionSplit()) {
      renderMap(mapCanvases[0],"zones",state.day);
      renderMap(mapCanvases[1],"input-dose",state.day);
    } else {
      renderMap(mapCanvases[0], activeLayer(currentField()), state.day);
    }
    paintTrend();
  });
}

function recenter() {
  const field = currentField();
  const area = spatialData(field);
  state.camera = { x: area.center[0], y: area.center[1], zoom: hasSplitMap() || field.id === "kpele" ? 1 : 1.13 };
}

function zoomBy(factor) {
  state.camera.zoom = clamp(state.camera.zoom * factor, 1, 3.2);
  updateZoom();
  scheduleDraw();
}

function updateZoom() {
  element("zoom-in").disabled = state.camera.zoom >= 3.2;
  element("zoom-out").disabled = state.camera.zoom <= 1;
}

function mapPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const frame = projection(rect.width, rect.height);
  return [(event.clientX - rect.left - frame.left) / frame.scale, (event.clientY - rect.top - frame.top) / frame.scale];
}

function selectAt(canvas, event) {
  const [x, y] = mapPoint(canvas, event);
  if (x < 0 || x > WORLD.width || y < 0 || y > WORLD.height) return;
  if (state.draft) {
    const last = state.draft.shape.at(-1);
    if (!last || Math.hypot(last[0] - x, last[1] - y) > 3) state.draft.shape.push([x, y]);
    updateDrawbar();
    scheduleDraw();
    return;
  }
  if (chooseStandPoint(canvas,x,y) || chooseDoseZone(x,y)) return;
  const field = currentField();
  if (state.view === "notes") {
    const scale = projection(canvas.clientWidth, canvas.clientHeight).scale;
    const note = notes.find((item) => item.fieldId === field.id && Math.hypot(item.point[0] - x, item.point[1] - 10 / scale - y) < 18 / scale);
    if (note) {
      state.noteId = note.id;
      updateNotes(field);
      paintIcons();
      scheduleDraw();
      return;
    }
  }
  if (hasSplitMap()) return;
  const match = (currentField().remote ? [currentField()] : fields.slice().reverse()).find((item) => contains(item.shape, x, y));
  if (!match) return;
  if (state.view === "notes" && !field.remote && match.id === field.id) {
    openNote([x, y]);
    return;
  }
  selectField(match.id);
}

function bindMap(canvas) {
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const frame = projection(canvas.clientWidth, canvas.clientHeight);
    pan = { canvas, x: event.clientX, y: event.clientY, px: frame.centerX, py: frame.centerY, scale: frame.scale, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (pan?.canvas !== canvas) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 4) return;
    pan.moved = true;
    canvas.classList.add("dragging");
    state.camera.x = pan.px - dx / pan.scale;
    state.camera.y = pan.py - dy / pan.scale;
    scheduleDraw();
  });
  canvas.addEventListener("pointerup", (event) => {
    if (pan?.canvas !== canvas) return;
    if (!pan.moved) selectAt(canvas, event);
    pan = null;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointercancel", () => {
    pan = null;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.14 : 1 / 1.14);
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") zoomBy(1.23);
    else if (event.key === "-") zoomBy(1 / 1.23);
    else if (event.key === "Home") {
      recenter();
      updateZoom();
      scheduleDraw();
    } else if (event.key === "Escape" && state.draft) finishDraw(false);
    else return;
    event.preventDefault();
  });
}
