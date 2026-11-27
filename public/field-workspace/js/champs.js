const legendB = element("legend").cloneNode(true);
legendB.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id"));
legendB.id = "legend-b";
legendB.hidden = true;
element("legend").after(legendB);

function updateFieldList() {
  const list = element("field-list");
  const restoreFocus = document.activeElement?.dataset.field;
  const search = element("field-search").value.trim().toLocaleLowerCase("fr");
  const found = fields.filter((field) =>
    (field.name + " " + field.crop).toLocaleLowerCase("fr").includes(search)
  );
  putText("field-count", fields.length + (fields.length === 1 ? " parcelle" : " parcelles") +
    " · " + number.format(fields.reduce((sum, field) => sum + (Number.isFinite(field.area) ? field.area : 0), 0)) + " ha");
  list.replaceChildren();
  if (!found.length) {
    const emptyMessage = fields.length
      ? "Aucun champ ne correspond à cette recherche."
      : workerSessionReady ? "Aucune campagne enregistrée dans cet espace."
        : workerBusy ? "Vérification de la session auprès du Worker…"
          : "Connectez-vous pour afficher les campagnes de votre espace.";
    list.append(makeNode("li", "empty-list", emptyMessage));
    return;
  }
  for (const field of found) {
    const li = makeNode("li");
    const button = makeNode("button", "field");
    button.type = "button";
    button.dataset.field = field.id;
    button.setAttribute("aria-pressed", String(state.fieldId === field.id));
    const thumb = makeNode("canvas", "field-thumb");
    thumb.width = 88;
    thumb.height = 76;
    thumb.setAttribute("aria-hidden", "true");
    const info = makeNode("span", "field-info");
    info.append(makeNode("span", "field-name", field.name), makeNode("span", "field-meta",
      field.crop + " · " + (Number.isFinite(field.area) ? number.format(field.area) + " ha" : "Surface indisponible")));
    const index = observedIndex(field);
    const value = makeNode("span", "field-number", index === null ? "—" : indexNumber.format(index));
    const latest = field.remote ? field.indexSeries?.observations?.filter(item => item.quality === "usable" && Number.isFinite(item.ndviMedian)).sort((a, b) => a.date.localeCompare(b.date)).at(-1) : null;
    value.title = latest ? "NDVI médian Sentinel‑2 · " + latest.date : "NDVI indisponible";
    button.append(thumb, info, value);
    button.addEventListener("click", () => selectField(field.id));
    li.append(button);
    list.append(li);
    paintThumb(thumb, field);
    if (restoreFocus === field.id) button.focus({ preventScroll: true });
  }
}

function selectField(id) {
  const field = fields.find(item => item.id === id);
  if (!field) return;
  state.fieldId = id;
  state.noteId = null;
  recenter();
  update();
  void openWorkerCampaign(field);
}

function setView(view) {
  if (state.view === view || !currentField()) return;
  const hadSplit = hasSplitMap();
  state.view = view;
  if (view === "decisions" && state.expanded) element("expand").click();
  if (hadSplit !== hasSplitMap()) recenter();
  update();
  if (view === "compare") void loadCompareImages(currentField());
  if (view === "zones") void loadWorkerZoneMap(currentField());
}

const imageDay = new Intl.DateTimeFormat("fr-FR", {day: "numeric", month: "short", timeZone: "UTC"});

function selectTimelineDay(step) {
  const field = currentField();
  const dates = field?.imageDates || [];
  const date = dates[clamp(dates.indexOf(field?.imageDate) + step, 0, dates.length - 1)];
  if (date && date !== field.imageDate) {
    field.automaticImage = null;
    void loadWorkerImage(field, date, field.imageLayer);
  }
}

function renderTimeline(field) {
  const dates = field.imageDates || [];
  const days = element("days");
  if ([...days.children].map(button => button.dataset.date).join() !== dates.join()) {
    days.replaceChildren(...dates.map(date => {
      const button = makeNode("button", "day");
      button.type = "button";
      button.dataset.date = date;
      button.title = "Image du " + date;
      button.append(makeNode("span", "acquisition"), makeNode("span", "", imageDay.format(new Date(date))));
      button.addEventListener("click", () => {
        const current = currentField();
        if (current) { current.automaticImage = null; void loadWorkerImage(current, date, current.imageLayer); }
      });
      return button;
    }));
  }
  const selected = dates.indexOf(field.imageDate);
  [...days.children].forEach((button, index) => button.setAttribute("aria-pressed", String(index === selected)));
  element("previous-date").disabled = selected <= 0;
  element("next-date").disabled = selected >= dates.length - 1;
  element("timebar").hidden = state.view !== "fields" || !dates.length;
  putText("time-year", field.imageDate ? " · " + field.imageDate.slice(0, 4) : "");
}

element("days").addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  selectTimelineDay(event.key === "ArrowRight" ? 1 : -1);
  element("days").querySelector('[aria-pressed="true"]')?.focus();
});

function observationsFor(field, layer = field.imageLayer) {
  const property = layer === "evi" ? "eviMedian" : "ndviMedian";
  return (field.indexSeries?.observations || []).filter(row => row.quality === "usable" && Number.isFinite(row[property]))
    .map(row => ({...row, value: row[property]})).sort((a, b) => a.date.localeCompare(b.date));
}

function updateReading(field) {
  renderWorkerIndices(field);
  const observations = observationsFor(field);
  const row = field.imageLayer === "satellite" ? observations.at(-1) : observations.find(item => item.date === field.imageDate);
  element("no-reading").hidden = !!row;
  element("reading").hidden = !row;
  const plot = observations.length > 1;
  element("trend").hidden = !plot;
  element("trend").nextElementSibling.hidden = !plot;
  if (row) {
    putText("reading-label", (field.imageLayer === "evi" ? "EVI" : "NDVI") + " médian");
    putText("reading-date", row.date);
    putText("reading-value", indexNumber.format(row.value));
    putText("reading-variation", number.format(row.clearFraction * 100) + " % clairs");
    putText("trend-start", imageDay.format(new Date(observations[0].date)));
    putText("trend-end", imageDay.format(new Date(observations.at(-1).date)));
  } else putText("no-reading", "Aucun indice exploitable pour cette vue.");
  putText("rain-value", field.rain === undefined ? "—" : number.format(field.rain) + " mm");
  const count = fieldNotesFor(field).length + (field.campaign?.events?.length || 0);
  putText("notes-link", count ? count + (count === 1 ? " observation" : " observations") : "Ouvrir le carnet");
}

function updateNotes(field) { renderWorkerEvents(field); }

function updateCampaign(field) {
  putText("campaign-crop", field.crop);
  putText("campaign-sowing", field.sowing || "À renseigner");
  putText("campaign-rain", field.rain === undefined ? "—" : number.format(field.rain) + " mm");
  putText("campaign-action", field.action || "Compléter les observations");
  putText("campaign-action-detail", field.actionDetail || "Les notes de terrain restent disponibles dans le carnet.");
  const report = field.campaign?.plan?.yieldEstimation;
  const recorded = report?.scenarios?.find(item => item.id === "recorded");
  putText("campaign-yield", field.remote && report?.status === "conditional" &&
    recorded?.status === "conditional" && Number.isFinite(recorded.totals?.yieldKgHaSown)
    ? number.format(recorded.totals.yieldKgHaSown / 1000) + " t/ha" : "Pas simulé");
  if (field.remote) renderWorkerCampaign(field);
  else element("worker-campaign-detail").hidden = true;
}

function fillLegend(legend, layer, side = "") {
  legend.hidden = layer === "satellite";
  if (legend.hidden) return;
  const zone = layer === "zones" || layer === "dose";
  const relative = layer === "contrast";
  const title = zone ? (layer === "dose" ? "Doses déclarées" : "Productivité") : "Vigueur";
  legend.querySelector(".legend-head span").textContent = side + title;
  legend.querySelector(".legend-index").textContent = zone ? (layer === "dose" ? "kg/ha" : "Historique") : layer === "evi" ? "EVI" : "NDVI";
  legend.querySelector(".ramp").style.background = "";
  legend.querySelector(".ramp").className = "ramp" + (zone ? " zonal" : relative ? " relative" : "");
  let ticks = ["0,25", "0,50", "0,75"];
  if (zone || relative) ticks = NAMES;
  legend.querySelectorAll(".legend-labels span").forEach((span, i) => { span.textContent = ticks[i]; });
}

function updateLegend(field, comparing) {
  const legend = element("legend");
  legendB.hidden = true;
  if (field.remote) {
    const zoneMap=field.zoneMapData?.revision===field.revision?field.zoneMapData:null;
    if (state.view === "zones" && zoneMap) {
      const isDose=state.zoneLayer==="dose";
      const features=isDose?zoneMap.dose?.features:zoneMap.historical?.features;
      if (!features?.length) { legend.hidden=true; return; }
      fillLegend(legend,isDose?"dose":"zones");
      legend.querySelector(".legend-head span").textContent=isDose?"Doses déclarées":"Vigueur relative";
      if (isDose) {
        const rates=features.map(f=>f.properties?.dose).filter(Number.isFinite);
        const min=Math.min(...rates), max=Math.max(...rates);
        legend.querySelector(".legend-index").textContent=features[0].properties?.unit||"Dose";
        legend.querySelector(".ramp").style.background="linear-gradient(90deg,"+palette(0)+","+palette(.5)+","+palette(1)+")";
        [min,(min+max)/2,max].forEach((value,i)=>legend.querySelectorAll(".legend-labels span")[i].textContent=number.format(value));
      } else {
        legend.querySelector(".ramp").style.background="linear-gradient(90deg,#90b8df,#497da9,#173d63)";
        ["Faible","Moyenne","Forte"].forEach((value,i)=>legend.querySelectorAll(".legend-labels span")[i].textContent=value);
      }
      return;
    }
  }
  if (!comparing) {
    fillLegend(legend, activeLayer(field));
    return;
  }
  const [a, b] = field.compareLayers || ["satellite", "satellite"];
  const sameLegend = a === b;
  fillLegend(legend, a, sameLegend ? "" : "A · ");
  if (!sameLegend) fillLegend(legendB, b, "B · ");
}

function update() {
  const field = currentField();
  window.agriReturnContext={view:state.view,campaignId:field?.id||null};
  if (!field) {
    element("map-empty-state").hidden = false;
    document.title = "AgriPrévision · Mes champs";
    document.querySelectorAll(".nav [data-view]").forEach(button => {
      if (button.dataset.view === "fields") button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
      button.disabled = button.dataset.view !== "fields";
    });
    document.querySelectorAll(".detail-body").forEach(panel => { panel.hidden = true; });
    putText("field-title", workerSessionReady ? "Aucune campagne enregistrée" : workerBusy ? "Vérification du compte" : "Campagnes masquées");
    const activeSpace=workerSession?.cooperatives?.find(space=>space.coopId===workerSession.coopId);
    putText("field-meta", workerSessionReady
      ? "Compte connecté · aucune campagne enregistrée dans " + (activeSpace?.name||"l’espace actif")
      : workerBusy ? "Le Worker vérifie la session et l’espace actif."
        : "Connectez-vous pour lire les campagnes enregistrées.");
    putText("data-status", workerSessionReady ? "Compte connecté" : workerBusy ? "Vérification…" : "Connexion requise");
    putText("active-context", workerSession ? workerSession.name + " · " + (activeSpace?.name||workerSession.coopId) : "");
    element("active-context").hidden=!workerSession;
    putText("map-empty-title", workerSessionReady ? "Compte connecté · aucune campagne enregistrée" : workerBusy ? "Vérification du compte…" : "Connexion requise");
    putText("map-empty-copy", workerSessionReady
      ? (activeSpace?.name||"Espace actif") + " · Recherchez la localité réelle avant de tracer; aucun champ n’est présélectionné."
      : workerBusy ? "Le Worker vérifie la session avant d’afficher les données de cet espace."
        : "Connectez-vous pour afficher les données réelles de votre espace.");
    element("map-empty-login").hidden=workerSessionReady;
    element("worker-new").disabled=!workerSessionReady;
    element("data-status").title = "Les campagnes et cartes proviennent de l’API AgriPrévision.";
    putText("map-attribution", workerSessionReady ? "Image satellite réelle via Esri World Imagery · aucune parcelle sélectionnée" : "Aucune donnée de campagne affichée");
    element("worker-satellite").hidden = true;
    element("worker-indices").hidden = true;
    element("worker-campaign-detail").hidden = true;
    element("worker-edit").hidden = true;
    element("add-note").hidden = true;
    element("add-note").disabled = true;
    element("add-field").title = "Créer une campagne dans votre compte AgriPrévision";
    element("map-tools").hidden = true;
    element("map-actions").hidden = true;
    element("map-end").hidden = true;
    element("timebar").hidden = true;
    element("compare-dock").hidden = true;
    element("pane-a").hidden = element("pane-b").hidden = true;
    element("decision-sidebar").hidden = true;
    element("primary-sidebar").hidden = false;
    element("map-panes").classList.remove("split");
    element("second-map").hidden = true;
    updateFieldList();
    const chart = element("trend");
    chart.getContext("2d").clearRect(0, 0, chart.width, chart.height);
    updateZoom();
    if(typeof mountWorkerEmptyPicker==="function")mountWorkerEmptyPicker();
    paintIcons();
    scheduleDraw();
    return;
  }
  element("map-empty-state").hidden = true;
  document.querySelectorAll(".nav [data-view]").forEach(button => { button.disabled = false; });
  const comparing = isComparing();
  const split = hasSplitMap();
  document.title = "AgriPrévision · " + (state.view === "fields" ? field.name : { compare: "Comparer", zones: "Zones", notes: "Carnet", campaign: "Campagne", decisions: "Décider" }[state.view]);
  document.querySelectorAll(".nav [data-view]").forEach((button) => {
    if (button.dataset.view === state.view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll(".detail-body").forEach((panel) => {
    panel.hidden = panel.id !== "view-" + state.view;
  });
  putText("field-title", field.name);
  putText("field-meta", field.crop + " · " + (Number.isFinite(field.area) ? number.format(field.area) + " ha" : "Surface indisponible") +
    (field.sowing ? " · Semis " + field.sowing.replace(" 2026", "") : ""));
  element("data-status").textContent = field.remote ? "API AgriPrévision" : "Données non connectées";
  element("data-status").title = field.remote ? "Campagne enregistrée sur l’API AgriPrévision" : "Aucune donnée API";
  const source = field.remoteImages?.has(field.imageDate + ":rgb") ? "Sentinel‑2 · Digital Earth Africa" :
    field.basemap ? "Fond photographique · Esri World Imagery" : "Image indisponible";
  putText("map-attribution", source);
  element("worker-satellite").hidden = !field.remote || !field.geometryAvailable;
  if (typeof updateSatelliteControls === "function") updateSatelliteControls(field);
  element("add-field").title = "Nouvelle campagne dans l’API AgriPrévision";
  element("worker-edit").hidden = !field.remote;
  element("worker-edit").disabled = !!field.remote && !field.campaign;
  element("add-note").hidden = false;
  element("add-note").disabled = !field.campaign;
  if (state.view !== "decisions") updateFieldList();
  if (state.view === "fields") updateReading(field);
  if (state.view === "compare") updateWorkerComparison(field);
  if (state.view === "zones") updateWorkerZones(field, state.zoneLayer === "dose");
  if (state.view === "notes") updateNotes(field);
  if (state.view === "campaign") updateCampaign(field);

  element("map-panes").classList.toggle("split", split);
  element("second-map").hidden = !split;
  element("pane-a").hidden = element("pane-b").hidden = !comparing;
  element("map-tools").hidden = state.view !== "fields" && state.view !== "zones";
  element("layers").hidden = state.view !== "fields" || !field.imageDates?.length;
  element("zone-layers").hidden = state.view !== "zones";
  document.querySelectorAll("[data-layer]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.layer === field.imageLayer))
  );
  document.querySelectorAll("[data-zone-layer]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.zoneLayer === state.zoneLayer))
  );
  renderTimeline(field);
  element("compare-dock").hidden = !comparing;

  updateZoom();
  updateLegend(field, comparing);
  updateDecisionLayout();
  if (state.view === "decisions") renderDecision(field);
  paintIcons();
  scheduleDraw();
}

function showMessage(message) {
  putText("toast", message);
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => putText("toast", ""), 2900);
}

document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => setView(button.dataset.view))
);
document.querySelectorAll("[data-layer]").forEach((button) => {
  button.addEventListener("click", () => {
    const field = currentField();
    if (field) { field.automaticImage = null; void loadWorkerImage(field, field.imageDate, button.dataset.layer); }
  });
});
document.querySelectorAll("[data-zone-layer]").forEach((button) => {
  button.addEventListener("click", () => {
    state.zoneLayer = button.dataset.zoneLayer;
    update();
  });
});
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => element(button.dataset.close).close());
});
element("field-search").addEventListener("input", updateFieldList);
element("previous-date").addEventListener("click", () => selectTimelineDay(-1));
element("next-date").addEventListener("click", () => selectTimelineDay(1));
element("zoom-in").addEventListener("click", () => zoomBy(1.23));
element("zoom-out").addEventListener("click", () => zoomBy(1 / 1.23));
element("recenter").addEventListener("click", () => {
  recenter();
  updateZoom();
  scheduleDraw();
});
element("expand").addEventListener("click", () => {
  state.expanded = !state.expanded;
  element("workspace").classList.toggle("is-wide", state.expanded);
  const button = element("expand");
  const label = state.expanded ? "Afficher le panneau des champs" : "Agrandir la carte";
  button.setAttribute("aria-pressed", String(state.expanded));
  button.setAttribute("aria-label", label);
  button.title = label;
  button.firstElementChild.dataset.icon = state.expanded ? "contract" : "expand";
  paintIcons();
  scheduleDraw();
});

element("add-field").addEventListener("click", () => openWorkerEditor());

element("add-note").addEventListener("click", () => {
  const field = currentField();
  if (field?.campaign) openFieldNote(field);
});

element("add-water-event").addEventListener("click", () => openWorkerEvent(currentField()));
