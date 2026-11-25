function statLine(title, value) {
  return `<div class="stat"><dt>${htmlEscape(title)}</dt><dd>${htmlEscape(value)}</dd></div>`;
}

function stage(title, info, stats, content = "") {
  return `<section class="decision-map-summary glass" aria-label="${htmlEscape(title)}">
    <header><h3>${htmlEscape(title)}</h3>${info ? `<span>${htmlEscape(info)}</span>` : ""}</header>
    ${stats.length ? '<dl class="stage-stats">' + stats.map(([label,value]) => statLine(label,value)).join("") + "</dl>" : ""}
    ${content}
  </section>`;
}

function taskResult(action, summary, rows, map = "") {
  return { action, summary, rows, map, ok: true };
}

function taskBlocked(message, map = "") {
  return { action: "Voir l’aperçu", summary: "", rows: [], map, ok: false, message };
}

function sowingOutcome({ profile, data, field }) {
  if (!profile) return taskBlocked("Données de semis à compléter.");
  const earlier = addDays(profile.sowing, -3);
  const start = addDays(earlier, -3);
  const bars = profile.rain.map((amount, i) => {
    const day = addDays(start, i);
    const flags = ["rain-day", i >= 3 ? "forecast" : "", i === 3 ? "from-forecast" : "", day === data.slot ? "active" : ""].join(" ");
    return `<div class="${flags}"><span>${amount} mm</span><div class="rain-bar" aria-hidden="true"><i style="height:${amount / 18 * 100}%"></i></div>
      <span>${htmlEscape(readDate(day))}</span></div>`;
  }).join("");
  const stripe = '<div class="rain-readings"><span>Pluie observée</span><span>Pluie prévue à la date d’étude</span></div><div class="rain-days">' + bars + "</div>";
  const map = stage("Pluie autour du semis", "Série d’exemple", [], stripe);
  if (data.slot !== earlier && data.slot !== profile.sowing) return taskBlocked("Choisir un des deux créneaux.", map);
  return taskResult("Préparer cette date", readDate(data.slot, true), [
    ["Semis envisagé", readDate(data.slot, true)], ["Semis déclaré", field.sowing],
    ["À vérifier", "Humidité du lit de semences"]
  ], map);
}

function varietyOutcome({ profile, data, field }) {
  if (!profile) return taskBlocked("Durées des cycles à compléter.");
  const windows = cycleWindows(field, profile);
  const picked = windows[Number(data.cycle)];
  if (!picked) return taskBlocked("Choisir un cycle.");
  const daysRain = (Date.parse(profile.endRain) - Date.parse(plannedSowing(field,profile))) / 86400000;
  const left = 67, right = 134;
  const percent = days => clamp((days - left) / (right - left) * 100, 0, 100);
  const rows = windows.map((cycle,i) => `<div class="variety-line ${cycle === picked ? "selected" : ""}">
    <strong>${htmlEscape(cycle.label)}</strong><div class="beam" title="${readDate(cycle.from)} au ${readDate(cycle.to)}">
    <i style="left:${percent(cycle.start)}%; width:${percent(cycle.end)-percent(cycle.start)}%"></i>
    <span class="rain-edge" style="left:${percent(daysRain)}%"></span></div></div>`).join("");
  const statement = picked.to <= profile.endRain
    ? "La plage de maturité précède la fin des pluies d’exemple."
    : picked.from > profile.endRain
    ? "La plage de maturité suit la fin des pluies d’exemple."
    : "La fin des pluies d’exemple tombe dans la plage de maturité.";
  putText("decision-cycle-status", statement);
  return taskResult("Préparer le choix du cycle", picked.label, [
    ["Cycle retenu", picked.label], ["Semis utilisé", readDate(plannedSowing(field, profile), true)],
    ["Maturité estimée", readDate(picked.from) + " au " + readDate(picked.to)]
  ], stage("Fenêtres de maturité", "Trait pointillé · fin des pluies", [], rows));
}

function standOutcome({ data, profile }) {
  if (!profile?.stand) return taskBlocked("Placettes à renseigner.");
  const report = computeStand(data);
  putText("stand-density", report ? francs.format(report.density) : "—");
  const map = stage("Contrôle de la levée", "Cliquer sur un point pour saisir", [
    ["Placettes", "3"],
    ["Densité observée", report ? francs.format(report.density) + " plants/ha" : "—"],
    ["Graines à préparer", report ? measured(report.seeds, "graines") : "—"],
    ["Budget semences", report ? priced(report.expense) : "—"]
  ]);
  if (!report || report.seeds === null) return taskBlocked("Compléter le comptage et les surfaces mesurées.", map);
  const summary = data.repair === 0 ? "Conserver la levée" : "Regarnir " + measured(data.repair, "ha");
  return taskResult(data.repair === 0 ? "Préparer le maintien" : "Préparer le regarnissage", summary, [
    ["Densité observée", francs.format(report.density) + " plants/ha"], ["Surface à reprendre", measured(data.repair, "ha")],
    ["Graines à prévoir", measured(report.seeds, "graines")], ["Budget semences", priced(report.expense)]
  ], map);
}

function irrigationOutcome({ data, profile, field }) {
  const water = profile?.water;
  const report = water && data.area <= field.area ? computeIrrigation(water, data.area, data.efficiency, data.flow) : null;
  const map = stage("Tour d’eau", data.slot, [
    ["Besoin net", report ? measured(report.mm, "mm") : "—"],
    ["Eau utile au sol", report ? measured(report.net, "m³") : "—"],
    ["À la source", report ? measured(report.source, "m³") : "—"],
    ["Durée estimée", report ? minutesLabel(report.minutes) : "—"]
  ]);
  if (!report) return taskBlocked(water ? "Vérifier la surface irrigable, le débit et l’efficacité." : "Bilan d’eau à compléter.", map);
  return taskResult("Préparer l’arrosage", measured(report.source, "m³") + " à la source", [
    ["Départ", data.slot], ["Secteur", water.zone], ["Surface déclarée", measured(data.area, "ha")],
    ["Besoin net", measured(report.mm, "mm")], ["Volume à la source", measured(report.source, "m³")],
    ["Durée", minutesLabel(report.minutes)]
  ], map);
}

function pumpOutcome({ data }) {
  const plan = computePump(data);
  for (const id of data.order) {
    const volume = element("pump-result-" + id);
    const rest = element("pump-rest-" + id);
    if (!volume || !rest) continue;
    const row = plan?.rows.find(item => item.id === id);
    volume.textContent = row ? pumpMinutes(row.minutes) + " · " + measured(row.volume, "m³") : "—";
    rest.textContent = row ? "Reste " + measured(row.rest, "mm") : "—";
  }
  const availability = plan ? minutesLabel(plan.available) : "—";
  const extra = plan && plan.available > 0
    ? `<div class="capacity-strip" role="img" aria-label="Temps utilisé sur le créneau"><span style="width:${plan.used / plan.available * 100}%"></span></div>` : "";
  const map = stage("Répartition de la pompe", data.slot, [
    ["Créneau disponible", availability],
    ["À la source", plan ? measured(plan.sourceAvailable, "m³") : "—"],
    ["Arrosage affecté", plan ? minutesLabel(plan.used) : "—"],
    ["Temps restant", plan ? minutesLabel(plan.remaining) : "—"]
  ], extra);
  if (!plan || plan.used <= 0) return taskBlocked("Aucun créneau ne permet d’affecter de l’eau.", map);
  const rows = plan.rows.filter(row => !row.missing && row.minutes > 0).map(row =>
    [row.field.name, pumpMinutes(row.minutes) + " · " + measured(row.volume, "m³")]
  );
  return taskResult("Préparer ces arrosages", minutesLabel(plan.used) + " affectées", [["Départ", data.slot], ...rows], map);
}

function timingOutcome({ data, profile, field }) {
  const item = profile?.fertilizer;
  if (!item) return taskBlocked("Apport à renseigner.");
  const applied = item.status === "réalisé";
  const map = stage(applied ? "Apport réalisé" : "Apport dans la campagne", item.stage, [
    ["Date prévue", readDate(item.date)],
    [applied ? "État de l’apport" : "Date envisagée", applied ? "Réalisé" : readDate(data.slot)],
    ["Dose saisie", measured(item.amount, "kg/ha")],
    ["Quantité de produit", measured(item.amount * field.area, "kg")]
  ]);
  if (applied) return taskBlocked("Un apport réalisé est consultable dans cette fiche.", map);
  if (![item.date,item.alternative].includes(data.slot)) return taskBlocked("Sélectionner une date.", map);
  return taskResult(data.slot === item.date ? "Préparer le maintien" : "Préparer le report", readDate(data.slot, true), [
    ["Produit", item.product], ["Quantité conservée", measured(item.amount * field.area, "kg")],
    ["Date prévue", readDate(item.date, true)], ["Créneau retenu", readDate(data.slot, true)]
  ], map);
}

function doseOutcome({ data, field, profile }) {
  const calculation = computeRates(field, data);
  const scale = doseScale(data);
  document.querySelectorAll("[data-rate-swatch]").forEach(item => {
    item.style.backgroundColor = scale.byZone[Number(item.dataset.rateSwatch)];
  });
  if (element("dose-mass")) putText("dose-mass", calculation ? measured(calculation.mass, "kg") : "—");
  if (element("dose-bags")) putText("dose-bags", calculation ? calculation.bags + (calculation.bags === 1 ? " sac" : " sacs") + " de " + measured(data.bag, "kg") : "—");
  const extra = calculation?.extra;
  const effect = Number.isFinite(extra) ? (extra < -.005 ? "−" : extra > .005 ? "+" : "") + priced(Math.abs(extra)) : "—";
  const map = stage("Préparation de l’engrais", profile?.fertilizer?.product ?? "Produit à renseigner", [
    ["Quantité totale", calculation ? measured(calculation.mass, "kg") : "—"],
    ["Budget", calculation ? priced(calculation.cost) : "—"],
    ["Écart au plan uniforme", effect],
    ["Gain pour couvrir le surcoût", calculation ? measured(calculation.threshold, "kg de grain") : "—"]
  ]);
  if (!calculation) return taskBlocked("Compléter les doses et le poids du sac.", map);
  return taskResult("Préparer le plan de doses", measured(calculation.mass, "kg de produit"), [
    ["Produit", profile?.fertilizer?.product ?? "Produit à renseigner"], ["Surface", measured(field.area, "ha")],
    ["Quantité", measured(calculation.mass, "kg")], ["Sacs à prévoir", String(calculation.bags)],
    ["Budget du produit utilisé", priced(calculation.cost)]
  ], map);
}

function harvestOutcome({ data, field }) {
  const options = fields.filter(item => decisionProfiles[item.id]?.harvest).map(item => ({field:item, ...harvestOption(item,data)}));
  options.sort((a,b) => Number(b.possible) - Number(a.possible) || a.item.priority - b.item.priority);
  const list = element("harvest-list");
  list.innerHTML = options.map(row => `<div class="harvest-line">
    <div><button type="button" data-harvest-field="${htmlEscape(row.field.id)}">${htmlEscape(row.field.name)}</button>
    <span>${htmlEscape(row.item.label)} · ${htmlEscape(row.item.rain)}</span>
    <span>${row.item.dry === null ? "Humidité à mesurer" : htmlEscape(measured(row.item.dry, "%") + " · " + row.item.date + " · " + row.reason)}</span></div>
    <b>${htmlEscape(row.item.amount === null ? "—" : measured(row.item.amount,"t"))}</b></div>`).join("");
  const choice = harvestOption(field,data);
  const map = stage("Chantier de récolte", data.slot, [
    [choice.item?.kind || "Volume du lot", measured(choice.item?.amount,"t")],
    ["Transportables", measured(choice.quantity,"t")],
    ["Reste sur place", measured(choice.remainder,"t")],
    ["Humidité du grain", measured(choice.item?.dry,"%")]
  ]);
  if (!choice.possible) return taskBlocked(choice.reason + ".",map);
  return taskResult("Préparer la récolte", measured(choice.quantity, "t au créneau"), [
    ["Créneau", data.slot], ["Lot", choice.item.kind + " · " + measured(choice.item.amount,"t")],
    ["Prises en charge", measured(choice.quantity,"t")], ["À reprendre", measured(choice.remainder,"t")],
    ["Séchage", choice.needsDrying ? "À réserver" : "Seuil respecté dans cet exemple"]
  ], map);
}

function saleOutcome({ data }) {
  const report = computeSale(data);
  putText("sale-now", report ? francs.format(report.cash) : "—");
  putText("sale-minimum", report ? francs.format(report.min) : "—");
  putText("sale-now-detail", report ? measured(data.quantity, "kg") + " à " + measured(data.today, "FCFA/kg") : "Saisir la quantité et le prix.");
  putText("sale-later-detail", report ? measured(report.left, "kg") + " vendables après pertes" : "Saisir les coûts et les pertes.");
  let result = report ? "Prix d’équilibre " + measured(report.threshold, "FCFA/kg") : "Le stockage doit laisser une quantité vendable.";
  if (report?.futureNet !== null && report?.futureNet !== undefined) {
    const difference = report.futureNet - report.cash;
    if (difference > .005) result = "Le stockage rapporte " + priced(difference) + " de plus avec ce prix.";
    else if (difference < -.005) result = "La vente immédiate rapporte " + priced(-difference) + " de plus avec ce prix.";
    else result = "Les deux options donnent la même recette nette.";
  }
  putText("sale-conclusion", result);
  if (!report) return taskBlocked("Vérifier les valeurs et indiquer une perte inférieure à 100 %.");
  return taskResult("Préparer la comparaison", measured(report.min, "FCFA/kg") + " pour le stockage", [
    ["Recette nette immédiate", priced(report.cash)], ["Quantité après pertes", measured(report.left,"kg")],
    ["Frais du scénario stocké", priced(report.futureCost)], ["Seuil calculé", measured(report.threshold,"FCFA/kg")],
    ["Prix minimal en francs entiers", measured(report.min,"FCFA/kg")]
  ]);
}

const decisionOutcomes = {
  sowing: sowingOutcome, variety: varietyOutcome, stand: standOutcome,
  water: context => context.data.mode === "pump" ? pumpOutcome(context) : irrigationOutcome(context),
  fertilizer: context => context.data.mode === "dose" ? doseOutcome(context) : timingOutcome(context),
  harvest: harvestOutcome, sale: saleOutcome
};

function decisionSubtitle(context) {
  const { field, topic, profile, data } = context;
  const crop = field.crop + " · " + measured(field.area,"ha");
  switch (topic.id) {
    case "sowing": return crop + " · Préparer le semis";
    case "variety": return crop + " · Depuis le semis";
    case "stand": return crop + " · Contrôle après la levée";
    case "water": return data.mode === "pump"
      ? "Source partagée · 3 parcelles"
      : crop + (profile?.water?.stage ? " · " + profile.water.stage : "");
    case "fertilizer": return crop + (data.mode === "dose" ? " · Apport par zone" : " · Calendrier des apports");
    case "harvest": return "Exploitation · Capacité de transport";
    case "sale": return crop + " · Comparaison en FCFA";
  }
}

function mapRebuildNecessary(before, after) {
  if (before === after) return;
  recenter();
}

function renderDecision(field) {
  if (field.remote) { renderWorkerDecision(field); return; }
  element("decision-preview-btn").hidden = false;
  element("decision-history").hidden = false;
  const context = decisionContext();
  const { topic, data } = context;
  const title = topic.id === "water" && data.mode === "pump" ? "Répartir la pompe" :
    topic.id === "fertilizer" && data.mode === "dose" ? "Quelle quantité préparer ?" : topic.title;
  putText("decision-title", title);
  putText("decision-context", decisionSubtitle(context));
  const select = element("decision-field");
  const options = fields.map(item => new Option(item.name, item.id));
  select.replaceChildren(...options);
  select.value = field.id;
  element("decision-body").innerHTML = decisionBuilders[topic.id](context);
  element("decision-form").scrollTop = 0;
  if (decisionState.doseZone >= 0) {
    element("decision-body").querySelector('[data-dose-row="' + decisionState.doseZone + '"]')?.classList.add("selected-point");
  }
  element("decision-dock").querySelectorAll("[data-topic]").forEach(button =>
    button.setAttribute("aria-pressed", String(button.dataset.topic === topic.id))
  );
  element("decision-history").title = decisionState.saved.length
    ? "Brouillons enregistrés (" + decisionState.saved.length + ")" : "Brouillons enregistrés";
  paintDecisionOutputs();
}

function paintDecisionOutputs() {
  if (state.view !== "decisions") return;
  if (currentField().remote) return;
  const context = decisionContext();
  const result = decisionOutcomes[context.topic.id](context);
  element("decision-map-foot").hidden = !result.map;
  element("decision-map-foot").innerHTML = result.map;
  const notes = element("decision-error");
  const available = result.ok && element("decision-form").checkValidity();
  let message = result.message;
  if (context.topic.id === "fertilizer" && context.data.mode === "timing" && context.profile?.fertilizer?.status === "réalisé") {
    message = "";
  }
  notes.textContent = available ? "" : message || (result.ok ? "Corriger les champs signalés." : "");
  const action = element("decision-preview-btn");
  action.disabled = !available;
  action.hidden = !available && !message && !result.ok;
  action.textContent = result.action;
  updateDecisionLegend();
  scheduleDraw();
}

function openDecision(topic, mode = null) {
  if (state.draft) {
    showMessage("Terminez le contour en cours ou annulez le tracé.");
    return;
  }
  const wasSplit = hasSplitMap();
  if (topic !== decisionState.topic) {
    decisionState.point = -1;
    decisionState.doseZone = -1;
  }
  decisionState.topic = topic;
  if (mode) chooseDraft(currentField(),topic).mode = mode;
  if (state.view !== "decisions") {
    setView("decisions");
  } else {
    mapRebuildNecessary(wasSplit, hasSplitMap());
    update();
  }
}

function processDecisionInput(target) {
  const name = target.dataset.param;
  if (!name || (target.type === "radio" && !target.checked)) return;
  const { data } = decisionContext();
  const value = target.type === "number" ? (target.value === "" || !target.validity.valid ? null : target.valueAsNumber) : target.value;
  if (name.startsWith("pump-")) data.minutes[name.slice(5)] = value;
  else data[name] = value;
  if (target.type === "number") target.setAttribute("aria-invalid", String(!target.validity.valid));
  paintDecisionOutputs();
}

function changePumpOrder(id, offset) {
  const { data } = decisionContext();
  const i = data.order.indexOf(id);
  const destination = i + offset;
  if (i < 0 || destination < 0 || destination >= data.order.length) return;
  [data.order[destination],data.order[i]] = [data.order[i],data.order[destination]];
  const form = element("decision-form");
  const scrollTop = form.scrollTop;
  renderDecision(currentField());
  form.scrollTop = scrollTop;
  const next = element("decision-body").querySelector('[data-pump-' + (offset < 0 ? 'up' : 'down') + '="' + id + '"]:not(:disabled)');
  if (next) next.focus({preventScroll:true});
}

function previewDecision(event) {
  event.preventDefault();
  if (currentField().remote) return;
  if (!element("decision-form").reportValidity()) return;
  const context = decisionContext();
  const result = decisionOutcomes[context.topic.id](context);
  if (!result.ok) return;
  decisionState.pending = { fieldId: context.field.id, topic: context.topic.id, data: copyScenario(context.data), summary: result.summary };
  putText("decision-preview-title", result.action);
  putText("decision-preview-field", context.field.name + " · Brouillon local");
  const rows = result.rows.map(([label,value]) => {
    const row = makeNode("div","preview-row");
    row.append(makeNode("dt","",label),makeNode("dd","",value));
    return row;
  });
  element("decision-preview-list").replaceChildren(...rows);
  element("decision-preview").showModal();
}

function saveDecision() {
  const draft = decisionState.pending;
  if (!draft) return;
  const encoded = JSON.stringify(draft.data);
  const existing = decisionState.saved.findIndex(item =>
    item.topic === draft.topic && item.fieldId === draft.fieldId && JSON.stringify(item.data) === encoded
  );
  if (existing >= 0) decisionState.saved.splice(existing,1);
  decisionState.saved.unshift({ ...draft, id: newId() });
  let message = "Brouillon enregistré sur cet appareil.";
  try {
    localStorage.setItem(DECISION_STORE, JSON.stringify(decisionState.saved));
  } catch {
    message = "Brouillon enregistré pour cette session.";
  }
  decisionState.pending = null;
  element("decision-preview").close();
  const status = element("decision-error");
  status.textContent = message;
  element("decision-history").title = "Brouillons enregistrés (" + decisionState.saved.length + ")";
  if (state.expanded) showMessage(message);
}

function openDecisionHistory() {
  const items = element("decision-history-items");
  items.replaceChildren();
  if (!decisionState.saved.length) {
    items.append(makeNode("p","decision-short","Aucun scénario enregistré."));
  } else {
    for (const record of decisionState.saved) {
      const field = fields.find(item => item.id === record.fieldId);
      const topic = decisionTopics.find(item => item.id === record.topic);
      if (!field || !topic) continue;
      const row = makeNode("button","",topic.label + " · " + record.summary);
      row.type = "button";
      row.append(makeNode("small","",field.name));
      row.addEventListener("click",() => {
        decisionState.drafts.set(field.id + "/" + topic.id,copyScenario(record.data));
        state.fieldId = field.id;
        element("decision-history-dialog").close();
        openDecision(topic.id);
        recenter();
        scheduleDraw();
      });
      items.append(row);
    }
  }
  element("decision-history-dialog").showModal();
}

function setupDecisionInterface() {
  const dock = element("decision-dock");
  for (const topic of decisionTopics) {
    const entry = makeNode("button");
    entry.type = "button";
    entry.dataset.topic = topic.id;
    entry.append(makeIcon(topic.icon,true),document.createTextNode(topic.label));
    entry.addEventListener("click",() => openDecision(topic.id));
    dock.append(entry);
  }

  element("decision-field").addEventListener("change", event => {
    decisionState.point = -1;
    decisionState.doseZone = -1;
    selectField(event.target.value);
  });
  element("decision-form").addEventListener("input", event => processDecisionInput(event.target));
  element("decision-form").addEventListener("submit",previewDecision);
  element("decision-form").addEventListener("click",event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.decisionMode) {
      const wasSplit = hasSplitMap();
      chooseDraft(currentField(),decisionState.topic).mode = button.dataset.decisionMode;
      mapRebuildNecessary(wasSplit, hasSplitMap());
      update();
      element("decision-body").querySelector('[data-decision-mode="' + button.dataset.decisionMode + '"]')?.focus({preventScroll:true});
    } else if (button.dataset.pumpUp) {
      changePumpOrder(button.dataset.pumpUp,-1);
    } else if (button.dataset.pumpDown) {
      changePumpOrder(button.dataset.pumpDown,1);
    } else if (button.dataset.harvestField) {
      selectField(button.dataset.harvestField);
    }
  });
  element("save-decision").addEventListener("click",saveDecision);
  element("decision-preview").addEventListener("close",() => { decisionState.pending = null; });
  element("decision-history").addEventListener("click",openDecisionHistory);
  document.querySelectorAll("[data-quick-decision]").forEach(button =>
    button.addEventListener("click", () => openDecision(button.dataset.quickDecision, button.dataset.quickMode || null))
  );
}

function isDecisionSplit() {
  if (currentField().remote) return false;
  return !state.draft && state.view === "decisions" && decisionState.topic === "fertilizer" &&
    chooseDraft(currentField(),"fertilizer").mode === "dose" && !!currentField().ndvi;
}

function hasSplitMap() {
  return isComparing() || isDecisionSplit();
}

function decisionLayer(field) {
  if (!field.ndvi) return "satellite";
  if (decisionState.topic === "water" && decisionProfiles[field.id]?.water) return "irrigation";
  if (decisionState.topic === "stand") return "ndvi";
  if (decisionState.topic === "fertilizer" && isDecisionSplit()) return "input-dose";
  return "satellite";
}

function updateDecisionLayout() {
  const deciding = state.view === "decisions";
  const split = isDecisionSplit();
  const sale = deciding && decisionState.topic === "sale" && !currentField().remote;
  element("workspace").classList.toggle("is-deciding",deciding);
  element("map-end").classList.toggle("is-decision-split",split);
  element("primary-sidebar").hidden = deciding;
  element("decision-sidebar").hidden = !deciding;
  element("decision-dock").hidden = !deciding;
  element("decision-pane-a").hidden = !split;
  element("decision-pane-b").hidden = !split;
  element("sale-view").hidden = !sale;
  element("map-actions").hidden = sale;
  element("map-end").hidden = sale;
  if (!deciding) element("decision-map-foot").hidden = true;
}

function updateDecisionLegend() {
  if (state.view !== "decisions") return;
  const legend = element("legend");
  legendB.hidden = true;
  if (currentField().remote) { legend.hidden = true; return; }
  if (isDecisionSplit()) {
    fillLegend(legend,"zones");
    legendB.hidden = false;
    legendB.querySelector(".legend-head span").textContent = "Doses saisies";
    legendB.querySelector(".legend-index").textContent = "kg/ha";
    const ramp = legendB.querySelector(".ramp");
    ramp.className = "ramp input";
    const scale = doseScale(decisionContext().data);
    ramp.style.background = scale.colors.length <= 1 ? scale.colors[0] ?? "#bbc9c6" :
      "linear-gradient(90deg," + scale.colors.map((color,i) =>
      color + " " + (i * 100 / scale.colors.length) + "% " + ((i + 1) * 100 / scale.colors.length) + "%"
    ).join(",") + ")";
    legendB.querySelectorAll(".legend-labels span").forEach((item,i) => {
      item.textContent = scale.labels[i];
    });
    return;
  }
  const { topic, data } = decisionContext();
  const pump = topic.id === "water" && data.mode === "pump" && computePump(data)?.used > 0;
  const layer = pump ? "irrigation" : decisionLayer(currentField());
  if (layer !== "irrigation") {
    fillLegend(legend,layer);
    return;
  }
  legend.hidden = false;
  legend.querySelector(".legend-head span").textContent = "Secteur illustré";
  legend.querySelector(".legend-index").textContent = "Eau";
  legend.querySelector(".ramp").className = "ramp water";
  legend.querySelectorAll(".legend-labels span").forEach((item,i) => {
    item.textContent = i === 0 ? "Zone étudiée" : i === 2 ? "À irriguer" : "";
  });
}

function drawDoses(ctx,field,tiles) {
  const { byZone } = doseScale(chooseDraft(field,"fertilizer"));
  ctx.globalAlpha = .93;
  const cells = new Map(tiles.map(tile => [tile.x + "/" + tile.y,tile.zone]));
  for (const tile of tiles) {
    ctx.fillStyle = byZone[tile.zone];
    ctx.fillRect(tile.x,tile.y,CELL + .3,CELL + .3);
  }
  ctx.globalAlpha = .72;
  ctx.beginPath();
  for (const tile of tiles) {
    if (cells.has((tile.x + CELL) + "/" + tile.y) && cells.get((tile.x + CELL) + "/" + tile.y) !== tile.zone) {
      ctx.moveTo(tile.x + CELL,tile.y);
      ctx.lineTo(tile.x + CELL,tile.y + CELL);
    }
    if (cells.has(tile.x + "/" + (tile.y + CELL)) && cells.get(tile.x + "/" + (tile.y + CELL)) !== tile.zone) {
      ctx.moveTo(tile.x,tile.y + CELL);
      ctx.lineTo(tile.x + CELL,tile.y + CELL);
    }
  }
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = "#254c4a";
  ctx.stroke();
}

function drawWater(ctx,field) {
  const area = spatialData(field);
  const [x, y] = decisionProfiles[field.id].stand.point[0];
  const data = decisionContext().data;
  const planned = data.mode === "field" ? data.area : decisionProfiles[field.id].water.area;
  const fraction = clamp((planned ?? 0) / field.area,0,1);
  const radius = Math.sqrt(polygonArea(field.shape) * fraction / (Math.PI * 1.20));
  ctx.globalAlpha = .27;
  ctx.fillStyle = WATER_COLORS[0];
  const b = area.bounds;
  ctx.fillRect(b.x0,b.y0,area.width,area.height);
  if (!fraction) return;
  ctx.globalAlpha = .90;
  if (fraction >= .98) {
    ctx.fillStyle = WATER_COLORS[2];
    ctx.fillRect(b.x0,b.y0,area.width,area.height);
    return;
  }
  const sector = [[-.98,-.42],[-.50,-.93],[.21,-1.00],[.92,-.59],
    [1.24,.04],[.84,.77],[.29,.98],[-.67,.79],[-1.13,.18]];
  pathPolygon(ctx,sector.map(([dx,dy]) => [x+dx*radius,y+dy*radius]));
  ctx.fillStyle = WATER_COLORS[2];
  ctx.fill();
  ctx.strokeStyle = "#eaf8ff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function paintDecisionOverlay(ctx,field,layer) {
  if (layer !== "irrigation" && layer !== "input-dose") return false;
  ctx.save();
  pathPolygon(ctx,field.shape);
  ctx.clip();
  if (layer === "irrigation") drawWater(ctx,field);
  else drawDoses(ctx,field,spatialData(field).tiles);
  ctx.restore();
  return true;
}

function paintDecisionPoints(ctx,field,frame) {
  if (field.remote || state.view !== "decisions" || decisionState.topic !== "stand") return;
  const points = decisionProfiles[field.id]?.stand.point || [];
  points.forEach(([x,y],i) => {
    const sx = frame.left + x * frame.scale;
    const sy = frame.top + y * frame.scale;
    ctx.beginPath();
    ctx.arc(sx,sy,12,0,Math.PI * 2);
    ctx.fillStyle = i === decisionState.point ? "#ffd998" : "#f5fff0";
    ctx.strokeStyle = "#244f3b";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 12px "Agri Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1b4434";
    ctx.fillText(String(i+1),sx,sy+1);
  });
}

function chooseStandPoint(canvas,x,y) {
  if (currentField().remote || state.view !== "decisions" || decisionState.topic !== "stand") return false;
  const points = decisionProfiles[currentField().id]?.stand.point || [];
  const scale = projection(canvas.clientWidth,canvas.clientHeight).scale;
  const result = points.findIndex(([px,py]) => Math.hypot(px-x,py-y) * scale < 17);
  if (result < 0) return false;
  decisionState.point = result;
  document.querySelectorAll("[data-stand-row]").forEach((row,i) =>
    row.classList.toggle("selected-point",i === result)
  );
  element("decision-body").querySelector('[data-param="plants' + result + '"]')?.focus();
  scheduleDraw();
  return true;
}


function chooseDoseZone(x,y) {
  if (!isDecisionSplit()) return false;
  const field = currentField();
  if (!contains(field.shape,x,y)) return false;
  const tileX = Math.floor(x/CELL)*CELL;
  const tileY = Math.floor(y/CELL)*CELL;
  const tile = spatialData(field).tiles.find(item => item.x === tileX && item.y === tileY);
  if (!tile) return false;
  decisionState.doseZone = tile.zone;
  document.querySelectorAll("[data-dose-row]").forEach((row,i) =>
    row.classList.toggle("selected-point",i === tile.zone)
  );
  const input = element("decision-body").querySelector('[data-param="rate' + tile.zone + '"]');
  input?.focus();
  return true;
}
