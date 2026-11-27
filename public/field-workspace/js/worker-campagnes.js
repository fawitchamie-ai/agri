/* Lecture directe des campagnes et données de l’API AgriPrévision. */
const workerPanel = element("worker-panel");
const workerMessage = element("worker-message");
let workerBusy = false;
let workerSessionReady = false;
let workerSession = null;
const satellitePermissions = new Map();
let workerGeneration = 0;
let workerLoginPollTimer = null;
let workerLoginPollGeneration = 0;

function workerNotice(message) {
  workerMessage.textContent = message;
}

function workerBusyState(busy) {
  workerBusy = busy;
  element("worker-refresh").disabled = busy;
  element("worker-login").disabled = busy;
  element("worker-space").disabled = busy || !workerSession || (workerSession.cooperatives?.length || 0) < 2;
  element("worker-new").disabled = busy || !workerSessionReady;
}

async function workerRead(campaignId = null) {
  const response = await workerInvoke("worker_get", { campaignId, coopId: workerSession?.coopId });
  if (response.status !== 200) {
    const error = new Error(typeof response.data?.error === "string"
      ? response.data.error : "Le Worker a répondu avec le statut " + response.status + ".");
    error.code = response.data?.code || (response.status === 409 ? "WORKSPACE_CHANGED" : "HTTP_ERROR");
    error.status = response.status;
    throw error;
  }
  if (response.data?.demo === true || response.data?.campaign?.demo === true) {
    throw new Error("Connectez-vous à votre compte AgriPrévision pour retrouver vos campagnes.");
  }
  return response.data;
}

function stopWorkerLoginPolling() {
  workerLoginPollGeneration++;
  if (workerLoginPollTimer) clearTimeout(workerLoginPollTimer);
  workerLoginPollTimer = null;
}

function startWorkerLogin({ onConnected = null, onStatus = null } = {}) {
  if (!nativeInvoke) { void workerInvoke("open_worker_login"); return; }
  stopWorkerLoginPolling();
  const generation = workerLoginPollGeneration;
  const status = message => {
    workerNotice(message);
    if (typeof onStatus === "function") onStatus(message);
  };
  status("Ouverture de la connexion sécurisée au Worker…");
  workerInvoke("open_worker_login").then(() => {
    status("Terminez la connexion dans la fenêtre ouverte. L’accès à l’API est vérifié automatiquement.");
    const deadline = Date.now() + 180000;
    const check = async () => {
      if (generation !== workerLoginPollGeneration) return;
      if (Date.now() >= deadline) {
        workerLoginPollTimer = null;
        status("Connexion non détectée. Vérifiez la fenêtre de connexion, puis réessayez.");
        return;
      }
      try {
        const data = await workerRead();
        if (!Array.isArray(data.campaigns)) throw new Error("Liste des campagnes absente dans la réponse du Worker.");
        if (workerBusy) {
          workerLoginPollTimer = setTimeout(check, 1000);
          return;
        }
        await refreshWorkerFields({ closeLogin: false });
        if (generation !== workerLoginPollGeneration) return;
        if (typeof onConnected === "function") await onConnected();
        if (generation !== workerLoginPollGeneration) return;
        await workerInvoke("close_worker_login");
        workerLoginPollTimer = null;
        status("Connexion à l’API établie. Les données proviennent du Worker.");
        return;
      } catch (error) {
        const message = error.message || String(error);
        if (!/Cloudflare Access requise|Connexion Cloudflare Access requise/i.test(message)) status(message);
      }
      workerLoginPollTimer = setTimeout(check, 2500);
    };
    void check();
  }).catch(error => status(error.message || String(error)));
}

async function closeWorkerLogin() {
  stopWorkerLoginPolling();
  try {
    await workerInvoke("close_worker_login");
    workerNotice("Fenêtre de connexion fermée.");
  } catch (error) { workerNotice(error.message || String(error)); }
}

async function workerPost(body) {
  const response = await workerInvoke("worker_post", { body: { ...body, ...(workerSession?.coopId ? { workspaceId: workerSession.coopId } : {}) } });
  if (response.status !== 200) {
    const error = new Error(response.data?.error || "Le Worker a répondu avec le statut " + response.status + ".");
    error.code = response.data?.code || (response.status === 409 ? "WORKSPACE_CHANGED" : "HTTP_ERROR");
    error.status = response.status;
    throw error;
  }
  return response.data;
}

function renderWorkerIdentity(session) {
  window.agriActiveWorkspace = session?.coopId || null;
  const spaces = Array.isArray(session?.cooperatives) ? session.cooperatives : [];
  const active = spaces.find(space => space.coopId === session?.coopId);
  putText("worker-identity", session ? session.name + " · " + (active?.name || "Espace actif") : "Aucun compte vérifié");
  const select = element("worker-space");
  select.replaceChildren(...spaces.map(space => new Option(space.name + " · " + space.role, space.coopId)));
  select.value = session?.coopId || "";
  select.disabled = !session || spaces.length < 2 || workerBusy;
  element("worker-logout").hidden = !session;
  element("worker-login").hidden = !!session;
  element("worker-refresh").disabled = workerBusy || !session;
  element("worker-new").disabled = workerBusy || !workerSessionReady;
  putText("active-context", session ? session.name + " · " + (active?.name || session.coopId) : "");
  element("active-context").hidden = !session;
  putText("data-status", session ? "Compte connecté" : workerBusy ? "Vérification…" : "Connexion requise");
  element("data-status").title = session
    ? "Compte vérifié par l’API AgriPrévision · " + session.name + " · " + (active?.name || session.coopId)
    : "La session sera confirmée par une réponse protégée du Worker.";
}

function clearRemoteContext({ invalidate = true } = {}) {
  if (invalidate) workerGeneration++;
  workerSessionReady = false;
  workerSession = null;
  satellitePermissions.clear();
  setDecisionScope(null);
  decisionState.inputs.clear();
  decisionState.saved.length = 0;
  fields.splice(0, fields.length);
  geography.clear();
  state.fieldId = null;
  state.view = "fields";
  renderWorkerIdentity(null);
  if(typeof unmountWorkerEmptyPicker==="function")unmountWorkerEmptyPicker();
  recenter();
  update();
  if(typeof mountWorkerEmptyPicker==="function")mountWorkerEmptyPicker();
}

function handleWorkerSessionFailure(failure) {
  if(!["SESSION_EXPIRED","FORBIDDEN","SERVICE_UNAVAILABLE","ACCESS_REDIRECT","NETWORK","WORKSPACE_CHANGED"].includes(failure?.code))return;
  const context=window.agriPendingReturnContext||window.agriReturnContext;
  const views=["fields","compare","zones","notes","campaign","decisions"];
  if(!window.agriPendingReturnContext&&context&&views.includes(context.view))
    window.agriPendingReturnContext={view:context.view,
      ...(typeof context.campaignId==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(context.campaignId)?{campaignId:context.campaignId}:{})};
  window.agriClearSensitiveUi?.({preserveParcelDraft:true});
  clearRemoteContext();
  workerPanel.hidden=false;
  workerNotice(failure.message||"La session n’a pas pu être vérifiée. Les données de l’espace précédent ont été effacées.");
}
window.agriHandleSessionFailure=handleWorkerSessionFailure;

async function switchWorkerSpace(coopId) {
  if(workerBusy||!workerSessionReady||!workerSession)return;
  if(element("worker-editor").open){
    workerNotice("Fermez ou enregistrez le formulaire de campagne avant de changer d’espace.");
    renderWorkerIdentity(workerSession);
    return;
  }
  const target=workerSession.cooperatives?.find(space=>space.coopId===coopId);
  if(!target||coopId===workerSession.coopId){renderWorkerIdentity(workerSession);return;}
  window.agriPendingReturnContext=null;
  clearRemoteContext();
  workerBusyState(true);
  workerNotice("Effacement de l’ancien espace, puis vérification du nouvel espace…");
  let failure=null;
  try{
    const response=await workerInvoke("worker_space_switch",{body:{action:"switch",coopId}});
    if(response.status!==200||response.data?.coopId!==coopId){
      failure=new Error(response.data?.error||"Le Worker n’a pas confirmé le changement d’espace.");
      failure.code=response.data?.code||"HTTP_ERROR";
    }
  }catch(error){failure=error;}
  finally{workerBusyState(false);}
  if(failure)workerNotice(failure.message||String(failure));
  await refreshWorkerFields();
}

function logoutWorkerAccess(){
  stopWorkerLoginPolling();
  window.agriPendingReturnContext=null;
  window.agriReturnContext=null;
  try{sessionStorage.removeItem("agriprevision.return-context");}catch{}
  window.agriClearSensitiveUi?.({discardDrafts:true});
  clearRemoteContext();
  workerPanel.hidden=false;
  workerNotice("Session effacée de l’écran. Déconnexion de Cloudflare Access…");
  const returnTo="/field-workspace/";
  location.assign("/cdn-cgi/access/logout?"+new URLSearchParams({returnTo}));
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
    id: row.id,
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
    shape: shape || [],
    soilProfileData: null,
    soilProfileGeometry: "",
    soilProfileLoading: false,
    soilProfileMessage: "",
    campaign: null
  };
}

function resetWorkerFields(invalidate = true) {
  if (invalidate) workerGeneration++;
  fields.splice(0, fields.length);
  geography.clear();
  state.fieldId = null;
  state.view = "fields";
  recenter();
  update();
}

async function refreshWorkerFields({ closeLogin = true, preferredCampaignId = null } = {}) {
  if (workerBusy) return;
  const previousFieldId = state.fieldId;
  const previousView = state.view;
  if(!window.agriPendingReturnContext&&workerSessionReady&&previousFieldId)
    window.agriPendingReturnContext={view:previousView,campaignId:previousFieldId};
  workerBusyState(true);
  clearRemoteContext({ invalidate: false });
  workerNotice("Vérification de la session et chargement des campagnes…");
  const generation = ++workerGeneration;
  try {
    const sessionResponse = await workerInvoke("worker_session");
    if (sessionResponse.status !== 200 || !sessionResponse.data?.session || sessionResponse.data.session.demo) {
      const error = new Error(sessionResponse.data?.error || "Session Cloudflare Access non vérifiée.");
      error.code = sessionResponse.data?.code || (sessionResponse.status === 401 ? "SESSION_EXPIRED" : "HTTP_ERROR");
      error.status = sessionResponse.status;
      throw error;
    }
    const account = sessionResponse.data.session;
    if (!account.userId || !account.coopId || !Array.isArray(account.cooperatives) ||
        !account.cooperatives.some(space => space.coopId === account.coopId))
      throw new Error("La réponse de session ne précise pas le compte et l’espace actifs.");
    if(typeof prepareWorkerParcelDraftForSession==="function")prepareWorkerParcelDraftForSession(account);
    workerSession = account;
    const data = await workerRead();
    if (!Array.isArray(data.campaigns)) throw new Error("Liste des campagnes absente dans la réponse du Worker.");
    if (generation !== workerGeneration) return;
    const campaigns = data.campaigns.filter(row => row.demo !== true);
    workerSessionReady = true;
    renderWorkerIdentity(account);
    setDecisionScope(data.decisionScope);
    if (!campaigns.length) {
      window.agriPendingReturnContext=null;
      resetWorkerFields(false);
      workerPanel.hidden = false;
      workerNotice("Compte connecté · aucune campagne enregistrée. Recherchez la localité du champ et tracez son contour sur la carte satellite.");
      mountWorkerEmptyPicker();
      if (closeLogin) await workerInvoke("close_worker_login").catch(() => {});
      return;
    }
    const pendingContext=window.agriPendingReturnContext;
    const pendingCampaignId=pendingContext?.campaignId||null;
    const lastId = preferredCampaignId || pendingCampaignId || previousFieldId;
    fields.splice(0, fields.length, ...campaigns.map(workerField));
    geography.clear();
    state.fieldId = fields.find(field => field.id === lastId)?.id || fields[0].id;
    if(pendingContext){
      const requestedCampaignAvailable=!pendingCampaignId||fields.some(field=>field.id===pendingCampaignId);
      state.view=requestedCampaignAvailable&&(!pendingCampaignId||state.fieldId===pendingCampaignId)
        ? pendingContext.view : "fields";
      window.agriPendingReturnContext=null;
    }else if(previousFieldId&&state.fieldId===previousFieldId){
      state.view=previousView;
    }else{
      state.view="fields";
    }
    recenter();
    update();
    workerNotice(fields.length + (fields.length === 1 ? " campagne chargée." : " campagnes chargées.") +
      (data.truncated ? " La liste est limitée aux 500 plus récentes." : ""));
    workerPanel.hidden = true;
    await openWorkerCampaign(currentField(), generation);
    if (closeLogin) await workerInvoke("close_worker_login").catch(() => {});
  } catch (error) {
    if (generation !== workerGeneration) return;
    window.agriClearSensitiveUi?.({preserveParcelDraft:true});
    clearRemoteContext();
    workerNotice(error.message || String(error));
    workerPanel.hidden = false;
  } finally {
    workerBusyState(false);
    renderWorkerIdentity(workerSession);
  }
}

async function openWorkerCampaign(field, generation = workerGeneration) {
  if (!field?.remote) return;
  if (field.campaign) return;
  if (field.loadingCampaign) return;
  field.loadingCampaign = true;
  if (state.fieldId === field.id) workerNotice("Chargement du détail de « " + field.name + " »…");
  try {
    const result = await workerRead(field.campaignId);
    if (generation !== workerGeneration || !fields.includes(field)) return;
    if (!result.campaign || result.campaign.id !== field.campaignId) throw new Error("Campagne incompatible avec la sélection.");
    field.campaign = result.campaign;
    field.revision = result.campaign.revision;
    const config = result.campaign.config;
    const days = Array.from({length:7}, (_, i) => new Date(Date.parse(config.asOfDate) - i * 86400000).toISOString().slice(0, 10));
    const recent = days.map(date => config.weather?.find(item => item.date === date && item.status === "observed")?.rainMm);
    field.rain = recent.every(Number.isFinite) ? recent.reduce((sum, value) => sum + value, 0) : undefined;
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
      if (hasSatelliteConsent(field)) void loadWorkerSatellite(field);
      if (state.view === "zones" || isDecisionSplit()) void loadWorkerZoneMap(field);
    }
  } catch (error) {
    if (state.fieldId === field.id) {
      showMessage(error.message || String(error));
      workerNotice(error.message || String(error));
    }
  } finally {
    field.loadingCampaign = false;
  }
}

function updateSatelliteControls(field) {
  const controls = element("worker-satellite");
  if (!field.geometryAvailable || ["decisions", "zones", "notes", "campaign"].includes(state.view)) { controls.hidden = true; return; }
  controls.hidden = false;
  element("worker-satellite-load").disabled = !field.campaign || !!field.imageLoading;
  element("worker-satellite-load").hidden = !!field.imageDates?.length;
  element("worker-satellite-load").textContent = hasSatelliteConsent(field) ? "Relancer la recherche" : "Autoriser et rechercher des images";
  putText("worker-satellite-message", field.imageMessage || (hasSatelliteConsent(field) ? "" : "Le contour sera transmis pour rechercher les images Sentinel‑2."));
}

function hasSatelliteConsent(field) {
  return !!field?.geometry && satellitePermissions.get(field.id) === JSON.stringify(field.geometry);
}

async function loadWorkerImage(field, date, layer, side = null) {
  if (!hasSatelliteConsent(field) || !field.imageDates?.includes(date)) return;
  if (side === null) {
    field.imageDate = date;
    field.imageLayer = layer;
  } else {
    field.compareDates[side] = date;
    field.compareLayers[side] = layer;
  }
  if (currentField() === field) update();
  const requestKey = date + (layer === "satellite" ? ":photo" : ":indices");
  field.imageRequests ??= new Map();
  let request = field.imageRequests.get(requestKey);
  if (!request) {
    request = (async () => {
      if (layer === "satellite") {
        const key = date + ":rgb";
        if (!field.remoteImages.has(key)) field.remoteImages.set(key, await workerImage({date, layer: "rgb", bounds: field.imageBounds}));
        return;
      }
      field.indexMaps ??= new Map();
      if (!field.indexMaps.has(date)) {
        const result = await workerPost({action: "field-index-image", id: field.id, date, consent: true});
        if (!result.observations?.length || !result.pixels?.length)
          throw new Error("Couverture claire insuffisante pour afficher cet indice à cette date.");
        field.indexMaps.set(date, result);
        const others = (field.indexSeries?.observations || []).filter(item => item.date !== date);
        field.indexSeries = {...result, observations: [...others, ...result.observations]};
      }
    })().finally(() => field.imageRequests.delete(requestKey));
    field.imageRequests.set(requestKey, request);
  }
  const isActive = () => currentField() === field && (side === null
    ? field.imageDate === date && field.imageLayer === layer
    : field.compareDates[side] === date && field.compareLayers[side] === layer);
  field.imageMessage = "Chargement de l’image…";
  if (isActive()) updateSatelliteControls(field);
  try {
    await request;
    if (isActive() && state.view !== "decisions") {
      const observation = field.indexMaps?.get(date)?.observations[0];
      field.imageMessage = layer === "satellite" ? "" : "Pixels Sentinel‑2 de 10 m · " + number.format(observation.clearFraction * 100) + " % clairs";
      update();
    }
  } catch (error) {
    if (isActive()) {
      field.imageMessage = error.message || String(error);
      updateSatelliteControls(field);
      showMessage(field.imageMessage);
    }
  }
}

async function loadWorkerSatellite(field) {
  if (!hasSatelliteConsent(field) || !field.campaign || field.imageLoading) return;
  field.imageLoading = true;
  field.imageMessage = "Recherche des scènes Sentinel‑2 sur le contour…";
  updateSatelliteControls(field);
  const asOfDate = new Date().toISOString().slice(0, 10);
  try {
    const scenes = await workerPost({ action: "satellite-scenes", geometry: field.geometry, asOfDate });
    if (currentField() !== field && !fields.includes(field)) return;
    field.imageDates = [...new Set((scenes.dates || []).map(scene => scene.date))].sort();
    if (!field.imageDates.length) throw new Error("Aucune scène Sentinel‑2 répertoriée sur ce contour durant les 120 derniers jours.");
    const latest = field.imageDates.at(-1);
    field.compareDates = [field.imageDates.at(-2) || latest, latest];
    field.compareLayers = ["satellite", "satellite"];
    field.imageLayer = "satellite";
    field.imageDate = latest;
    field.automaticImage = latest;
    if (currentField() === field) update();
    const photo = workerImage({layer: "basemap", date: "", bounds: field.imageBounds}).then(image => {
      field.basemap = image;
      if (currentField() === field) update();
    }).catch(() => {});
    await Promise.all([photo, loadWorkerImage(field, latest, "satellite")]);
    if (currentField() === field) void loadWorkerIndices(field);
    if (currentField() === field && isComparing()) void loadCompareImages(field);
  } catch (error) {
    field.imageMessage = error.message || String(error);
  } finally {
    field.imageLoading = false;
    if (currentField() === field) update();
  }
}

function loadCompareImages(field) {
  return Promise.all(field.compareDates?.map((date, side) => loadWorkerImage(field, date, field.compareLayers[side], side)) || []);
}

function renderWorkerIndices(field) {
  const panel = element("worker-indices");
  panel.hidden = !field.remote;
  if (!field.remote) return;
  element("worker-indices-load").disabled = !hasSatelliteConsent(field) || !field.campaign || !!field.indicesLoading;
  element("worker-indices-load").hidden = !hasSatelliteConsent(field);
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
    if (layerSelect.options.length !== 4) layerSelect.replaceChildren(...["satellite", "ndvi", "contrast", "evi"].map(key => new Option(LAYERS[key], key)));
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
  if (!field?.campaign || !field.geometryAvailable || field.zoneLoading || field.zoneMapData?.revision === field.revision) return;
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
  if (!field?.campaign || !field.geometry || field.indicesLoading) return;
  if (!hasSatelliteConsent(field)) { showMessage("Autorisez d’abord la recherche d’images pour ce contour."); return; }
  const config = field.campaign.config;
  const asOfDate = new Date().toISOString().slice(0, 10);
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
    const byDate = new Map((field.indexSeries?.observations || []).map(item => [item.date, item]));
    for (const item of result.observations) byDate.set(item.date, item);
    field.indexSeries = {...result, observations: [...byDate.values()]};
    const latest = observationsFor(field, "ndvi").at(-1)?.date;
    if (latest && field.imageDates?.includes(latest) && field.automaticImage === field.imageDate && field.imageLayer === "satellite") {
      field.automaticImage = null;
      void loadWorkerImage(field, latest, "ndvi");
    }
    field.indicesMessage = result.coverageNote || "Indices Sentinel‑2 chargés.";
  } catch (error) {
    field.indicesMessage = error.message || String(error);
  } finally {
    field.indicesLoading = false;
    if (field.id === state.fieldId && state.view !== "decisions") update();
  }
}

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
  if (!field.campaign) {
    putText("decision-title", topic.title);
    putText("decision-context", field.name);
    element("decision-body").replaceChildren(makeNode("p", "soft-text", "Chargement de la campagne…"));
    element("decision-preview-btn").hidden = true;
    element("decision-history").hidden = true;
    return;
  }
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
    const tabs = makeNode("div");
    tabs.innerHTML = segmented("Plan d’engrais", [["timing", "Date d’apport"], ["dose", "Doses et coût"]], decisionState.mode);
    body.append(tabs);
    if (decisionState.mode === "dose") {
      renderWorkerDoseBudget(body, field);
    } else {
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
  if (topic.id === "stand") body.innerHTML = buildStand({data: decisionValues(field), field});
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
  if (topic.id === "sale") body.innerHTML = buildSale({data: decisionValues(field)});
  if (topic.id === "harvest") {
    const data = decisionValues(field);
    const section = makeNode("section", "decision-inputs");
    section.innerHTML = numberInput("Lot à récolter (t)", "quantity", data.quantity, .001, 100000) +
      numberInput("Humidité mesurée (%)", "moisture", data.moisture, 0, 100) +
      numberInput("Camion (t/rotation)", "truck", data.truck, .1, 100) +
      numberInput("Rotations", "trips", data.trips, 1, 100, 1) +
      numberInput("Seuil acheteur (%)", "limit", data.limit, 1, 100) +
      numberInput("Capacité de séchage (t)", "dryer", data.dryer, 0, 100000);
    body.append(section);
  }
  element("decision-preview-btn").hidden = true;
  element("decision-history").hidden = true;
  element("decision-map-foot").hidden = true;
  element("decision-dock").querySelectorAll("[data-topic]").forEach(button =>
    button.setAttribute("aria-pressed", String(button.dataset.topic === topic.id)));
}

function doseFeatures(field) {
  const map = field.zoneMapData;
  return map?.revision === field.revision && Array.isArray(map.historical?.features)
    ? map.historical.features.filter(feature => Number.isFinite(feature.properties?.area_ha) && feature.properties.area_ha > 0)
    : [];
}

function workerDoseBudget(field, data) {
  const features = doseFeatures(field);
  if (!features.length || !nonnegative(data.usual) || !positive(data.bag)) return null;
  const rows = features.map(({properties}) => ({area: properties.area_ha, rate: data["rate-" + properties.zone]}));
  if (!rows.every(row => nonnegative(row.rate))) return null;
  const area = rows.reduce((sum, row) => sum + row.area, 0);
  const total = rows.reduce((sum, row) => sum + row.area * row.rate, 0);
  const difference = total - area * data.usual;
  const cost = nonnegative(data.price) ? total * data.price : null;
  const threshold = cost !== null && difference > 0 && positive(data.grain) ? difference * data.price / data.grain : null;
  return {total, difference, cost, threshold, bags: Math.ceil(total / data.bag)};
}

function renderWorkerDoseBudget(body, field) {
  const features = doseFeatures(field);
  if (!features.length) {
    body.append(makeNode("p", "soft-text", field.zoneMessage || "Une carte qualifiée est nécessaire pour calculer les doses par zone."));
    return;
  }
  const data = decisionValues(field);
  const confirmed = new Map((field.zoneMapData.dose?.features || []).filter(feature => feature.properties.unit === "kg/ha")
    .map(feature => [feature.properties.zone, feature.properties.dose]));
  for (const {properties} of features) {
    const name = "rate-" + properties.zone;
    if (data[name] === undefined && confirmed.has(properties.zone)) data[name] = confirmed.get(properties.zone);
  }
  const section = makeNode("section", "decision-section");
  section.innerHTML = `<div class="decision-lead"><div><strong id="decision-dose-mass">—</strong><span class="lead-label">de produit à préparer</span></div></div>
    <h3>Doses saisies par zone</h3><table class="decision-table"><thead><tr><th>Zone</th><th>Surface</th><th>kg/ha</th></tr></thead><tbody>${features.map(({properties:p}) =>
      `<tr><td>${htmlEscape(p.label)}</td><td>${number.format(p.area_ha)} ha</td><td>${numberInput("Dose " + p.label, "rate-" + p.zone, data["rate-" + p.zone], 0, 1000000, "any", {inline:true})}</td></tr>`).join("")}</tbody></table>
    <h3>Produit et budget</h3><div class="decision-inputs">${numberInput("Dose uniforme (kg/ha)", "usual", data.usual, 0, 1000000)}
    ${numberInput("Poids d’un sac (kg)", "bag", data.bag, .01, 1000)}
    ${numberInput("Engrais (FCFA/kg)", "price", data.price, 0, 100000000)}
    ${numberInput("Grain (FCFA/kg)", "grain", data.grain, .01, 100000000)}</div>
    ${help("Les surfaces proviennent de la carte du champ. Les doses et prix viennent de votre saisie. L’aperçu calcule des quantités et des coûts.")}`;
  body.append(section);
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
    workerCampaignDate(field.campaign.config));
  date.min=field.campaign.config.sowingDate;
  date.max=workerCampaignDate({...field.campaign.config,asOfDate:"9999-12-31"});
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

function workerCampaignDate(config) {
  const start=config?.sowingDate;
  const days=Array.isArray(config?.stages)?config.stages.reduce((sum,stage)=>sum+(Number(stage.days)||0),0):0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start||"") || days < 1) return start || "";
  const end=new Date(Date.parse(start+"T12:00:00Z")+(days-1)*86400000).toISOString().slice(0,10);
  const today=config.asOfDate || new Date().toISOString().slice(0,10);
  return today<start?start:today>end?end:today;
}

function workerFertilizerForm(body,field) {
  body.append(makeNode("h3","section-title","Documenter un apport prévu"));
  const product=workerTextInput(body,"Produit commercial");
  const date=workerTextInput(body,"Date dans le cycle","date",
    workerCampaignDate(field.campaign.config));
  date.min=field.campaign.config.sowingDate;
  date.max=workerCampaignDate({...field.campaign.config,asOfDate:"9999-12-31"});
  const dose=workerNumberInput(body,"Dose de produit (kg/ha)");
  const source=workerTextInput(body,"Source de la dose (conseil ou étiquette)");
  const nitrogen=workerNumberInput(body,"Azote N (%) · facultatif");
  const phosphate=workerNumberInput(body,"Phosphate P₂O₅ (%) · facultatif");
  const potassium=workerNumberInput(body,"Potasse K₂O (%) · facultatif");
  const npkInputs=[nitrogen,phosphate,potassium];
  npkInputs.forEach(input=>{input.max="100";input.placeholder="Inconnu si absent";});
  const compositionSource=workerTextInput(body,"Source de la composition NPK · si renseignée");
  const button=makeNode("button","btn primary","Enregistrer l’apport prévu");
  button.type="button";
  const feedback=makeNode("p","soft-text","Les teneurs inconnues restent non renseignées. L’effet de l’engrais sur le rendement n’est pas calculé.");
  button.addEventListener("click",async()=>{
    const quantity=dose.valueAsNumber;
    const npk=npkInputs.map(input=>input.value===""?null:input.valueAsNumber);
    if (!product.value.trim() || !date.value || !source.value.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      feedback.textContent="Produit, date, dose positive et source requis.";return;
    }
    if (npk.some(value=>value!==null&&(!Number.isFinite(value)||value<0||value>100))) {
      feedback.textContent="Chaque teneur NPK doit être comprise entre 0 et 100 %.";return;
    }
    if (npk.some(value=>value!==null)&&!compositionSource.value.trim()) {
      feedback.textContent="Indiquez l’étiquette ou la source qui confirme les teneurs NPK.";return;
    }
    button.disabled=true; feedback.textContent="Enregistrement et recalcul du Worker…";
    try {
      const id=crypto.randomUUID();
      await saveWorkerConfig(field,config=>{
        const plan=managementFor(config);
        const provenance=npk.some(value=>value!==null)
          ? source.value.trim()+" · composition NPK : "+compositionSource.value.trim()
          : source.value.trim();
        plan.products.push({id,date:date.value,kind:"fertilizer",product:product.value.trim(),
          dose:quantity,unit:"kg/ha",status:"planned",source:provenance,npkPercent:npk});
        config.managementPlan=plan;
      });
      showMessage("Apport prévu enregistré ; aucun gain de rendement n’est présumé.");
    } catch(error) { feedback.textContent=error.message || String(error); button.disabled=false; }
  });
  body.append(button,feedback);
}

function workerRow(label, value) {
  const row = makeNode("div", "data-row");
  row.append(makeNode("span", "key", label), makeNode("b", "", value));
  return row;
}

function renderWorkerSoilProfile(detail, field, config) {
  detail.append(makeNode("h3", "section-title", "Propriétés du sol · source réelle"));
  const geometry = config.parcelGeometry;
  if (!geometry) {
    detail.append(makeNode("p", "soft-text", "Aucun contour n’est enregistré pour interroger le profil spatial."));
    return;
  }
  const geometryKey = JSON.stringify(geometry);
  if (field.soilProfileGeometry !== geometryKey) {
    field.soilProfileData = null;
    field.soilProfileGeometry = geometryKey;
    field.soilProfileMessage = "";
  }
  const button = makeNode("button", "btn",
    field.soilProfileData ? "Actualiser le profil SoilGrids" : "Charger le profil spatial réel");
  button.type = "button";
  button.disabled = field.soilProfileLoading;
  const status = makeNode("p", "soft-text", field.soilProfileMessage ||
    "Interroge l’API AgriPrévision pour cette géométrie; les valeurs restent des estimations cartographiques.");
  button.addEventListener("click", async () => {
    if (field.soilProfileLoading) return;
    field.soilProfileLoading = true;
    field.soilProfileMessage = "Interrogation SoilGrids en cours…";
    renderWorkerCampaign(field);
    try {
      const result = await workerPost({action:"agronomic-soil",geometry});
      if (!fields.includes(field) || field.revision !== field.campaign?.revision ||
          JSON.stringify(field.campaign?.config?.parcelGeometry) !== geometryKey) return;
      if (result?.version !== "spatial-soil-1" || !Array.isArray(result.summary))
        throw new Error("L’API n’a pas fourni de profil spatial dans le format attendu.");
      field.soilProfileData = result;
      field.soilProfileMessage = result.complete === true
        ? "Couverture déclarée complète par l’API; maille cartographique de 250 m, pas mesure de laboratoire."
        : "Couverture partielle renvoyée par l’API; ne pas extrapoler les valeurs manquantes.";
    } catch (error) {
      field.soilProfileData = null;
      field.soilProfileMessage = error.message || String(error);
    } finally {
      field.soilProfileLoading = false;
      if (fields.includes(field)) renderWorkerCampaign(field);
    }
  });
  detail.append(button, status);
  const profile = field.soilProfileData;
  if (!profile || field.soilProfileGeometry !== geometryKey) return;
  const area = value => Number.isFinite(value) ? number.format(value / 10000) + " ha" : "indisponible";
  detail.append(makeNode("small", "worker-index-quality",
    "Couverture spatiale : " + area(profile.coveredM2) + " / " + area(profile.totalM2) +
    " · " + (Array.isArray(profile.samples) ? profile.samples.length : 0) + " profil(s) représentatif(s) · maille native " +
    (Number.isFinite(profile.nativeResolutionM) ? profile.nativeResolutionM : "—") + " m."));
  if (profile.method) detail.append(makeNode("p", "soft-text", profile.method));
  for (const item of profile.summary.filter(row => Number.isFinite(row.value) && row.coveredM2 > 0)) {
    detail.append(workerRow(item.label, number.format(item.value) + (item.unit ? " " + item.unit : "")));
  }
  if (!profile.summary.some(row => Number.isFinite(row.value) && row.coveredM2 > 0))
    detail.append(makeNode("p", "soft-text", "Aucune propriété numérique exploitable renvoyée pour cette parcelle."));
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
  renderWorkerSoilProfile(detail, field, config);
  detail.append(workerRow("Statut du plan", plan.status === "conditional" ? "Conditionnel" :
    plan.status === "blocked" ? "Suspendu" : "Non disponible"));
  detail.append(makeNode("h3", "section-title", "Sols et météo enregistrés"));
  const soil = config.soil || {};
  const layers = Array.isArray(soil.layers) ? soil.layers : [];
  if (soil.source) detail.append(makeNode("p", "soft-text", soil.source));
  if (layers.length) {
    let depthCm = 0;
    for (const layer of layers) {
      const top = depthCm;
      depthCm += Number.isFinite(layer.thicknessM) ? layer.thicknessM * 100 : 0;
      const available = Number.isFinite(layer.thicknessM) && Number.isFinite(layer.thetaFC) &&
        Number.isFinite(layer.thetaWP) && layer.thetaFC > layer.thetaWP
        ? number.format(1000 * layer.thicknessM * (layer.thetaFC - layer.thetaWP)) + " mm d’eau disponible"
        : "Rétention indisponible";
      detail.append(workerRow(Math.round(top) + "–" + Math.round(depthCm) + " cm",
        available + " · capacité au champ " +
        (Number.isFinite(layer.thetaFC) ? number.format(layer.thetaFC * 100) + " %" : "inconnue") +
        " · flétrissement " + (Number.isFinite(layer.thetaWP) ? number.format(layer.thetaWP * 100) + " %" : "inconnu")));
      detail.append(workerRow("Humidité initiale · " + Math.round(depthCm) + " cm",
        Number.isFinite(layer.initialTheta) ? number.format(layer.initialTheta * 100) + " % volumique" : "Inconnue; aucune valeur inventée"));
    }
  } else detail.append(makeNode("p", "soft-text", "Aucun profil hydraulique enregistré dans cette campagne."));
  const weather = Array.isArray(config.weather) ? config.weather : [];
  if (weather.length) {
    const observed = weather.filter(item => item.status === "observed").length;
    const forecast = weather.filter(item => item.status === "forecast").length;
    detail.append(workerRow("Série météo enregistrée",
      observed + " jour(s) observés · " + forecast + " jour(s) prévus · " + weather.length + " au total"));
  } else detail.append(makeNode("p", "soft-text", "Aucune série météo observée ou prévue n’est enregistrée."));
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
element("worker-login").addEventListener("click", () => startWorkerLogin());
element("worker-login-close").addEventListener("click", closeWorkerLogin);
element("worker-refresh").addEventListener("click", refreshWorkerFields);
element("worker-space").addEventListener("change",event=>void switchWorkerSpace(event.currentTarget.value));
element("worker-logout").addEventListener("click",logoutWorkerAccess);
element("worker-satellite-load").addEventListener("click", () => {
  const field = currentField();
  if (!field?.geometry) return;
  satellitePermissions.set(field.id, JSON.stringify(field.geometry));
  void loadWorkerSatellite(field);
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
      const layer = element("layer-" + letter).value;
      void loadWorkerImage(field, date, layer, side);
    });
  }
}
