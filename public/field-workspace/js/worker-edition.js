/* Enregistrement volontaire des campagnes. Le serveur contrôle géométrie, révision et calcul. */
let editedWorkerField = null;
let workerSaving = false;
let workerSoilSample = null;
let workerSoilGeneration = 0;

const workerPlaceState = { bounds: null, center: null, image: null, points: [], geometry: null, zoom: 1, generation: 0 };
let workerGeometryImageTimer = null;

function drawWorkerLandOverlay(ctx, assessment, bounds, width, height) {
  if (!assessment?.fractions || !bounds) return;
  const [west, south, east, north] = bounds;
  const X = lon => (lon - west) / (east - west) * width;
  const Y = lat => (north - lat) / (north - south) * height;
  const colors = {
    potentialLand: "#21a36655", permanentWater: "#2478c055",
    seasonalWater: "#58a6d655", wetland: "#2497a055",
    incompatible: "#c5953555", unknown: "#737e8955"
  };
  ctx.save();
  for (const [key, color] of Object.entries(colors)) {
    const polygons = assessment.fractions[key]?.geometry?.coordinates;
    if (!Array.isArray(polygons)) continue;
    ctx.beginPath();
    for (const polygon of polygons) {
      if (!Array.isArray(polygon)) continue;
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 3) continue;
        ring.forEach(([lon, lat], index) => index ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat)));
        ctx.closePath();
      }
    }
    ctx.fillStyle = color;
    ctx.fill("evenodd");
  }
  ctx.restore();
}

function workerPlaceBounds(latitude, longitude, zoom = 1) {
  const halfHeight = .0045 / zoom;
  const cosine = Math.max(.5, Math.cos(latitude * Math.PI / 180));
  const halfWidth = halfHeight * 1.6 / cosine;
  return [longitude - halfWidth, latitude - halfHeight, longitude + halfWidth, latitude + halfHeight];
}

function workerPlaceBoundsForGeometry(geometry, zoom = 1) {
  const ring = geometry?.type === "Polygon" ? geometry.coordinates?.[0] : null;
  if (!Array.isArray(ring) || ring.length < 4) return null;
  const xs = ring.map(point => Number(point?.[0]));
  const ys = ring.map(point => Number(point?.[1]));
  if (![...xs, ...ys].every(Number.isFinite)) return null;
  const centerLon = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerLat = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cosine = Math.max(.35, Math.cos(centerLat * Math.PI / 180));
  let width = Math.max(Math.max(...xs) - Math.min(...xs), .0005) * 1.22 / zoom;
  let height = Math.max(Math.max(...ys) - Math.min(...ys), .0005) * 1.22 / zoom;
  if (width * cosine / height < 1.6) width = height * 1.6 / cosine;
  else height = width * cosine / 1.6;
  return [centerLon - width / 2, centerLat - height / 2, centerLon + width / 2, centerLat + height / 2];
}

function drawWorkerPlaceMap() {
  const canvas = element("worker-place-map");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e9eee5";
  ctx.fillRect(0, 0, width, height);
  if (workerPlaceState.image?.complete && workerPlaceState.image.naturalWidth)
    ctx.drawImage(workerPlaceState.image, 0, 0, width, height);
  else {
    ctx.fillStyle = "#53665d";
    ctx.font = "600 13px sans-serif";
    ctx.fillText(workerPlaceState.center ? "Fond photographique en cours de chargement…" : "Recherchez une localité pour afficher une image satellite réelle.", 14, 25);
  }
  const bounds = workerPlaceState.bounds;
  let currentGeometry = null;
  try { currentGeometry = JSON.parse(element("worker-editor-form").elements.geometry.value || "null"); } catch {}
  const currentGeometryText = currentGeometry ? JSON.stringify(currentGeometry) : "";
  const assessment = workerSoilSample?.geometryText === currentGeometryText
    ? workerSoilSample.landAssessment : null;
  if (bounds) drawWorkerLandOverlay(ctx, assessment, bounds, width, height);
  const points = workerPlaceState.points;
  const rings = points.length
    ? [points]
    : Array.isArray(currentGeometry?.coordinates)
      ? currentGeometry.coordinates.map(ring => ring.slice(0, -1)) : [];
  if (!rings.length || !bounds) return;
  const [west, south, east, north] = bounds;
  const xy = ([lon, lat]) => [(lon - west) / (east - west) * width, (north - lat) / (north - south) * height];
  ctx.save();
  ctx.beginPath();
  for (const ring of rings) {
    if (!ring.length) continue;
    ring.forEach((point, index) => {
      const [x, y] = xy(point);
      if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (ring.length >= 3) ctx.closePath();
  }
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  if (rings.some(ring => ring.length >= 3)) { ctx.fillStyle = "#ffcf5b55"; ctx.fill("evenodd"); }
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = "#183d68";
  ctx.stroke();
  if (points.length) points.forEach((point, index) => {
    const [x, y] = xy(point);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#183d68";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#102a48";
    ctx.font = "700 10px sans-serif";
    ctx.fillText(String(index + 1), x + 7, y - 6);
  });
  ctx.restore();
}

function resetWorkerPlacePicker() {
  workerPlaceState.generation++;
  workerPlaceState.bounds = null;
  workerPlaceState.center = null;
  workerPlaceState.image = null;
  workerPlaceState.points = [];
  workerPlaceState.geometry = null;
  workerPlaceState.zoom = 1;
  element("worker-place-query").value = "";
  element("worker-place-results").replaceChildren();
  putText("worker-place-status", "Recherchez un village ou une ville. Le fond satellite réel s’affichera après votre choix.");
  element("worker-place-connect").hidden = false;
  putText("worker-place-attribution", "Contour à tracer sur une image réelle · non cadastral");
  element("worker-editor-form").elements.geometry.value = "";
  clearWorkerSoilSample("Tracez ou collez un contour, puis lancez l’analyse directe de l’API.");
  drawWorkerPlaceMap();
}

async function loadWorkerPlaceImage() {
  const center = workerPlaceState.center;
  const form = element("worker-editor-form");
  const geometry = form.elements.outlineConsent.checked ? workerPlaceState.geometry : null;
  if (!center && !geometry) return;
  const generation = ++workerPlaceState.generation;
  workerPlaceState.bounds = geometry
    ? workerPlaceBoundsForGeometry(geometry, workerPlaceState.zoom)
    : workerPlaceBounds(center.latitude, center.longitude, workerPlaceState.zoom);
  workerPlaceState.image = null;
  drawWorkerPlaceMap();
  putText("worker-place-status", "Chargement du fond satellite de repérage…");
  try {
    const image = await workerImage({ layer: "basemap", date: "", bounds: workerPlaceState.bounds });
    if (generation !== workerPlaceState.generation) return;
    workerPlaceState.image = image;
    drawWorkerPlaceMap();
    putText("worker-place-status", "Cliquez autour du champ pour tracer son contour.");
    putText("worker-place-attribution", "Fond photographique non daté · Esri World Imagery");
  } catch (error) {
    if (generation !== workerPlaceState.generation) return;
    putText("worker-place-status", error.message || String(error));
  }
}

async function searchWorkerPlaces() {
  const query = element("worker-place-query").value.trim();
  const results = element("worker-place-results");
  results.replaceChildren();
  if (query.length < 3) {
    putText("worker-place-status", "Saisissez au moins trois caractères.");
    return;
  }
  const button = element("worker-place-search");
  button.disabled = true;
  putText("worker-place-status", "Recherche dans les localités disponibles…");
  try {
    const data = await workerPost({ action: "places", query });
    const places = Array.isArray(data.places) ? data.places : [];
    element("worker-place-connect").hidden = true;
    if (!places.length) {
      putText("worker-place-status", "Aucune localité trouvée. Essayez une ville ou un village voisin.");
      return;
    }
    for (const place of places) {
      const item = makeNode("li", "worker-place-result");
      const choice = makeNode("button", "");
      choice.type = "button";
      const text = makeNode("span", "worker-place-result-copy");
      text.append(makeNode("strong", "", place.name),
        makeNode("small", "", [place.region, place.country].filter(Boolean).join(" · ")));
      choice.append(text);
      choice.addEventListener("click", () => selectWorkerPlace(place));
      item.append(choice);
      results.append(item);
    }
    putText("worker-place-status", (data.attribution || "API AgriPrévision") + " · choisissez le lieu qui correspond à votre champ.");
  } catch (error) {
    const message = error.message || String(error);
    putText("worker-place-status", message);
    if (/Cloudflare Access|Connexion requise/i.test(message))
      element("worker-place-connect").hidden = false;
  } finally {
    button.disabled = false;
  }
}

function selectWorkerPlace(place) {
  const form = element("worker-editor-form");
  workerPlaceState.generation++;
  workerPlaceState.center = place;
  workerPlaceState.points = [];
  workerPlaceState.geometry = null;
  workerPlaceState.zoom = 1;
  form.elements.territory.value = [place.name, place.region].filter(Boolean).join(" · ");
  const countryCode = {
    "togo": "TGO", "benin": "BEN", "benin republic": "BEN", "burkina faso": "BFA",
    "ghana": "GHA", "cote d ivoire": "CIV", "ivory coast": "CIV", "senegal": "SEN",
    "nigeria": "NGA"
  }[String(place.country || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()];
  if (countryCode && [...form.elements.country.options].some(option => option.value === countryCode))
    form.elements.country.value = countryCode;
  element("worker-place-results").replaceChildren();
  element("worker-place-connect").hidden = true;
  form.elements.geometry.value = "";
  clearWorkerSoilSample("Nouvelle localité sélectionnée. Tracez le contour puis analysez les données réelles.");
  putText("worker-place-attribution", "Contour à tracer sur une image réelle · non cadastral");
  void loadWorkerPlaceImage();
}

function updateWorkerPlaceGeometry() {
  const form = element("worker-editor-form");
  const points = workerPlaceState.points;
  form.elements.geometry.value = points.length >= 3
    ? JSON.stringify({ type: "Polygon", coordinates: [[...points, points[0]]] })
    : "";
  workerPlaceState.geometry = points.length >= 3
    ? {type:"Polygon",coordinates:[[...points,points[0]]]} : null;
  clearWorkerSoilSample(points.length >= 3
    ? "Le contour a changé. Relancez l’analyse des données réelles."
    : "Ajoutez trois points, puis analysez le contour avec l’API.");
  drawWorkerPlaceMap();
  putText("worker-place-status", points.length >= 3
    ? points.length + " sommets · contour prêt à être vérifié et enregistré."
    : points.length + " sommet(s) · ajoutez au moins trois points autour du champ.");
}

function workerEditorGeometry(form) {
  let input;
  try { input = JSON.parse(form.elements.geometry.value.trim()); }
  catch { throw new Error("Collez ou tracez un contour GeoJSON valide."); }
  const rings = input?.type === "Polygon" ? input.coordinates : null;
  if (!Array.isArray(rings) || rings.length !== 1 ||
      !Array.isArray(rings[0]) || rings[0].length < 4 || rings[0].length > 201 ||
      !rings[0].every(point => Array.isArray(point) && point.length === 2 &&
        Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
        Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 85) ||
      JSON.stringify(rings[0][0]) !== JSON.stringify(rings[0].at(-1)))
    throw new Error("L’API accepte un seul contour Polygon fermé, sans trou, avec 3 à 200 sommets en coordonnées WGS84.");
  const normalized = {type:"Polygon",coordinates:rings.map(ring => ring.map(point => [point[0],point[1]]))};
  return normalized;
}

function workerGeometryPoint(geometry) {
  const ring = geometry.coordinates[0], points = ring.slice(0, -1), origin = points[0];
  let crossSum = 0, xSum = 0, ySum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ax = a[0] - origin[0], ay = a[1] - origin[1];
    const bx = b[0] - origin[0], by = b[1] - origin[1];
    const cross = ax * by - bx * ay;
    crossSum += cross;
    xSum += (ax + bx) * cross;
    ySum += (ay + by) * cross;
  }
  const centroid = crossSum
    ? [origin[0] + xSum / (3 * crossSum), origin[1] + ySum / (3 * crossSum)]
    : origin;
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > centroid[1]) !== (yj > centroid[1]) &&
        centroid[0] < (xj - xi) * (centroid[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? centroid : origin;
}

function clearWorkerSoilSample(message = "Le contour a changé. Relancez l’analyse des données réelles.") {
  workerSoilGeneration++;
  workerSoilSample = null;
  const button = element("worker-place-analyze");
  if (button) button.disabled = false;
  const result = element("worker-place-analysis");
  if (result) result.textContent = message;
  if (typeof drawWorkerPlaceMap === "function") drawWorkerPlaceMap();
}

function aggregateWorkerSoil(data) {
  if (!data || data.version !== "spatial-soil-1" || data.complete !== true ||
      !Array.isArray(data.samples) || !data.samples.length ||
      !Number.isFinite(data.totalM2) || !Number.isFinite(data.coveredM2) ||
      data.coveredM2 <= 0 || Math.abs(data.totalM2 - data.coveredM2) > Math.max(1, data.totalM2 * 1e-5))
    throw new Error("Le profil SoilGrids ne couvre pas entièrement la surface de terre candidate. Aucune valeur ne sera extrapolée.");
  const samples = data.samples.filter(sample =>
    Number.isFinite(sample.areaM2) && sample.areaM2 > 0 &&
    Array.isArray(sample.soil?.hydraulicLayers) && sample.soil.hydraulicLayers.length
  );
  if (samples.length !== data.samples.length)
    throw new Error("Un ou plusieurs profils SoilGrids sont incomplets. Aucun profil partiel ne sera utilisé.");
  const count = samples[0].soil.hydraulicLayers.length;
  if (count < 1 || samples.some(sample => sample.soil.hydraulicLayers.length !== count))
    throw new Error("Les horizons SoilGrids ne correspondent pas entre les points de la parcelle.");
  const layers = Array.from({length: count}, (_, index) => {
    let area = 0, thickness = 0, fc = 0, wp = 0;
    for (const sample of samples) {
      const layer = sample.soil.hydraulicLayers[index];
      if (![layer?.thicknessM, layer?.thetaFC, layer?.thetaWP].every(Number.isFinite) ||
          layer.thicknessM <= 0 || layer.thetaFC <= layer.thetaWP)
        throw new Error("Valeur de rétention manquante ou incohérente dans un horizon SoilGrids.");
      area += sample.areaM2;
      thickness += layer.thicknessM * sample.areaM2;
      fc += layer.thetaFC * sample.areaM2;
      wp += layer.thetaWP * sample.areaM2;
    }
    return {thicknessM: thickness / area, thetaFC: fc / area, thetaWP: wp / area, initialTheta: null};
  });
  return {layers, availableWaterMm: data.availableWaterMm, sampleCount: samples.length,
    totalM2: data.totalM2, coveredM2: data.coveredM2, source:
      "ISRIC SoilGrids 2.0 · profils représentatifs pondérés par aire · maille native 250 m · prédiction cartographique, pas analyse de laboratoire."};
}

async function analyzeWorkerParcel() {
  const form = element("worker-editor-form");
  const button = element("worker-place-analyze");
  const output = element("worker-place-analysis");
  if (!form.elements.outlineConsent.checked) { output.textContent = "Autorisez l’envoi du contour avant l’analyse."; return; }
  const days = Number(form.elements.crop.selectedOptions[0]?.dataset.days);
  if (!days || !form.elements.sowingDate.value) {
    output.textContent = "Choisissez la culture et la date de semis. Configurez les cycles sans référence dans « Ma simulation ».";
    return;
  }
  let geometry;
  try { geometry = workerEditorGeometry(form); }
  catch (error) { output.textContent = error.message || String(error); return; }
  const geometryText = JSON.stringify(geometry);
  const generation = ++workerSoilGeneration;
  button.disabled = true;
  output.textContent = "L’API AgriPrévision vérifie le contour, la terre candidate, SoilGrids et les données météo…";
  try {
    const [environment, soil] = await Promise.all([
      workerPost({action:"environment", geometry, country:form.elements.country.value,
        start:form.elements.sowingDate.value, days}),
      workerPost({action:"agronomic-soil", geometry})
    ]);
    if (generation !== workerSoilGeneration) return;
    if (!environment?.landAssessment?.fractions || !Array.isArray(environment.weather))
      throw new Error("L’API n’a pas retourné l’analyse de terrain et la série météo attendue.");
    const profile = aggregateWorkerSoil(soil);
    const land = environment.landAssessment;
    const potentialLandM2 = land.fractions.potentialLand?.areaM2;
    if (!Number.isFinite(potentialLandM2) || potentialLandM2 <= 0)
      throw new Error("L’API n’a pas identifié de surface classée terre candidate dans ce contour.");
    if (Math.abs(soil.totalM2 - land.candidateAreaM2) > Math.max(1, land.areaM2 * .002))
      throw new Error("Les surfaces retournées par les analyses sol et terrain ne concordent pas. Relancez l’analyse.");
    const weather = environment.weather.filter(item =>
      ["observed", "forecast"].includes(item.status) &&
      typeof item.date === "string" &&
      Number.isFinite(item.rainMm) && Number.isFinite(item.et0Mm)
    );
    workerSoilSample = {
      geometryText, country:form.elements.country.value, sowingDate:form.elements.sowingDate.value, crop:form.elements.crop.value,
      layers:profile.layers, source:profile.source,
      landAssessment:land, weather,
      weatherSourceDays:weather.length, weatherCycleDays:environment.weather.length,
      soil, environment
    };
    drawWorkerPlaceMap();
    const area = m2 => Number.isFinite(m2) ? number.format(m2 / 10000) + " ha" : "indisponible";
    const unknown = Number.isFinite(land.unknownAreaM2) ? " · surface non classée " + area(land.unknownAreaM2) : "";
    const observedDays = weather.filter(item => item.status === "observed").length;
    const forecastDays = weather.filter(item => item.status === "forecast").length;
    const rain = observedDays + " jour(s) observés et " + forecastDays + " jour(s) prévus sur " + environment.weather.length + " jour(s) demandés";
    const soilProps = Array.isArray(soil.summary)
      ? soil.summary.filter(item => Number.isFinite(item.value)).map(item =>
          item.label + " : " + number.format(item.value) + " " + item.unit).join(" · ")
      : "";
    const landSources = Array.isArray(land.sources) ? land.sources.filter(source => source.status === "available").map(source => source.id).join(", ") : "";
    const warnings = Array.isArray(environment.warnings) ? environment.warnings.slice(0, 3).join(" ") : "";
    output.textContent = "Terrain " + (land.status || "non qualifié") + (typeof land.assessedAt === "string" ? " · " + land.assessedAt.slice(0, 10) : "") +
      (landSources ? " · sources " + landSources : "") + " : terre candidate " + area(potentialLandM2) +
      " sur " + area(land.areaM2) + unknown + ". SoilGrids : " + profile.sampleCount +
      " profil(s), " + area(profile.coveredM2) + " couverts, rétention par horizon complète; eau disponible " +
      (Number.isFinite(profile.availableWaterMm) ? number.format(profile.availableWaterMm) + " mm" : "indisponible") +
      ". Météo : " + rain + ". " + (soilProps ? soilProps + ". " : "") +
      "SoilGrids est une prédiction à 250 m, pas une mesure de laboratoire. Jours estimés/scénarisés exclus. " + warnings;
    if (land.legalStatus === "not_assessed")
      output.textContent += " Limite du champ dessinée par vous; statut cadastral non évalué.";
  } catch (error) {
    if (generation === workerSoilGeneration)
      output.textContent = error.message || String(error);
    workerSoilSample = null;
  } finally {
    if (generation === workerSoilGeneration) button.disabled = false;
  }
}

async function newWorkerConfig(form) {
  const { country, crop, sowingDate, name, territory, variety, outlineConsent } = form.elements;
  const parcelGeometry = workerEditorGeometry(form);
  if (!outlineConsent.checked) throw new Error("Autorisez l’envoi du contour avant l’enregistrement.");
  if (!workerSoilSample || workerSoilSample.geometryText !== JSON.stringify(parcelGeometry) ||
      workerSoilSample.country !== country.value || workerSoilSample.sowingDate !== sowingDate.value ||
      workerSoilSample.crop !== crop.value) {
    throw new Error("Analysez d’abord le terrain, le sol et la météo pour ces paramètres.");
  }
  const { config } = await workerPost({action: "campaign-draft", cropId: crop.value, config: {
    country: country.value, name: name.value.trim(), territory: territory.value.trim(), variety: variety.value.trim(),
    sowingDate: sowingDate.value, parcelGeometry, weather: workerSoilSample.weather,
    soil: { source: workerSoilSample.source, layers: workerSoilSample.layers, infiltrationMmDay: null }
  }});
  return config;
}

function openWorkerEditor(field = null) {
  if (!field && !workerSessionReady) { workerPanel.hidden = false; workerNotice("Connectez-vous pour créer un champ dans votre espace."); return; }
  editedWorkerField = field;
  const form = element("worker-editor-form");
  form.reset();
  putText("worker-editor-error", "");
  resetWorkerPlacePicker();
  element("worker-new-fields").hidden = !!field;
  form.elements.variety.disabled = !!field;
  form.elements.crop.disabled = !!field;
  form.elements.sowingDate.disabled = !!field;
  if (field) {
    if (!field.campaign) { workerNotice("Attendez le chargement du détail de la campagne."); return; }
    const c = field.campaign.config;
    form.elements.name.value = c.name || "";
    form.elements.territory.value = c.territory || "";
    form.elements.variety.value = c.variety || "Non renseignée";
    putText("worker-editor-title", "Modifier « " + field.name + " »");
    putText("worker-editor-hint", "Nom et localité · enregistrement sur la révision " + field.revision + ". Les autres paramètres restent ceux de la campagne.");
  } else {
    putText("worker-editor-title", "Nouvelle campagne");
    putText("worker-editor-hint", "Choisissez une culture puis tracez le contour de votre champ.");
    const select = form.elements.crop;
    void workerPost({action: "campaign-crops"}).then(data => {
      select.replaceChildren(new Option("Choisir une culture", ""));
      for (const crop of data.crops) {
        const option = new Option(crop.name, crop.id);
        if (crop.days) option.dataset.days = crop.days;
        else { option.disabled = true; option.textContent += " · à configurer dans Ma simulation"; }
        select.add(option);
      }
    }).catch(error => putText("worker-editor-error", error.message || String(error)));
  }
  element("worker-editor").showModal();
  if (!field) requestAnimationFrame(() => {
    workerPlacePicker.classList.add("is-expanded");
    syncWorkerPlaceFullscreen();
    element("worker-place-query").focus({preventScroll:true});
  });
}

async function saveWorkerEditor(event) {
  event.preventDefault();
  if (workerSaving) return;
  const form = event.currentTarget;
  const field = editedWorkerField;
  putText("worker-editor-error", "");
  workerSaving = true;
  element("worker-editor-save").disabled = true;
  try {
    const config = field ? structuredClone(field.campaign.config) : await newWorkerConfig(form);
    config.name = form.elements.name.value.trim();
    config.territory = form.elements.territory.value.trim();
    if (!config.name || !config.territory) throw new Error("Nom et localité requis.");
    const body = { action: "save", id: field?.campaignId || crypto.randomUUID().replaceAll("-", ""),
      expectedRevision: field?.revision || 0, config, ...(field ? {} : { events: [] }) };

    const response = await workerInvoke("worker_mutate", { body });
    if (![200, 201].includes(response.status) || !response.data?.campaign)
      throw new Error(response.data?.error || "Enregistrement refusé (HTTP " + response.status + ").");
    element("worker-editor").close();
    state.fieldId = response.data.campaign.id;
    workerPanel.hidden = false;
    await refreshWorkerFields();
    workerNotice("Campagne enregistrée · révision " + response.data.campaign.revision + ".");
  } catch (error) {
    const message = error.message || String(error);
    putText("worker-editor-error", message +
      (message.includes("modifi") || message.includes("révision") ? " Actualisez la campagne avant de reprendre ; votre formulaire reste ouvert." : ""));
  } finally {
    workerSaving = false;
    element("worker-editor-save").disabled = false;
  }
}

async function saveWorkerConfig(field, transform) {
  if (!field?.campaign || workerSaving) throw new Error("Campagne indisponible ou enregistrement en cours.");
  const config = structuredClone(field.campaign.config);
  transform(config);
  workerSaving = true;
  try {
    const response = await workerInvoke("worker_mutate", { body: {
      action: "save", id: field.campaignId, expectedRevision: field.revision, config
    }});
    if (response.status !== 200 || !response.data?.campaign)
      throw new Error(response.data?.error || "Enregistrement refusé (HTTP " + response.status + ").");
    field.campaign = response.data.campaign;
    field.revision = response.data.campaign.revision;
    field.zoneMapData = null;
    field.name = response.data.campaign.config.name;
    if (currentField() === field) update();
    workerNotice("Campagne mise à jour · révision " + field.revision + ".");
    return response.data.campaign;
  } finally { workerSaving = false; }
}

function fieldNotesFor(field) {
  const config = field.campaign?.config;
  if (!config?.agronomic || config.agronomic.geometryId !== JSON.stringify(field.geometry)) return [];
  return (config.agronomic.observations || []).filter(item => item.method === "Observation visuelle au champ")
    .slice().reverse().sort((a, b) => b.availableOn.localeCompare(a.availableOn));
}

let editingNoteField = null;

function openFieldNote(field) {
  editingNoteField = field;
  const form = element("note-form");
  form.reset();
  form.elements.date.value = form.elements.date.max = new Date().toISOString().slice(0, 10);
  putText("note-location", field.name);
  putText("note-error", "");
  element("note-dialog").showModal();
}

element("note-form").addEventListener("submit", async event => {
  event.preventDefault();
  const field = editingNoteField;
  if (!field?.campaign || workerSaving) return;
  const form = event.currentTarget;
  workerSaving = true;
  element("save-note").disabled = true;
  try {
    const response = await workerInvoke("worker_mutate", { body: {
      action: "field-note", id: field.id, expectedRevision: field.revision,
      note: {parameter: form.elements.parameter.value, date: form.elements.date.value, note: form.elements.body.value}
    }});
    if (response.status !== 200 || !response.data?.campaign) throw new Error(response.data?.error || "Observation indisponible.");
    field.campaign = response.data.campaign;
    field.revision = response.data.campaign.revision;
    element("note-dialog").close();
    if (currentField() === field) update();
  } catch (error) {
    putText("note-error", error.message || String(error));
  } finally {
    workerSaving = false;
    element("save-note").disabled = false;
  }
});

function renderWorkerEvents(field) {
  const list = element("notes");
  list.replaceChildren();
  element("note-body").hidden = true;
  if (!field.campaign) {
    list.append(makeNode("p","soft-text","Chargement des observations…"));
    return;
  }
  const events = field.campaign.events || [];
  const observations = fieldNotesFor(field);
  observations.forEach((note, index) => {
    const row = makeNode("button", "note-row");
    row.type = "button";
    row.setAttribute("aria-pressed", String(state.noteId === index));
    row.append(makeIcon("pin", true), makeNode("span", "", note.parameter + " · " + note.availableOn));
    row.addEventListener("click", () => { state.noteId = index; updateNotes(field); paintIcons(); scheduleDraw(); });
    list.append(row);
  });
  if (observations[state.noteId]) {
    const note = observations[state.noteId];
    putText("note-body", note.value + " · " + note.source);
    element("note-body").hidden = false;
  }
  if (!events.length && !observations.length) list.append(makeNode("p","soft-text","Aucune observation enregistrée dans cette campagne."));
  for (const event of events.slice().reverse()) {
    const row = makeNode("div","note-row");
    const label = event.kind === "rain" ? "Pluie" : event.kind === "irrigation" ? "Irrigation" : "Humidité du sol";
    row.append(makeNode("b","",label + " · " + event.date),
      makeNode("small","",number.format(event.amount) + " " + event.unit +
        " · " + event.status + " · " + event.source));
    list.append(row);
  }
}

function openWorkerEvent(field) {
  if (!field?.campaign) return;
  const form = element("worker-event-form");
  form.reset();
  form.elements.date.value = new Date().toISOString().slice(0,10);
  putText("worker-event-error","");
  putText("worker-event-title","Observation · " + field.name);
  element("worker-event-dialog").showModal();
}

async function saveWorkerEvent(event) {
  event.preventDefault();
  if (workerSaving) return;
  const field = currentField();
  const form = event.currentTarget;
  const kind = form.elements.kind.value;
  const amount = form.elements.amount.valueAsNumber;
  if (!field.remote || !field.campaign || !["rain","irrigation"].includes(kind) ||
      !Number.isFinite(amount) || amount < 0 || !form.elements.source.value.trim()) return;
  const observation = {id:crypto.randomUUID().replaceAll("-",""),kind,
    date:form.elements.date.value,amount,unit:"mm",point:"field",status:kind === "rain" ? "measured" : "declared",
    source:form.elements.source.value.trim(),recordedAt:new Date().toISOString()};
  workerSaving=true;
  element("worker-event-save").disabled=true;
  putText("worker-event-error","Enregistrement et recalcul du Worker…");
  try {
    const response = await workerInvoke("worker_mutate",{body:{action:"event",id:field.campaignId,
      expectedRevision:field.revision,event:observation}});
    if (response.status!==200 || !response.data?.campaign)
      throw new Error(response.data?.error || "Observation refusée (HTTP " + response.status + ").");
    field.campaign=response.data.campaign;
    field.revision=response.data.campaign.revision;
    field.zoneMapData=null;
    element("worker-event-dialog").close();
    update();
    showMessage("Observation enregistrée ; bilan recalculé.");
  } catch(error) { putText("worker-event-error",error.message || String(error)); }
  finally { workerSaving=false; element("worker-event-save").disabled=false; }
}

element("worker-place-search").addEventListener("click", searchWorkerPlaces);
element("worker-place-connect").addEventListener("click", () => {
  const button = element("worker-place-connect");
  button.disabled = true;
  startWorkerLogin({
    onStatus: message => putText("worker-place-status", message),
    onConnected: async () => {
      button.hidden = true;
      await searchWorkerPlaces();
    }
  });
  setTimeout(() => { button.disabled = false; }, 2000);
});
const workerPlacePicker = element("worker-place-picker");
const workerPlaceExpand = element("worker-place-map-expand");
function syncWorkerPlaceFullscreen() {
  const expanded = document.fullscreenElement === workerPlacePicker || workerPlacePicker.classList.contains("is-expanded");
  workerPlaceExpand.textContent = expanded ? "Quitter le plein écran" : "Plein écran";
  workerPlaceExpand.setAttribute("aria-pressed", String(expanded));
  drawWorkerPlaceMap();
}
workerPlaceExpand.addEventListener("click", async () => {
  if (document.fullscreenElement === workerPlacePicker) {
    await document.exitFullscreen().catch(() => {});
    return;
  }
  if (workerPlacePicker.classList.contains("is-expanded")) {
    workerPlacePicker.classList.remove("is-expanded");
    syncWorkerPlaceFullscreen();
    return;
  }
  try {
    if (!workerPlacePicker.requestFullscreen) throw new Error("Plein écran indisponible");
    await workerPlacePicker.requestFullscreen();
  } catch {
    workerPlacePicker.classList.add("is-expanded");
  }
  syncWorkerPlaceFullscreen();
});
document.addEventListener("fullscreenchange", syncWorkerPlaceFullscreen);
element("map-empty-create").addEventListener("click", () => openWorkerEditor());
element("worker-editor-form").elements.crop.addEventListener("change", () => clearWorkerSoilSample("Relancez l’analyse pour la culture sélectionnée."));
element("worker-place-analyze").addEventListener("click", analyzeWorkerParcel);
element("worker-editor-form").elements.geometry.addEventListener("input", () => {
  const form = element("worker-editor-form");
  workerPlaceState.points = [];
  clearWorkerSoilSample("Le contour a changé. Relancez l’analyse des données réelles.");
  let geometry = null;
  try { geometry = workerEditorGeometry(form); } catch {}
  workerPlaceState.geometry = geometry;
  drawWorkerPlaceMap();
  clearTimeout(workerGeometryImageTimer);
  if (geometry && form.elements.outlineConsent.checked) workerGeometryImageTimer = setTimeout(() => {
    workerPlaceState.center = null;
    workerPlaceState.zoom = 1;
    void loadWorkerPlaceImage();
  }, 700);
});
element("worker-editor-form").elements.outlineConsent.addEventListener("change", event => {
  if (event.currentTarget.checked && !workerPlaceState.center && workerPlaceState.geometry) void loadWorkerPlaceImage();
});
element("worker-editor-form").elements.country.addEventListener("change", () =>
  clearWorkerSoilSample("Le pays a changé. Relancez l’analyse des données réelles."));
element("worker-editor-form").elements.sowingDate.addEventListener("change", () =>
  clearWorkerSoilSample("La date de semis a changé. Relancez l’analyse des données réelles."));
element("worker-place-query").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); void searchWorkerPlaces(); }
});
element("worker-place-map").addEventListener("click", event => {
  if (!workerPlaceState.image || !workerPlaceState.bounds || editedWorkerField) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  if (workerPlaceState.points.length >= 200) {
    putText("worker-place-status", "Limite de 200 sommets atteinte pour ce contour.");
    return;
  }
  const [west, south, east, north] = workerPlaceState.bounds;
  workerPlaceState.points.push([west + x * (east - west), north - y * (north - south)]);
  updateWorkerPlaceGeometry();
});
element("worker-place-undo").addEventListener("click", () => {
  workerPlaceState.points.pop();
  updateWorkerPlaceGeometry();
});
element("worker-place-clear").addEventListener("click", () => {
  workerPlaceState.points = [];
  updateWorkerPlaceGeometry();
});
element("worker-place-zoom-in").addEventListener("click", () => {
  if (!workerPlaceState.center && !workerPlaceState.geometry) return;
  workerPlaceState.zoom = Math.min(8, workerPlaceState.zoom * 1.5);
  void loadWorkerPlaceImage();
});
element("worker-place-zoom-out").addEventListener("click", () => {
  if (!workerPlaceState.center && !workerPlaceState.geometry) return;
  workerPlaceState.zoom = Math.max(.25, workerPlaceState.zoom / 1.5);
  void loadWorkerPlaceImage();
});
element("worker-new").addEventListener("click", () => openWorkerEditor());
element("worker-edit").addEventListener("click", () => openWorkerEditor(currentField()));
element("worker-editor-cancel").addEventListener("click", () => element("worker-editor").close());
element("worker-editor-form").addEventListener("submit", saveWorkerEditor);
element("worker-event-cancel").addEventListener("click", () => element("worker-event-dialog").close());
element("worker-event-form").addEventListener("submit", saveWorkerEvent);
