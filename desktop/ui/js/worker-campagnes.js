/* Lecture des campagnes du Worker. La démonstration reste séparée des données réelles. */
const workerPanel = element("worker-panel");
const workerMessage = element("worker-message");
let workerBusy = false;
let workerGeneration = 0;

function workerNotice(message) {
  workerMessage.textContent = message;
}

function workerBusyState(busy) {
  workerBusy = busy;
  element("worker-refresh").disabled = busy;
  element("worker-login").disabled = busy;
}

async function workerInvoke(command, args = {}) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error("La connexion au Worker fonctionne dans l’application Windows. Lancez le projet avec Tauri.");
  return invoke(command, args);
}

async function workerRead(campaignId = null) {
  const response = await workerInvoke("worker_get", { campaignId });
  if (response.status !== 200) {
    throw new Error(typeof response.data?.error === "string"
      ? response.data.error : "Le Worker a répondu avec le statut " + response.status + ".");
  }
  return response.data;
}

async function workerPost(body) {
  const response = await workerInvoke("worker_post", { body });
  if (response.status !== 200) throw new Error(response.data?.error || "Le Worker a répondu avec le statut " + response.status + ".");
  return response.data;
}

function satelliteBounds(geometry) {
  const ring = geometry?.type === "Polygon" ? geometry.coordinates?.[0] : null;
  if (!Array.isArray(ring) || ring.length < 4) return null;
  const xs = ring.map(p => Number(p?.[0])), ys = ring.map(p => Number(p?.[1]));
  if (![...xs, ...ys].every(Number.isFinite)) return null;
  const w = Math.min(...xs), e = Math.max(...xs), s = Math.min(...ys), n = Math.max(...ys);
  if (w >= e || s >= n) return null;
  const k = Math.max(.2, Math.cos((s + n) / 2 * Math.PI / 180));
  let width = Math.max((e - w) * 1.2, 200 / 111320 / k);
  let height = Math.max((n - s) * 1.2, 200 / 111320);
  if (width * k / height < 1.6) width = height * 1.6 / k;
  else height = width * k / 1.6;
  return [(w + e - width) / 2, (s + n - height) / 2,
    (w + e + width) / 2, (s + n + height) / 2];
}

function projectedShape(geometry, bounds = satelliteBounds(geometry)) {
  const ring = geometry?.type === "Polygon" ? geometry.coordinates?.[0] : null;
  if (!bounds || !Array.isArray(ring) || ring.length < 4 || ring.length > 2000) return null;
  const points = ring.map(pair => [Number(pair?.[0]), Number(pair?.[1])]);
  if (!points.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) &&
      lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) return null;
  return points.slice(0, -1).map((pair, i) => [
    Math.round(96 + (points[i][0] - bounds[0]) / (bounds[2] - bounds[0]) * 768),
    Math.round(80 + (bounds[3] - points[i][1]) / (bounds[3] - bounds[1]) * 480)
  ]);
}

function workerField(row) {
  const shape = projectedShape(row.geometry);
  return {
    id: "worker:" + row.id,
    campaignId: row.id,
    remote: true,
    geometry: row.geometry,
    imageBounds: satelliteBounds(row.geometry),
    remoteImages: new Map(),
    imageLayer: "rgb",
    imageDate: "",
    compareDates: [],
    compareLayers: ["satellite", "ndvi"],
    revision: row.revision,
    name: typeof row.name === "string" && row.name.trim() ? row.name : "Campagne sans nom",
    crop: typeof row.crop === "string" && row.crop.trim() ? row.crop : "Culture non renseignée",
    area: typeof row.areaM2 === "number" && row.areaM2 >= 0 ? row.areaM2 / 10000 : NaN,
    sowing: row.sowingDate ? new Date(row.sowingDate + "T12:00:00Z").toLocaleDateString("fr-FR") : "",
    rain: undefined,
    ndvi: null,
    notePoint: [480, 320],
    action: "Résultats du Worker",
    actionDetail: "Les valeurs disponibles proviennent de la campagne enregistrée.",
    geometryAvailable: !!shape,
    shape: shape || [[380, 250], [580, 250], [580, 390], [380, 390]],
    campaign: null
  };
}

function resetWorkerFields() {
  workerGeneration++;
  fields.splice(0, fields.length, ...localFields);
  geography.clear();
  state.fieldId = localFields[0].id;
  state.view = "fields";
  recenter();
  update();
}

async function refreshWorkerFields() {
  if (workerBusy) return;
  workerBusyState(true);
  workerNotice("Chargement des campagnes…");
  const generation = ++workerGeneration;
  try {
    const data = await workerRead();
    if (!Array.isArray(data.campaigns)) throw new Error("Liste des campagnes absente dans la réponse du Worker.");
    if (generation !== workerGeneration) return;
    if (!data.campaigns.length) {
      resetWorkerFields();
      workerNotice("Votre espace ne contient aucune campagne. Cliquez sur « Nouvelle campagne » pour créer votre premier champ.");
      return;
    }
    fields.splice(0, fields.length, ...data.campaigns.map(workerField));
    geography.clear();
    state.fieldId = fields[0].id;
    state.view = "campaign";
    recenter();
    update();
    workerNotice(fields.length + (fields.length === 1 ? " campagne chargée." : " campagnes chargées.") +
      (data.truncated ? " La liste est limitée aux 500 plus récentes." : ""));
    workerPanel.hidden = true;
    await openWorkerCampaign(fields[0], generation);
  } catch (error) {
    workerNotice(error.message || String(error));
  } finally {
    workerBusyState(false);
  }
}

async function openWorkerCampaign(field, generation = workerGeneration) {
  if (!field.remote || field.campaign || field.loadingCampaign) return;
  field.loadingCampaign = true;
  if (state.fieldId === field.id) workerNotice("Chargement du détail de « " + field.name + " »…");
  try {
    const result = await workerRead(field.campaignId);
    if (generation !== workerGeneration || !fields.includes(field)) return;
    if (!result.campaign || result.campaign.id !== field.campaignId) throw new Error("Campagne incompatible avec la sélection.");
    field.campaign = result.campaign;
    field.revision = result.campaign.revision;
    if (result.campaign.config?.parcelGeometry) {
      field.geometry = result.campaign.config.parcelGeometry;
      field.imageBounds = satelliteBounds(field.geometry);
      const shape = projectedShape(field.geometry, field.imageBounds);
      field.geometryAvailable = !!shape;
      if (shape) { field.shape = shape; geography.delete(field.id); }
    }
    if (state.fieldId === field.id) {
      workerNotice("Campagne « " + field.name + " » chargée · révision " + field.revision + ".");
      update();
    }
  } catch (error) {
    if (state.fieldId === field.id) workerNotice(error.message || String(error));
  } finally {
    field.loadingCampaign = false;
  }
}

function updateSatelliteControls(field) {
  const controls = element("worker-satellite");
  if (!field.remote || !field.geometryAvailable) { controls.hidden = true; return; }
  controls.hidden = false;
  element("worker-satellite-load").disabled = !field.campaign || !!field.imageLoading;
  element("worker-satellite-selects").hidden = !field.imageDates?.length;
  element("worker-satellite-load").hidden = !!field.imageDates?.length;
  if (field.imageDates?.length) {
    const dates = element("worker-satellite-date");
    if (dates.options.length !== field.imageDates.length ||
        dates.options[0]?.value !== field.imageDates[0])
      dates.replaceChildren(...field.imageDates.map(day => new Option(day, day)));
    dates.value = field.imageDate;
    element("worker-satellite-layer").value = field.imageLayer;
  }
  putText("worker-satellite-message", field.imageMessage || "");
}

async function loadWorkerImage(field, date, layer, side = null) {
  if (!field.remote || !field.imageBounds || !field.imageDates?.includes(date)) return;
  const key = date + ":" + layer;
  if (side === null) {
    field.imageDate = date;
    field.imageLayer = layer;
  } else {
    field.compareDates[side] = date;
    field.compareLayers[side] = layer === "ndvi" ? "ndvi" : "satellite";
  }
  if (field.remoteImages.has(key)) { update(); return; }
  field.imageMessage = "Chargement de l’image…";
  updateSatelliteControls(field);
  try {
    const response = await workerInvoke("worker_image", { date, layer, bounds: field.imageBounds });
    if (response.mime !== "image/png" || !response.data) throw new Error("Image indisponible.");
    const image = new Image();
    image.src = "data:image/png;base64," + response.data;
    await image.decode();
    if (!fields.includes(field)) return;
    field.remoteImages.set(key, image);
    field.imageMessage = "Date régionale publiée · " + date + " · " + (layer === "ndvi" ? "NDVI" : "Satellite") +
      " · vérifiez la couverture du champ avec les indices.";
    if (field.id === state.fieldId) update();
  } catch (error) {
    field.imageMessage = error.message || String(error);
    if (field.id === state.fieldId) updateSatelliteControls(field);
  }
}

async function loadWorkerSatellite(field) {
  if (!field.remote || !field.geometryAvailable || !field.campaign || field.imageLoading) return;
  field.imageLoading = true;
  field.imageMessage = "Recherche des dates publiées…";
  updateSatelliteControls(field);
  const asOfDate = field.campaign.config?.asOfDate || new Date().toISOString().slice(0, 10);
  try {
    const catalog = await workerPost({ action: "satellite-catalog", asOfDate });
    const rgb = catalog.layers?.rgb?.dates || [], ndvi = catalog.layers?.ndvi?.dates || [];
    const both = rgb.filter(date => ndvi.includes(date) && date <= asOfDate);
    const from = field.campaign.config?.sowingDate ||
      new Date(Date.parse(asOfDate) - 120 * 86400000).toISOString().slice(0, 10);
    field.imageDates = both.filter(date => date >= from).sort().reverse().slice(0, 48);
    if (!field.imageDates.length) throw new Error("Aucune date Sentinel-2 publiée pour cette campagne.");
    field.imageDate = field.imageDates[0];
    field.compareDates = [field.imageDates[Math.min(1, field.imageDates.length - 1)], field.imageDates[0]];
    updateSatelliteControls(field);
    await loadWorkerImage(field, field.imageDate, field.imageLayer);
    if (state.view === "compare" && state.fieldId === field.id)
      await Promise.all(field.compareDates.map((day, side) =>
        loadWorkerImage(field, day, field.compareLayers[side] === "ndvi" ? "ndvi" : "rgb", side)));
  } catch (error) {
    field.imageMessage = error.message || String(error);
  } finally {
    field.imageLoading = false;
    updateSatelliteControls(field);
  }
}

function renderWorkerIndices(field) {
  const panel = element("worker-indices");
  panel.hidden = !field.remote;
  if (!field.remote) return;
  element("worker-indices-load").disabled = !field.geometryAvailable || !field.campaign || !!field.indicesLoading;
  element("worker-indices-load").hidden = !!field.indexSeries;
  putText("worker-indices-status", field.indicesMessage ||
    (field.geometryAvailable ? "Indices mesurés sur les pixels clairs du contour." : "Contour requis pour les indices."));
  const rows = element("worker-indices-rows");
  rows.replaceChildren();
  const observations = field.indexSeries?.observations || [];
  if (!observations.length && field.indexSeries)
    rows.append(makeNode("p", "soft-text", field.indexSeries.issues?.[0] ||
      "Aucune acquisition exploitable sur cette période."));
  for (const item of observations.slice().reverse()) {
    const ndvi = Number.isFinite(item.ndviMedian) ? indexNumber.format(item.ndviMedian) : "—";
    const evi = Number.isFinite(item.eviMedian) ? indexNumber.format(item.eviMedian) : "—";
    rows.append(workerRow(item.date, "NDVI " + ndvi + " · EVI " + evi));
    rows.append(makeNode("small", "worker-index-quality",
      item.validPixels + " pixels valides · " + number.format(item.clearFraction * 100) + " % clairs"));
  }
  if (field.indexSeries?.source)
    rows.append(makeNode("small", "worker-index-quality", field.indexSeries.source));
}

function updateWorkerComparison(field) {
  element("comparison-reading").hidden = !field.imageDates?.length;
  const dated = field.indexSeries?.observations || [];
  const matching = field.compareDates?.map(date => dated.find(item =>
    item.date === date && item.quality === "usable" && Number.isFinite(item.ndviMedian))) || [];
  const validDelta = field.compareLayers?.every(layer => layer === "ndvi") &&
    matching.length === 2 && matching.every(Boolean);
  element("delta").parentElement.parentElement.hidden = !validDelta;
  if (validDelta) putText("delta", signedIndex.format(matching[1].ndviMedian - matching[0].ndviMedian));
  for (const [side, letter] of ["a", "b"].entries()) {
    const dateSelect = element("date-" + letter);
    const layerSelect = element("layer-" + letter);
    const dates = field.imageDates || [];
    if (dateSelect.options.length !== dates.length || dateSelect.options[0]?.value !== dates[0])
      dateSelect.replaceChildren(...dates.map(date => new Option(date, date)));
    if (layerSelect.options.length !== 2 || layerSelect.options[0]?.value !== "satellite")
      layerSelect.replaceChildren(new Option("Satellite", "satellite"), new Option("NDVI", "ndvi"));
    dateSelect.value = field.compareDates?.[side] || "";
    layerSelect.value = field.compareLayers?.[side] || "satellite";
    const date = field.compareDates?.[side];
    const layer = field.compareLayers?.[side] || "satellite";
    putText("summary-date-" + letter, date || "—");
    putText("summary-value-" + letter, date ? (layer === "ndvi" && matching[side]
      ? "NDVI médian " + indexNumber.format(matching[side].ndviMedian)
      : layer === "ndvi" ? "Carte NDVI" : "Image satellite") : "—");
  }
  putText("comparison-message", field.imageDates?.length
    ? validDelta ? "Écart des médianes NDVI mesurées sur la parcelle · dates comparables."
      : "Images Sentinel‑2 publiées · comparaison visuelle. Chargez les indices du champ pour calculer un écart entre acquisitions exploitables."
    : "Chargez d’abord les images Sentinel‑2 pour comparer deux dates réelles.");
}

function updateWorkerZones(field, isDose) {
  putText("zones-heading", isDose ? "Carte de doses" : "Zones historiques");
  const load = element("worker-zone-load");
  load.hidden = !field.geometryAvailable || !field.campaign;
  load.disabled = !!field.zoneLoading;
  putText("worker-zone-status", field.zoneMessage || "");
  const monitoring = field.campaign?.config?.fieldMonitoring;
  const seasons = Array.isArray(monitoring?.seasons) ? monitoring.seasons : [];
  const prescription = monitoring?.prescription;
  const list = element("zone-list");
  list.replaceChildren();
  if (!field.campaign) {
    putText("zones-description", "Chargement de la campagne…");
    return;
  }
  const map = field.zoneMapData?.revision === field.revision ? field.zoneMapData : null;
  if (map && !isDose) {
    putText("zones-description", map.label + " · vigueur relative, pas rendement mesuré. " +
      (map.projection === "relative-hypothesis" ? "Contrôles temporels validés pour cette hypothèse relative." :
      "Projection historique indisponible."));
    for (const feature of map.historical?.features || [])
      list.append(workerRow(feature.properties.label,
        number.format(feature.properties.area_ha) + " ha"));
    for (const reason of map.reasons || []) list.append(makeNode("p","soft-text",reason));
    return;
  }
  if (isDose) {
    putText("zones-description", map?.dose
      ? "Carte de doses confirmée · scénario utilisateur, pas optimum calculé automatiquement."
      : prescription?.confirmed
      ? "Scénario déclaré · chargez la carte pour vérifier sa portée géographique et ses doses."
      : "Aucune carte de doses confirmée dans cette campagne.");
    if (map?.dose) {
      for (const feature of map.dose.features)
        list.append(workerRow(feature.properties.label + " · " + number.format(feature.properties.area_ha) + " ha",
          number.format(feature.properties.dose) + " " + feature.properties.unit));
      return;
    }
    if (map?.doseReason) list.append(makeNode("p","soft-text",map.doseReason));
    if (prescription?.confirmed) {
      list.append(workerRow("Produit", prescription.product || "—"),
        workerRow("Référence", prescription.reference || "—"),
        workerRow("Dose uniforme", number.format(prescription.baseline) + " " + prescription.unit));
      for (const [zone, dose] of Object.entries(prescription.rates || {}))
        if (Number.isFinite(dose)) list.append(workerRow(zone, number.format(dose) + " " + prescription.unit));
    }
    return;
  }
  const mapped = monitoring?.currentObservation || seasons.at(-1);
  putText("zones-description", seasons.length || monitoring?.currentObservation
    ? "Archives NDVI disponibles · chargez la carte géographique vérifiée. " +
      (mapped?.source || "Source non renseignée") + "."
    : "Aucune saison historique qualifiée enregistrée pour ce contour.");
  for (const read of seasons) {
    if (!read?.season) continue;
    const clear = Array.isArray(read.cells) ? read.cells.filter(c => c?.[2] >= 2).length : 0;
    list.append(workerRow(read.season.startDate + " → " + read.season.endDate,
      clear + " cellules observées sur plusieurs dates · grille " + read.gridM + " m"));
  }
  if (monitoring?.currentObservation?.scenes?.[0])
    list.append(workerRow("Dernière observation",
      monitoring.currentObservation.scenes[0].date + " · " +
      number.format(monitoring.currentObservation.scenes[0].clearFraction * 100) + " % clairs"));
}

async function loadWorkerZoneMap(field) {
  if (!field?.remote || !field.campaign || !field.geometryAvailable || field.zoneLoading) return;
  field.zoneLoading = true;
  field.zoneMessage = "Analyse géographique du Worker…";
  updateWorkerZones(field,state.zoneLayer === "dose");
  try {
    const result = await workerPost({action:"field-zone-map",id:field.campaignId});
    if (result.version !== "desktop-zone-map-1" || result.revision !== field.revision ||
        result.historical?.type !== "FeatureCollection")
      throw new Error("Carte reçue pour une autre révision ou format inconnu. Actualisez la campagne.");
    field.zoneMapData = result;
    field.zoneMessage = "Carte calculée sur la révision " + result.revision + ".";
    if (field.id === state.fieldId) update();
  } catch(error) {
    field.zoneMessage = error.message || String(error);
    if (field.id === state.fieldId) updateWorkerZones(field,state.zoneLayer === "dose");
  } finally {
    field.zoneLoading = false;
    if (field.id === state.fieldId) element("worker-zone-load").disabled = false;
  }
}

async function loadWorkerIndices(field) {
  if (!field?.remote || !field.campaign?.config?.parcelGeometry || field.indicesLoading) return;
  const config = field.campaign.config;
  const asOfDate = config.asOfDate || new Date().toISOString().slice(0, 10);
  const limit = new Date(Date.parse(asOfDate) - 120 * 86400000).toISOString().slice(0, 10);
  const startDate = config.sowingDate > limit && config.sowingDate <= asOfDate ? config.sowingDate : limit;
  field.indicesLoading = true;
  field.indicesMessage = "Lecture des acquisitions Sentinel‑2…";
  renderWorkerIndices(field);
  try {
    const result = await workerPost({
      action: "satellite-index-series", geometry: config.parcelGeometry, startDate, asOfDate
    });
    if (result.version !== "sentinel-parcel-indices-1" || !Array.isArray(result.observations))
      throw new Error("Format des indices inattendu.");
    if (!fields.includes(field)) return;
    field.indexSeries = result;
    field.indicesMessage = result.coverageNote || "Indices Sentinel‑2 chargés.";
  } catch (error) {
    field.indicesMessage = error.message || String(error);
  } finally {
    field.indicesLoading = false;
    if (field.id === state.fieldId) renderWorkerIndices(field);
  }
}

const localSelectField = selectField;
selectField = function (id) {
  localSelectField(id);
  const field = currentField();
  if (field.remote) {
    update();
    void openWorkerCampaign(field);
  }
};

function workerDecision(field, topicId) {
  const c = field.campaign?.config || {};
  const p = field.campaign?.plan || {};
  const products = c.managementPlan?.products?.filter(item => item.kind === "fertilizer") || [];
  const firstWindow = p.nextWindows?.[0];
  switch (topicId) {
    case "sowing":
      return p.sowingPlan?.status === "indicative" && Number.isFinite(p.sowingPlan.seedKg)
        ? { label: "Semences à préparer", value: number.format(p.sowingPlan.seedKg) + " kg",
            note: "Plan indicatif du Worker · " + (p.sowingPlan.source || "source non renseignée") }
        : { label: "Semis de la campagne", value: c.sowingDate || "Non renseigné",
            note: p.sowingPlan?.missing?.[0] || "Aucun plan de semis disponible dans cette révision." };
    case "variety":
      return { label: "Variété déclarée", value: c.variety || "Non renseignée",
        note: "Le choix local d’une variété exige ses références et le calendrier agronomique." };
    case "stand":
      return { label: "Levée", value: "À contrôler",
        note: "Renseignez un comptage et votre densité cible. Le calcul reste un repère local, sans prescription automatique de regarnissage." };
    case "water":
      return firstWindow && p.status === "conditional"
        ? { label: "Prochaine fenêtre d’arrosage", value: firstWindow.from + " → " + firstWindow.to,
            note: "Plan conditionnel du Worker · vérifier le débit, le sol et les observations." }
        : { label: "Arrosage", value: "Non disponible", note: p.missing?.[0] || "Aucune prochaine fenêtre calculée." };
    case "fertilizer":
      return products.length
        ? { label: "Apports documentés", value: products.length + (products.length === 1 ? " apport" : " apports"),
            note: "Doses de produit commercial déclarées dans la campagne ; effet sur le rendement non modélisé ici." }
        : { label: "Engrais", value: "Non renseigné",
            note: "Aucune dose personnalisée qualifiée dans cette campagne." };
    case "harvest":
      return { label: "Fin du cycle simulé", value: p.horizonEnd || "Non calculée",
        note: "Repère calendaire, pas une date optimale de récolte. Contrôlez l’humidité et la maturité au champ." };
    case "sale":
      return { label: "Vente ou stockage", value: "Comparer vos prix",
        note: "Saisissez votre lot et vos prix. Le calcul économique est un scénario arithmétique, sans prévision du marché." };
    default: return { label: "Décision", value: "Non disponible", note: "" };
  }
}

const TOGO_MAIZE_VARIETIES = [
  ["TZEE", 80, 85], ["Ikenne", 100, 105], ["Sotubaka", 100, 110],
  ["Opeaburo", 110, 115], ["Lamatessi", 110, 120], ["Adéta", 110, 120],
  ["Samaz", 110, 120], ["TZPB", 115, 120]
];
function workerVarietyRows(field, body) {
  const c = field.campaign?.config || {};
  if (c.country !== "TGO" || c.cropProfile?.id !== "maize" || !/^\d{4}-\d{2}-\d{2}$/.test(c.sowingDate || "")) return;
  body.append(makeNode("h3", "section-title", "Comparer les cycles · maïs au Togo"));
  body.append(makeNode("p", "soft-text", "Repères ANAMET 2024 · maturité à 50 % depuis le semis. Confirmez les semences disponibles et le lot acheté."));
  for (const [name, low, high] of TOGO_MAIZE_VARIETIES) {
    const from = new Date(Date.parse(c.sowingDate + "T12:00:00Z") + low * 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.parse(c.sowingDate + "T12:00:00Z") + high * 86400000).toISOString().slice(0, 10);
    body.append(workerRow(name + " · " + low + "–" + high + " j", from + " → " + to));
  }
  body.append(makeNode("small", "worker-index-quality",
    "Source : ANAMET / Ministère de l’Agriculture du Togo, bulletin agro-hydro-météorologique n° 002, tableau 2.5 (2024). Le stock et la fin des pluies ne sont pas confirmés."));
}

function renderWorkerDecision(field) {
  const topic = decisionTopics.find(item => item.id === decisionState.topic);
  const result = workerDecision(field, topic.id);
  putText("decision-title", topic.title);
  putText("decision-context", field.name + " · données du Worker · révision " + (field.revision || "—"));
  const select = element("decision-field");
  select.replaceChildren(...fields.map(item => new Option(item.name, item.id)));
  select.value = field.id;
  const body = element("decision-body");
  body.replaceChildren();
  const lead = makeNode("div", "decision-lead");
  const value = makeNode("div");
  value.append(makeNode("strong", "", result.value), makeNode("span", "lead-label", result.label));
  lead.append(value);
  body.append(lead, makeNode("p", "soft-text", result.note));
  if (topic.id === "variety") workerVarietyRows(field, body);
  if (topic.id === "sowing" && field.campaign?.plan?.sowingPlan?.status === "indicative") {
    const sowing = field.campaign.plan.sowingPlan;
    if (Number.isFinite(sowing.seedRateKgHa)) body.append(workerRow("Dose", number.format(sowing.seedRateKgHa) + " kg/ha"));
    if (sowing.rangeKg) body.append(workerRow("Plage de référence",
      number.format(sowing.rangeKg[0]) + " à " + number.format(sowing.rangeKg[1]) + " kg"));
  }
  if (topic.id === "fertilizer") {
    for (const item of field.campaign?.plan?.management?.products ||
      field.campaign?.config?.managementPlan?.products || []) {
      if (item.kind !== "fertilizer") continue;
      body.append(workerRow(item.product + " · " + item.date,
        number.format(item.dose) + " " + item.unit + " · " +
        (item.status === "declared" ? "réalisé" : "prévu")));
      if (Number.isFinite(item.nutrients?.elementalKgHa?.N))
        body.append(workerRow("Azote apporté", number.format(item.nutrients.elementalKgHa.N) + " kg N/ha"));
    }
    const advice = makeNode("button","btn","Lire la prochaine information utile");
    advice.type = "button";
    const result = makeNode("p","soft-text","");
    advice.addEventListener("click", async () => {
      advice.disabled = true; result.textContent = "Lecture du Worker…";
      try {
        const info = await workerPost({action:"fertilizer-information",config:field.campaign.config});
        result.textContent = info.action + " " + info.reason + " · méthode : " + info.method;
      } catch (error) { result.textContent = error.message || String(error); }
      finally { advice.disabled = false; }
    });
    body.append(advice,result);
    if (field.campaign) workerFertilizerForm(body,field);
  }
  if (topic.id === "water") {
    const config = field.campaign?.config;
    if (Number.isFinite(config?.latitude) && Number.isFinite(config?.longitude)) {
      const weather = makeNode("button","btn","Voir la météo prévue");
      weather.type = "button";
      const result = makeNode("p","soft-text","");
      weather.addEventListener("click", async () => {
        weather.disabled = true; result.textContent = "Prévisions en cours…";
        try {
          const data = await workerPost({action:"weather",country:config.country,
            latitude:config.latitude,longitude:config.longitude});
          const days = (data.weather || []).slice(0,7);
          const valid = days.filter(d=>Number.isFinite(d.rainMm));
          result.textContent = valid.length === days.length && days.length
            ? "Pluie prévue sur " + days.length + " jours : " + number.format(valid.reduce((sum,d)=>sum+d.rainMm,0)) +
              " mm · " + data.attribution + " Prévision, pas pluie mesurée sur la parcelle."
            : "Prévision de pluie incomplète : aucune somme fiable.";
        } catch (error) { result.textContent = error.message || String(error); }
        finally { weather.disabled = false; }
      });
      body.append(weather,result);
    }
    if (field.campaign) workerIrrigationForm(body,field);
  }
  if (topic.id === "stand") workerStandForm(body);
  if (topic.id === "harvest") {
    const estimate = field.campaign?.plan?.yieldEstimation;
    const recorded = estimate?.scenarios?.find(s => s.id === "recorded");
    if (estimate?.status === "conditional" && recorded?.status === "conditional") {
      if (Number.isFinite(recorded.totals?.yieldKgHaSown))
        body.append(workerRow("Rendement conditionnel", number.format(recorded.totals.yieldKgHaSown / 1000) + " t/ha"));
      if (Number.isFinite(recorded.totals?.productionKg))
        body.append(workerRow("Production conditionnelle", number.format(recorded.totals.productionKg / 1000) + " t"));
    } else body.append(makeNode("p", "soft-text", estimate?.missing?.[0] || "Rendement non disponible."));
  }
  if (topic.id === "sale") workerSaleForm(body,field);
  element("decision-preview-btn").hidden = true;
  element("decision-history").hidden = true;
  element("decision-map-foot").hidden = true;
  element("decision-dock").querySelectorAll("[data-topic]").forEach(button =>
    button.setAttribute("aria-pressed", String(button.dataset.topic === topic.id)));
}

function workerNumberInput(parent,label,value="") {
  const row = makeNode("label", "worker-decision-input", label);
  const input = document.createElement("input");
  input.type = "number"; input.min = "0"; input.step = "any";
  input.value = value === "" ? "" : String(value);
  row.append(input); parent.append(row);
  return input;
}

function workerTextInput(parent,label,type="text",value="") {
  const row = makeNode("label","worker-decision-input",label);
  const input = document.createElement("input");
  input.type = type; input.value = value;
  if (type === "text") input.maxLength = 600;
  row.append(input); parent.append(row);
  return input;
}

function managementFor(config) {
  return config.managementPlan || {
    version:"management-1.0.0", geometryId:JSON.stringify(config.parcelGeometry),
    cropId:config.cropProfile?.id || "", irrigation:{mode:"automatic",applications:[]}, products:[]
  };
}

function workerIrrigationForm(body,field) {
  body.append(makeNode("h3","section-title","Planifier un arrosage"));
  const date = workerTextInput(body,"Date dans le cycle","date",
    field.campaign.config.sowingDate > field.campaign.config.asOfDate
      ? field.campaign.config.sowingDate : field.campaign.config.asOfDate || "");
  const volume = workerNumberInput(body,"Volume au champ (m³/ha)");
  const button = makeNode("button","btn primary","Enregistrer l’arrosage prévu");
  button.type = "button";
  const feedback = makeNode("p","soft-text", "Le mode manuel remplace le calendrier automatique. Les volumes précédemment saisis sont conservés.");
  button.addEventListener("click",async()=>{
    const amount = volume.valueAsNumber;
    if (!date.value || !Number.isFinite(amount) || amount <= 0) {
      feedback.textContent="Date et volume positif requis.";return;
    }
    button.disabled=true; feedback.textContent="Enregistrement et recalcul du Worker…";
    try {
      await saveWorkerConfig(field,config=>{
        const plan=managementFor(config);
        plan.irrigation={mode:"manual",applications:[...plan.irrigation.applications.filter(a=>a.date!==date.value),
          {date:date.value,fieldM3Ha:amount}].sort((a,b)=>a.date.localeCompare(b.date))};
        config.managementPlan=plan;
      });
      showMessage("Arrosage prévu enregistré ; plan recalculé.");
    } catch(error) { feedback.textContent=error.message || String(error); button.disabled=false; }
  });
  body.append(button,feedback);
}

function workerFertilizerForm(body,field) {
  body.append(makeNode("h3","section-title","Documenter un apport prévu"));
  const product=workerTextInput(body,"Produit commercial");
  const date=workerTextInput(body,"Date dans le cycle","date",
    field.campaign.config.sowingDate > field.campaign.config.asOfDate
      ? field.campaign.config.sowingDate : field.campaign.config.asOfDate || "");
  const dose=workerNumberInput(body,"Dose de produit (kg/ha)");
  const source=workerTextInput(body,"Source de la dose (conseil ou étiquette)");
  const button=makeNode("button","btn primary","Enregistrer l’apport prévu");
  button.type="button";
  const feedback=makeNode("p","soft-text","Produit enregistré sans gain de rendement présumé. La composition pourra être complétée dans l’application web.");
  button.addEventListener("click",async()=>{
    const quantity=dose.valueAsNumber;
    if (!product.value.trim() || !date.value || !source.value.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      feedback.textContent="Produit, date, dose positive et source requis.";return;
    }
    button.disabled=true; feedback.textContent="Enregistrement et recalcul du Worker…";
    try {
      const id=crypto.randomUUID();
      await saveWorkerConfig(field,config=>{
        const plan=managementFor(config);
        plan.products.push({id,date:date.value,kind:"fertilizer",product:product.value.trim(),
          dose:quantity,unit:"kg/ha",status:"planned",source:source.value.trim(),npkPercent:[null,null,null]});
        config.managementPlan=plan;
      });
      showMessage("Apport prévu enregistré ; effet sur le rendement non modélisé.");
    } catch(error) { feedback.textContent=error.message || String(error); button.disabled=false; }
  });
  body.append(button,feedback);
}

function workerStandForm(body) {
  const observed = workerNumberInput(body,"Plants comptés par hectare");
  const target = workerNumberInput(body,"Densité cible (plants/ha)");
  const result = makeNode("p","worker-computed soft-text","Saisissez les deux valeurs pour comparer.");
  body.append(result);
  function calculate() {
    const measured = observed.valueAsNumber, wanted = target.valueAsNumber;
    result.textContent = Number.isFinite(measured) && measured >= 0 && Number.isFinite(wanted) && wanted > 0
      ? number.format(measured / wanted * 100) + " % de la densité cible · écart " +
        number.format(Math.max(0,wanted-measured)) + " plants/ha. Vérifiez le nombre de points comptés et la régularité spatiale."
      : "Saisissez un comptage et une cible positive.";
  }
  observed.addEventListener("input",calculate); target.addEventListener("input",calculate);
}

function workerSaleForm(body,field) {
  const estimate = field.campaign?.plan?.yieldEstimation;
  const recorded = estimate?.scenarios?.find(s=>s.id==="recorded");
  const predicted = estimate?.status === "conditional" && recorded?.status === "conditional" &&
    Number.isFinite(recorded.totals?.productionKg) ? Math.round(recorded.totals.productionKg) : "";
  const mass = workerNumberInput(body,"Lot à vendre (kg) · pesé ou scénario",predicted);
  const now = workerNumberInput(body,"Prix actuel (FCFA/kg)");
  const later = workerNumberInput(body,"Prix futur supposé (FCFA/kg)");
  const cost = workerNumberInput(body,"Coût total de stockage (FCFA)");
  const result = makeNode("p","worker-computed soft-text","Saisissez les prix et les coûts.");
  body.append(result);
  function calculate() {
    const values = [mass,now,later,cost].map(input=>input.valueAsNumber);
    if (!values.every(v=>Number.isFinite(v) && v>=0) || values[0]<=0) {
      result.textContent="Lot positif et prix/coûts requis.";return;
    }
    const [kg,p1,p2,storage]=values;
    const netNow=kg*p1, netLater=kg*p2-storage, threshold=p1+storage/kg;
    result.textContent="Vendre : "+number.format(netNow)+" FCFA · Stocker : "+number.format(netLater)+
      " FCFA selon votre prix supposé. Seuil pour couvrir le stockage : "+number.format(threshold)+
      " FCFA/kg. "+(predicted!==""?"Lot initial tiré de la production conditionnelle, remplacez-le par une pesée réelle.":"Lot saisi par vous.");
  }
  [mass,now,later,cost].forEach(input=>input.addEventListener("input",calculate));
}

function workerRow(label, value) {
  const row = makeNode("div", "data-row");
  row.append(makeNode("span", "key", label), makeNode("b", "", value));
  return row;
}

function renderWorkerCampaign(field) {
  const detail = element("worker-campaign-detail");
  detail.hidden = false;
  detail.replaceChildren();
  if (!field.campaign) {
    detail.append(makeNode("p", "soft-text", "Chargement des résultats de la campagne…"));
    return;
  }
  const config = field.campaign.config || {};
  const plan = field.campaign.plan || {};
  const date = config.asOfDate || field.campaign.updatedAt?.slice(0, 10) || "—";
  detail.append(makeNode("h3", "section-title", "Résultats enregistrés"));
  detail.append(workerRow("Révision", String(field.campaign.revision)));
  detail.append(workerRow("Date des données", date));
  detail.append(workerRow("Statut du plan", plan.status === "conditional" ? "Conditionnel" :
    plan.status === "blocked" ? "Suspendu" : "Non disponible"));
  const yieldReport = plan.yieldEstimation;
  const scenario = yieldReport?.scenarios?.find(item => item.id === "recorded");
  if (yieldReport?.status === "conditional" && scenario?.status === "conditional" &&
      Number.isFinite(scenario.totals?.yieldKgHaSown)) {
    detail.append(workerRow("Rendement · réalisé", number.format(scenario.totals.yieldKgHaSown / 1000) + " t/ha"));
    if (Number.isFinite(scenario.totals.productionKg))
      detail.append(workerRow("Production · réalisée", number.format(scenario.totals.productionKg / 1000) + " t"));
  } else {
    detail.append(workerRow("Rendement du champ", "Pas simulé"));
    detail.append(makeNode("p", "soft-text",
      yieldReport?.missing?.[0] || "Aucune estimation de rendement utilisable dans cette révision."));
  }
  detail.append(makeNode("h3", "section-title", "Eau"));
  if (plan.status === "conditional" && Number.isFinite(plan.totals?.netMm)) {
    detail.append(workerRow("Irrigation nette du plan", number.format(plan.totals.netMm) + " mm"));
    if (Number.isFinite(plan.totals?.sourceM3))
      detail.append(workerRow("Volume à la source", number.format(plan.totals.sourceM3) + " m³"));
    const next = plan.nextWindows?.[0];
    if (next) detail.append(workerRow("Prochaine fenêtre", next.from + " → " + next.to));
  } else {
    detail.append(makeNode("p", "soft-text", plan.missing?.[0] || "Plan hydrique indisponible."));
  }
  detail.append(makeNode("h3", "section-title", "Engrais et autres décisions"));
  const products = config.managementPlan?.products?.filter(item => item.kind === "fertilizer") || [];
  if (products.length) {
    for (const item of products) {
      detail.append(workerRow(item.product + " · " + item.date,
        number.format(item.dose) + " " + item.unit + " · " +
        (item.status === "declared" ? "réalisé" : "prévu")));
    }
  } else detail.append(makeNode("p", "soft-text", "Aucun apport d’engrais dans cette révision."));
  detail.append(makeNode("p", "soft-text",
    "Ces doses sont saisies dans la campagne. Leur effet sur le rendement n’est pas une recommandation calibrée. Les autres aides indiquent les données manquantes dans « Décider »."));
  if (!field.geometryAvailable)
    detail.append(makeNode("p", "soft-text", "Aucun contour géographique exploitable dans la réponse du Worker."));
}

element("worker-toggle").addEventListener("click", () => { workerPanel.hidden = !workerPanel.hidden; });
element("worker-close").addEventListener("click", () => { workerPanel.hidden = true; });
element("worker-login").addEventListener("click", async () => {
  try {
    await workerInvoke("open_worker_login");
    workerNotice("Terminez la connexion dans la fenêtre ouverte, puis cliquez sur « Actualiser les campagnes ».");
  } catch (error) { workerNotice(error.message || String(error)); }
});
element("worker-refresh").addEventListener("click", refreshWorkerFields);
element("worker-demo").addEventListener("click", () => {
  resetWorkerFields();
  workerPanel.hidden = true;
  workerNotice("Démonstration locale affichée.");
});
element("worker-satellite-load").addEventListener("click", () => {
  void loadWorkerSatellite(currentField());
});
element("worker-satellite-date").addEventListener("change", event => {
  void loadWorkerImage(currentField(), event.target.value, currentField().imageLayer);
});
element("worker-satellite-layer").addEventListener("change", event => {
  void loadWorkerImage(currentField(), currentField().imageDate, event.target.value);
});
element("worker-indices-load").addEventListener("click", () => {
  void loadWorkerIndices(currentField());
});
element("worker-zone-load").addEventListener("click", () => void loadWorkerZoneMap(currentField()));
for (const [side, letter] of ["a", "b"].entries()) {
  for (const prefix of ["date", "layer"]) {
    element(prefix + "-" + letter).addEventListener("change", () => {
      const field = currentField();
      if (!field.remote) return;
      const date = element("date-" + letter).value;
      const layer = element("layer-" + letter).value === "ndvi" ? "ndvi" : "rgb";
      void loadWorkerImage(field, date, layer, side);
    });
  }
}
