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
    list.append(makeNode("li", "empty-list", "Aucun champ trouvé."));
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
    const index = observedIndex(field, state.day);
    const value = makeNode("span", "field-number", index === null ? "—" : indexNumber.format(index));
    value.title = "NDVI moyen · " + dateLabel(state.day);
    button.append(thumb, info, value);
    button.addEventListener("click", () => selectField(field.id));
    li.append(button);
    list.append(li);
    paintThumb(thumb, field);
    if (restoreFocus === field.id) button.focus({ preventScroll: true });
  }
}

function selectField(id) {
  if (state.draft) {
    showMessage("Terminez le contour en cours ou annulez le tracé.");
    return;
  }
  const previous = state.view === "decisions" ? decisionContext() : null;
  state.fieldId = id;
  state.noteId = null;
  decisionState.point = -1;
  decisionState.doseZone = -1;
  if (!currentField().remote && previous?.topic.id === "harvest") Object.assign(chooseDraft(currentField(),"harvest"),copyScenario(previous.data));
  if (!currentField().remote && previous?.topic.id === "water" && previous.data.mode === "pump") {
    const next = chooseDraft(currentField(),"water");
    for (const key of ["mode","flow","hours","reserved","slot","order","minutes"]) {
      next[key] = typeof previous.data[key] === "object" ? copyScenario(previous.data[key]) : previous.data[key];
    }
  }
  recenter();
  update();
}

function setView(view) {
  if (state.draft) {
    showMessage("Terminez le contour en cours ou annulez le tracé.");
    return;
  }
  if (state.view === view) return;
  const hadSplit = hasSplitMap();
  state.view = view;
  if (view === "decisions" && state.expanded) element("expand").click();
  if (hadSplit !== hasSplitMap()) recenter();
  update();
}

function setDay(day, keepFocusOnClick = false) {
  if (!currentField().ndvi) return;
  const next = clamp(day, 0, DAYS.length - 1);
  if (next === state.day) return;
  state.day = next;
  update();
  if (keepFocusOnClick) {
    element("days").querySelector('[data-day="' + next + '"]').focus({ preventScroll: true });
  }
}

function configureDates() {
  const dayStrip = element("days");
  DAYS.forEach((_, i) => {
    const button = makeNode("button", "day");
    button.type = "button";
    button.dataset.day = String(i);
    const dot = makeNode("span", "acquisition");
    dot.setAttribute("aria-hidden", "true");
    button.append(dot, makeNode("span", "", dateLabel(i)));
    button.addEventListener("click", () => setDay(i));
    dayStrip.append(button);
  });
  dayStrip.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    setDay(state.day + (event.key === "ArrowRight" ? 1 : -1), true);
  });

  ["a", "b"].forEach((letter, side) => {
    const dateSelect = element("date-" + letter);
    const layerSelect = element("layer-" + letter);
    DAYS.forEach((_, i) => dateSelect.add(new Option(dateLabel(i, true), i)));
    for (const layer of ["satellite", "ndvi", "contrast", "evi", "zones"]) {
      layerSelect.add(new Option(LAYERS[layer], layer));
    }
    dateSelect.addEventListener("change", () => {
      if (currentField().remote) return;
      state.comparisonDays[side] = Number(dateSelect.value);
      update();
    });
    layerSelect.addEventListener("change", () => {
      if (currentField().remote) return;
      state.comparisonLayers[side] = layerSelect.value;
      update();
    });
  });
}

function updateReading(field) {
  if (typeof renderWorkerIndices === "function") renderWorkerIndices(field);
  const value = observedIndex(field, state.day, state.layer);
  element("no-reading").hidden = field.remote || value !== null;
  element("reading").hidden = value === null;
  if (value !== null) {
    putText("reading-label", state.layer === "evi" ? "EVI moyen" : "NDVI moyen");
    putText("reading-date", dateLabel(state.day, true));
    putText("reading-value", indexNumber.format(value));
    const variation = element("reading-variation");
    variation.replaceChildren();
    if (state.day > 0) {
      const previous = observedIndex(field, state.day - 1, state.layer);
      variation.append(document.createTextNode(signedIndex.format(value - previous)),
        makeNode("small", "", "depuis le " + dateLabel(state.day - 1)));
    }
  }
  putText("rain-value", field.rain === undefined ? "—" : number.format(field.rain) + " mm");
  const count = field.remote ? field.campaign?.events?.length || 0 : notes.filter((note) => note.fieldId === field.id).length;
  putText("notes-link", count ? count + (count === 1 ? " observation" : " observations") : "Ouvrir le carnet");
}

function updateComparison(field) {
  if (field.remote) { updateWorkerComparison(field); return; }
  element("comparison-reading").hidden = !field.ndvi;
  if (!field.ndvi) {
    putText("comparison-message", "Aucune image à comparer pour ce champ.");
    return;
  }
  ["a", "b"].forEach((letter, i) => {
    const day = state.comparisonDays[i];
    const layer = state.comparisonLayers[i];
    element("date-" + letter).value = day;
    element("layer-" + letter).value = layer;
    putText("summary-date-" + letter, dateLabel(day, true));
    const indexed = sameIndex(layer) || layer === "evi";
    putText("summary-value-" + letter, indexed
      ? indexNumber.format(observedIndex(field, day, layer))
      : LAYERS[layer]);
  });
  const sameNdvi = state.comparisonLayers.every(sameIndex);
  element("delta").parentElement.parentElement.hidden = !sameNdvi;
  if (sameNdvi) {
    const [dayA, dayB] = state.comparisonDays;
    putText("delta", signedIndex.format(observedIndex(field, dayB) - observedIndex(field, dayA)));
  }
  putText("comparison-message", sameNdvi ? "" : "Choisissez le NDVI des deux côtés pour afficher l’écart.");
}

function updateZones(field) {
  const isDose = state.zoneLayer === "dose";
  putText("zones-heading", isDose ? "Carte de doses" : "Productivité historique");
  if (field.remote) { updateWorkerZones(field, isDose); return; }
  putText("zones-description", !field.ndvi ? "Aucune zone disponible pour ce champ." : isDose ? "Exemple de répartition · kg/ha" : "Trois zones · campagnes 2023 à 2025");
  const list = element("zone-list");
  list.replaceChildren();
  if (!field.ndvi) return;
  spatialData(field).areas.forEach((area, i) => {
    const row = makeNode("div", "zone-row");
    const label = makeNode("span");
    const swatch = makeNode("i", "zone-color");
    swatch.style.backgroundColor = ZONE_COLORS[i];
    label.append(swatch, document.createTextNode(isDose ? DOSES[i] + " kg/ha" : NAMES[i]));
    row.append(label, makeNode("b", "", number.format(area) + " ha"));
    list.append(row);
  });
}

function updateNotes(field) {
  if (field.remote) { renderWorkerEvents(field); return; }
  const list = element("notes");
  const fieldNotes = notes.filter((note) => note.fieldId === field.id);
  const restoreFocus = document.activeElement?.dataset.note;
  const selected = fieldNotes.find((note) => state.noteId === note.id);
  list.replaceChildren();
  if (!fieldNotes.length) list.append(makeNode("p", "soft-text", "Aucune observation pour ce champ."));
  for (const note of fieldNotes.slice().reverse()) {
    const button = makeNode("button", "note-row");
    button.type = "button";
    button.dataset.note = note.id;
    button.setAttribute("aria-pressed", String(state.noteId === note.id));
    const detail = makeNode("span");
    detail.append(makeNode("b", "", note.title), makeNode("small", "", note.label));
    button.append(makeIcon("pin", true), detail);
    button.addEventListener("click", () => {
      state.noteId = note.id;
      state.camera.x = note.point[0];
      state.camera.y = note.point[1];
      updateNotes(field);
      paintIcons();
      scheduleDraw();
    });
    list.append(button);
    if (restoreFocus === note.id) button.focus({ preventScroll: true });
  }
  element("note-body").hidden = !selected?.body;
  putText("note-body", selected?.body || "");
}

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
  const title = zone ? (layer === "dose" ? "Doses d’exemple" : "Productivité") : "Vigueur";
  legend.querySelector(".legend-head span").textContent = side + title;
  legend.querySelector(".legend-index").textContent = zone ? (layer === "dose" ? "kg/ha" : "Historique") : layer === "evi" ? "EVI" : "NDVI";
  legend.querySelector(".ramp").style.background = "";
  legend.querySelector(".ramp").className = "ramp" + (zone ? " zonal" : relative ? " relative" : "");
  let ticks = ["0,25", "0,50", "0,75"];
  if (layer === "dose") ticks = DOSES.map(String);
  else if (zone || relative) ticks = NAMES;
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
    legend.hidden = true;
    return;
  }
  if (!comparing) {
    fillLegend(legend, activeLayer(field));
    return;
  }
  const [a, b] = state.comparisonLayers;
  const sameLegend = a === b;
  fillLegend(legend, a, sameLegend ? "" : "A · ");
  if (!sameLegend) fillLegend(legendB, b, "B · ");
}

function updateDrawbar() {
  const count = state.draft?.shape.length || 0;
  element("drawbar").hidden = !state.draft;
  element("undo-point").disabled = count === 0;
  element("save-draw").disabled = count < 3;
  putText("draw-instruction", count ? count + (count === 1 ? " point posé" : " points posés") : "Cliquez sur la carte pour tracer le contour.");
  mapCanvases[0].classList.toggle("drawing", !!state.draft);
}

function update() {
  const field = currentField();
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
  element("data-status").textContent = field.remote ? "Données du Worker" : "Démonstration";
  element("data-status").title = field.remote ? "Campagne enregistrée sur le Worker" : "Cartes et données fictives";
  putText("map-attribution", field.remote ? (field.remoteImages?.has(field.imageDate + ":" + field.imageLayer) ?
    "Sentinel-2 L2A · Digital Earth Africa · " + field.imageDate : "Contour de la campagne · image non chargée") :
    "Fond aérien illustratif");
  element("worker-satellite").hidden = !field.remote || !field.geometryAvailable;
  if (typeof updateSatelliteControls === "function") updateSatelliteControls(field);
  element("add-field").title = field.remote ? "Nouvelle campagne sur le Worker" : "Ajouter un champ de démonstration";
  element("worker-edit").hidden = !field.remote;
  element("worker-edit").disabled = !!field.remote && !field.campaign;
  element("add-note").disabled = !!field.remote && !field.campaign;
  if (state.view !== "decisions") updateFieldList();
  if (state.view === "fields") updateReading(field);
  if (state.view === "compare") updateComparison(field);
  if (state.view === "zones") updateZones(field);
  if (state.view === "notes") updateNotes(field);
  if (state.view === "campaign") updateCampaign(field);

  element("map-panes").classList.toggle("split", split);
  element("second-map").hidden = !split;
  element("pane-a").hidden = element("pane-b").hidden = !comparing;
  element("map-tools").hidden = comparing || !!state.draft || (!field.ndvi && !field.remote) ||
    (state.view !== "fields" && state.view !== "zones");
  element("layers").hidden = state.view !== "fields" || field.remote;
  element("zone-layers").hidden = state.view !== "zones";
  document.querySelectorAll("[data-layer]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.layer === state.layer))
  );
  document.querySelectorAll("[data-zone-layer]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.zoneLayer === state.zoneLayer))
  );
  element("timebar").hidden = state.view !== "fields" || !field.ndvi || !!state.draft;
  element("compare-dock").hidden = !comparing;
  element("previous-date").disabled = state.day === 0;
  element("next-date").disabled = state.day === DAYS.length - 1;
  element("days").querySelectorAll("[data-day]").forEach((button) => {
    const i = Number(button.dataset.day);
    button.setAttribute("aria-pressed", String(i === state.day));
    button.title = "Image du " + dateLabel(i, true);
  });

  updateZoom();
  updateLegend(field, comparing);
  updateDecisionLayout();
  if (state.view === "decisions") renderDecision(field);
  updateDrawbar();
  paintIcons();
  scheduleDraw();
}

function showMessage(message) {
  putText("toast", message);
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => putText("toast", ""), 2900);
}

function openNote(point = null) {
  const field = currentField();
  state.notePoint = point || field.notePoint || spatialData(field).center;
  element("note-form").reset();
  putText("note-location", field.name);
  element("note-dialog").showModal();
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}

function polygonArea(shape) {
  return Math.abs(shape.reduce((sum, [x, y], i) => {
    const [nextX, nextY] = shape[(i + 1) % shape.length];
    return sum + x * nextY - y * nextX;
  }, 0)) / 2;
}

function finishDraw(save) {
  const draft = state.draft;
  if (!draft) return;
  if (save) {
    if (draft.shape.length < 3 || polygonArea(draft.shape) < 100) {
      showMessage("Posez au moins trois points formant une surface.");
      return;
    }
    fields.push(draft);
    state.fieldId = draft.id;
    state.noteId = null;
    element("field-search").value = "";
    showMessage(persist() ? "Champ ajouté à votre maquette." : "Champ ajouté pour cette session.");
  }
  state.draft = null;
  recenter();
  update();
}

document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => setView(button.dataset.view))
);
document.querySelectorAll("[data-layer]").forEach((button) => {
  button.addEventListener("click", () => {
    state.layer = button.dataset.layer;
    update();
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
element("previous-date").addEventListener("click", () => setDay(state.day - 1));
element("next-date").addEventListener("click", () => setDay(state.day + 1));
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

element("add-field").addEventListener("click", () => {
  if (currentField().remote) { openWorkerEditor(); return; }
  if (state.draft) {
    showMessage("Terminez le contour en cours ou annulez le tracé.");
    return;
  }
  element("field-form").reset();
  element("field-dialog").showModal();
});
element("field-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get("name")).trim();
  if (!name) {
    event.currentTarget.elements.name.focus();
    return;
  }
  state.view = "fields";
  state.draft = { id: newId(), name, crop: data.get("crop"), area: Number(data.get("area")), shape: [] };
  element("field-dialog").close();
  update();
  mapCanvases[0].focus();
});
element("undo-point").addEventListener("click", () => {
  state.draft.shape.pop();
  updateDrawbar();
  scheduleDraw();
});
element("cancel-draw").addEventListener("click", () => finishDraw(false));
element("save-draw").addEventListener("click", () => finishDraw(true));

element("add-note").addEventListener("click", () => currentField().remote ? openWorkerEvent(currentField()) : openNote());
element("note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const title = String(data.get("title")).trim();
  if (!title) {
    event.currentTarget.elements.title.focus();
    return;
  }
  const note = {
    id: newId(), fieldId: state.fieldId, point: state.notePoint, title,
    body: String(data.get("body")).trim(), label: "Note locale"
  };
  notes.push(note);
  state.noteId = note.id;
  state.notePoint = null;
  element("note-dialog").close();
  showMessage(persist() ? "Observation enregistrée." : "Observation ajoutée pour cette session.");
  update();
});
