/* Interface desktop connectée aux campagnes et images de l’API. */
const WORLD = { width: 960, height: 640 };
const LAYERS = { satellite: "Satellite", ndvi: "NDVI", contrast: "NDVI contrasté", evi: "EVI", zones: "Zones historiques", dose: "Carte de doses" };
const NAMES = ["Faible", "Moyenne", "Élevée"];
const RAMP = [[222, 113, 74], [235, 185, 82], [178, 203, 106], [100, 164, 104], [41, 116, 79]];

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
const fields = [];
const geography = new Map();
const state = {
  fieldId: null, view: "fields", zoneLayer: "zones",
  camera: { x: 480, y: 320, zoom: 1 }, noteId: null, expanded: false
};
let drawRequested = false;
let messageTimer = 0;
let pan = null;


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

function observedIndex(field, date, layer = "ndvi") {
  const observations = observationsFor(field, layer);
  return (date ? observations.find(row => row.date === date) : observations.at(-1))?.value ?? null;
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

function spatialData(field) {
  if (geography.has(field.id)) return geography.get(field.id);
  const xs = field.shape.map(([x]) => x), ys = field.shape.map(([, y]) => y);
  const x0 = xs.length ? Math.min(...xs) : 0, x1 = xs.length ? Math.max(...xs) : WORLD.width;
  const y0 = ys.length ? Math.min(...ys) : 0, y1 = ys.length ? Math.max(...ys) : WORLD.height;
  const result = {center: [(x0 + x1) / 2, (y0 + y1) / 2], width: x1 - x0, height: y1 - y0};
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
  return state.view === "zones" ? state.zoneLayer : field?.imageLayer || "satellite";
}

function isComparing() {
  return !!currentField() && state.view === "compare";
}

function projection(width, height) {
  const field = currentField();
  const camera = state.camera;
  if (!field) return { scale: Math.max(width / WORLD.width, height / WORLD.height),
    left: 0, top: 0, centerX: WORLD.width / 2, centerY: WORLD.height / 2 };
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

function paintAerial(ctx, width, height, frame, layer, side = null) {
  const field = currentField();
  ctx.fillStyle = "#e9eee5";
  ctx.fillRect(0, 0, width, height);
  if (!field?.remote) return;
  const date = side === null ? field.imageDate : field.compareDates?.[side];
  const dated = field.remoteImages?.get(date + ":rgb");
  const image = layer === "satellite" && dated ? dated : field.basemap;
  if (image?.complete && image.naturalWidth) {
    ctx.save();
    ctx.translate(frame.left, frame.top);
    ctx.scale(frame.scale, frame.scale);
    ctx.drawImage(image, 96, 80, 768, 480);
    ctx.restore();
  }
  ctx.fillStyle = "#61766a";
  ctx.font = "600 12px Agri Sans, Open Sans, sans-serif";
  if (!image) ctx.fillText("Aucune image satellite pour cette vue", 24, 32);
  if (layer === "satellite" && dated) ctx.fillText("Sentinel‑2 · " + date, 24, 32);
}

function renderMap(canvas, layer) {
  const surface = matchCanvas(canvas);
  if (!surface) return;
  const { ctx, width, height } = surface;
  const field = currentField();
  if (!field) {
    ctx.fillStyle = "#edf2f0";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#53665d";
    ctx.font = "600 15px Agri Sans, Open Sans, sans-serif";
    ctx.fillText("Connectez-vous pour charger vos campagnes enregistrées.", 24, 34);
    return;
  }
  const frame = projection(width, height);
  const side = isComparing() ? (canvas.id === "map-b" ? 1 : 0) : null;
  const date = side === null ? field.imageDate : field.compareDates?.[side];
  paintAerial(ctx, width, height, frame, layer, side);
  if (field.remote && !field.geometryAvailable) {
    ctx.fillStyle = "#3d594a";
    ctx.font = "600 16px Agri Sans, Open Sans, sans-serif";
    ctx.fillText("Contour indisponible pour cette campagne", 24, 85);
    return;
  }
  ctx.save();
  ctx.translate(frame.left, frame.top);
  ctx.scale(frame.scale, frame.scale);
  if (["zones", "dose"].includes(layer)) paintWorkerZoneCells(ctx, field, layer);
  if (["ndvi", "contrast", "evi"].includes(layer)) paintFieldIndex(ctx, field, layer, date);
  if (field.shape?.length >= 3) paintOutline(ctx, field.shape, frame.scale, true);
  ctx.restore();
  if (state.view === "notes") paintPins(ctx, field, frame);
  else paintMapLabel(ctx, field, frame, width, height, true, layer, date);
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

function paintMapLabel(ctx, field, frame, width, height, active, layer, date) {
  const [x, y] = spatialData(field).center;
  const cx = x * frame.scale + frame.left;
  const cy = y * frame.scale + frame.top;
  if (cx < 53 || cx > width - 53 || cy < 75 || cy > height - 110) return;
  const title = field.name.length > 23 ? field.name.slice(0, 22) + "…" : field.name;
  const value = layer === "ndvi" || layer === "contrast" || layer === "evi" ? observedIndex(field, date, layer) : null;
  let suffix = active && value !== null ? " · " + indexNumber.format(value) : "";
  if (!suffix && active && !hasSplitMap() && Number.isFinite(field.area)) suffix = " · " + number.format(field.area) + " ha";
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

function fieldNotePoints(field) {
  if (!field.imageBounds) return [];
  const [west, south, east, north] = field.imageBounds;
  return fieldNotesFor(field).flatMap((note, index) => {
    if (!note.visit?.observed) return [];
    const [lon, lat] = note.visit.observed;
    return [{index, x: 96 + (lon - west) / (east - west) * 768, y: 80 + (north - lat) / (north - south) * 480}];
  });
}

function paintPins(ctx, field, frame) {
  for (const point of fieldNotePoints(field)) {
    const x = point.x * frame.scale + frame.left, y = point.y * frame.scale + frame.top;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = state.noteId === point.index ? "#ffde99" : "#fcfff7";
    ctx.fill();
    ctx.strokeStyle = "#1b4f38";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function paintTrend() {
  const field = currentField();
  if (!field || state.view !== "fields") return;
  const canvas = element("trend");
  const rows = observationsFor(field);
  if (rows.length < 2 || canvas.hidden) return;
  const surface = matchCanvas(canvas);
  if (!surface) return;
  const { ctx, width, height } = surface;
  const values = rows.map(row => row.value);
  const start = Date.parse(rows[0].date), end = Date.parse(rows.at(-1).date);
  const selected = rows.findIndex(row => row.date === field.imageDate);
  const xs = rows.map(row => 6 + (width - 12) * (Date.parse(row.date) - start) / (end - start));
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
    ctx.arc(x, ys[i], i === selected ? 4.5 : 2.3, 0, Math.PI * 2);
    ctx.fillStyle = i === selected ? "#fff" : "#499074";
    ctx.strokeStyle = "#176248";
    ctx.fill();
    if (i === selected) ctx.stroke();
  });
  canvas.setAttribute("aria-label", rows.map(row => row.date + " : " + indexNumber.format(row.value)).join(", "));
}

function paintThumb(canvas, field) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e9eee5";
  ctx.fillRect(0, 0, width, height);
  if (!field?.remote) {
    ctx.fillStyle = "#53665d";
    ctx.font = "600 10px sans-serif";
    ctx.fillText("Données API requises", 5, height / 2);
    return;
  }
  const date = field.imageDate;
  const image = field.remoteImages?.get(date + ":rgb") || field.basemap;
  if (image?.complete && image.naturalWidth)
    ctx.drawImage(image, 96 / WORLD.width * width, 80 / WORLD.height * height,
      768 / WORLD.width * width, 480 / WORLD.height * height);
  if (field.geometryAvailable && field.shape?.length >= 3) {
    ctx.save();
    ctx.scale(width / WORLD.width, height / WORLD.height);
    paintOutline(ctx, field.shape, width / WORLD.width, field.id === state.fieldId);
    ctx.restore();
  }
  if (!image) {
    ctx.fillStyle = "#34483b";
    ctx.font = "600 9px sans-serif";
    ctx.fillText("Image API indisponible", 4, height - 7);
  }
}

function scheduleDraw() {
  if (drawRequested) return;
  drawRequested = true;
  requestAnimationFrame(() => {
    drawRequested = false;
    if (isComparing()) {
      mapCanvases.forEach((canvas, i) => renderMap(canvas, currentField().compareLayers?.[i] || "satellite"));
    } else if (isDecisionSplit()) {
      renderMap(mapCanvases[0], "zones");
      renderMap(mapCanvases[1], "dose");
    } else renderMap(mapCanvases[0], activeLayer(currentField()));
    paintTrend();
  });
}

function recenter() {
  const field = currentField();
  if (!field) {
    state.camera = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1 };
    return;
  }
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
  const field = currentField();
  if (!field || state.view !== "notes") return;
  const scale = projection(canvas.clientWidth, canvas.clientHeight).scale;
  const note = fieldNotePoints(field).find(point => Math.hypot(point.x - x, point.y - y) < 15 / scale);
  if (!note) return;
  state.noteId = note.index;
  updateNotes(field);
  paintIcons();
  scheduleDraw();
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
    } else return;
    event.preventDefault();
  });
}
