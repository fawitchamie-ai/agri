/* Enregistrement volontaire des campagnes. Le serveur contrôle géométrie, révision et calcul. */
let editedWorkerField = null;
let workerSaving = false;

function newWorkerConfig(form) {
  const day = new Date().toISOString().slice(0, 10);
  const sowingDate = form.elements.sowingDate.value;
  if (!sowingDate || !/^\d{4}-\d{2}-\d{2}$/.test(sowingDate)) throw new Error("Date de semis requise.");
  let parcelGeometry;
  try { parcelGeometry = JSON.parse(form.elements.geometry.value.trim()); }
  catch { throw new Error("Collez un contour GeoJSON valide."); }
  const ring = parcelGeometry?.type === "Polygon" ? parcelGeometry.coordinates?.[0] : null;
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 2000 ||
      !ring.every(p => Array.isArray(p) && p.length === 2 &&
        Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
        Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90) ||
      JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1)))
    throw new Error("Le contour doit être un Polygon GeoJSON fermé en longitude, latitude.");
  return {
    inputPolicy: { allowAssumptions: false, allowStale: false },
    country: form.elements.country.value,
    name: form.elements.name.value.trim(), territory: form.elements.territory.value.trim(),
    crop: "Maïs", cropProfile: {id:"maize",version:"agronomy-2026-10-29.1",mode:"reference"},
    adjustDepletionToEtc: true, variety: form.elements.variety.value.trim(),
    sowingDate, asOfDate: day, areaM2: null, latitude: null, longitude: null, parcelGeometry,
    soil: { source: "Propriétés hypothétiques à confirmer par mesure ou référence locale",
      layers: [{ thicknessM: 1.2, thetaFC: .3, thetaWP: .15, initialTheta: null }], infiltrationMmDay: 30 },
    parameterSource: "FAO56 tableaux 11/12/22 ; scénario maïs, Nigeria humide, mai. Kc non ajustés au climat ; racines hypothétiques limitées par 1,2 m de sol. À confirmer localement.",
    stages: [
      { name: "Installation (phase hydrique)", days: 20, kcStart: .3, kcEnd: .3, rootStartM: .15, rootEndM: .3625, depletionFraction: .55 },
      { name: "Développement du couvert", days: 35, kcStart: .3, kcEnd: 1.2, rootStartM: .3625, rootEndM: 1, depletionFraction: .55 },
      { name: "Pleine couverture", days: 40, kcStart: 1.2, kcEnd: 1.2, rootStartM: 1, rootEndM: 1, depletionFraction: .55 },
      { name: "Fin de cycle", days: 30, kcStart: 1.2, kcEnd: .35, rootStartM: 1, rootEndM: 1, depletionFraction: .55 }
    ],
    system: { name: "À renseigner", source: "Caractéristiques à renseigner",
      applicationEfficiency: null, transportEfficiency: null, sourceFlowM3h: null,
      hoursPerDay: null, sourceBudgetM3: null, maxNetMmPerDay: 25, minIntervalDays: 1,
      allowedWeekdays: [0, 1, 2, 3, 4, 5, 6], targetDepletionFraction: .05, dailySourceLimits: [] },
    weather: [], fallback: null, systemDomain: "upland"
  };
}

function openWorkerEditor(field = null) {
  editedWorkerField = field;
  const form = element("worker-editor-form");
  form.reset();
  putText("worker-editor-error", "");
  element("worker-new-fields").hidden = !!field;
  form.elements.variety.disabled = !!field;
  if (field) {
    if (!field.campaign) { workerNotice("Attendez le chargement du détail de la campagne."); return; }
    const c = field.campaign.config;
    form.elements.name.value = c.name || "";
    form.elements.territory.value = c.territory || "";
    form.elements.variety.value = c.variety || "Non renseignée";
    putText("worker-editor-title", "Modifier « " + field.name + " »");
    putText("worker-editor-hint", "Nom et localité · enregistrement sur la révision " + field.revision + ". Les autres paramètres restent ceux de la campagne.");
  } else {
    form.elements.sowingDate.value = new Date().toISOString().slice(0, 10);
    putText("worker-editor-title", "Nouvelle campagne");
    putText("worker-editor-hint", "Renseignez un vrai contour GeoJSON. La météo et les mesures du sol devront être complétées pour calculer un conseil.");
  }
  element("worker-editor").showModal();
}

async function saveWorkerEditor(event) {
  event.preventDefault();
  if (workerSaving) return;
  const form = event.currentTarget;
  const field = editedWorkerField;
  putText("worker-editor-error", "");
  let body;
  try {
    const config = field ? structuredClone(field.campaign.config) : newWorkerConfig(form);
    config.name = form.elements.name.value.trim();
    config.territory = form.elements.territory.value.trim();
    if (!config.name || !config.territory) throw new Error("Nom et localité requis.");
    body = { action: "save", id: field?.campaignId || crypto.randomUUID().replaceAll("-", ""),
      expectedRevision: field?.revision || 0, config, ...(field ? {} : { events: [] }) };
  } catch (error) { putText("worker-editor-error", error.message || String(error)); return; }
  workerSaving = true;
  element("worker-editor-save").disabled = true;
  try {
    const response = await workerInvoke("worker_mutate", { body });
    if (![200, 201].includes(response.status) || !response.data?.campaign)
      throw new Error(response.data?.error || "Enregistrement refusé (HTTP " + response.status + ").");
    element("worker-editor").close();
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

function renderWorkerEvents(field) {
  const list = element("notes");
  list.replaceChildren();
  element("note-body").hidden = true;
  if (!field.campaign) {
    list.append(makeNode("p","soft-text","Chargement des observations…"));
    return;
  }
  const events = field.campaign.events || [];
  if (!events.length) list.append(makeNode("p","soft-text","Aucune observation enregistrée dans cette campagne."));
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
    date:form.elements.date.value,amount,unit:"mm",point:"field",status:"measured",
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

element("worker-new").addEventListener("click", () => openWorkerEditor());
element("worker-edit").addEventListener("click", () => openWorkerEditor(currentField()));
element("worker-editor-cancel").addEventListener("click", () => element("worker-editor").close());
element("worker-editor-form").addEventListener("submit", saveWorkerEditor);
element("worker-event-cancel").addEventListener("click", () => element("worker-event-dialog").close());
element("worker-event-form").addEventListener("submit", saveWorkerEvent);
