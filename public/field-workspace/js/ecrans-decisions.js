const decisionState = {topic: "water", mode: "field", inputs: new Map(), saved: [], pending: null, scope: null};

function setDecisionScope(scope) {
  scope = typeof scope === "string" && /^[a-f0-9]{64}$/.test(scope) ? scope : null;
  if (scope === decisionState.scope) return;
  decisionState.scope = scope;
  decisionState.inputs.clear();
  decisionState.saved = [];
  if (!scope) return;
  try {
    const stored = JSON.parse(localStorage.getItem("agriprevision.decisions." + scope) || "[]");
    if (Array.isArray(stored)) decisionState.saved = stored.slice(0, 50).filter(item =>
      typeof item?.fieldId === "string" && decisionTopics.some(topic => topic.id === item.topic) && item.data && typeof item.data === "object");
  } catch { /* Drafts remain usable in memory when storage is unavailable. */ }
}

function decisionValues(field, topic = decisionState.topic) {
  const key = field.id + "/" + topic;
  if (!decisionState.inputs.has(key)) decisionState.inputs.set(key, {});
  return decisionState.inputs.get(key);
}

function openDecision(topic, mode = null) {
  const field = currentField();
  if (!field) return;
  decisionState.topic = topic;
  decisionState.mode = mode || (topic === "fertilizer" ? "timing" : "field");
  if (state.view !== "decisions") setView("decisions");
  else update();
  if (topic === "fertilizer" && mode === "dose") void loadWorkerZoneMap(field);
}

function renderDecision(field) {
  renderWorkerDecision(field);
  if (!field.campaign) return;
  element("decision-history").hidden = false;
  element("decision-preview-btn").hidden = false;
  updateDecisionPreview();
}

function decisionResult(field) {
  const topic = decisionState.topic;
  const data = decisionValues(field);
  if (topic === "sale") {
    const result = computeSale(data);
    if (!result) return null;
    const money = value => number.format(value) + " FCFA";
    return [["Vendre maintenant", money(result.cash)], ["Quantité après pertes", number.format(result.left) + " kg"],
      ["Seuil de vente après stockage", money(result.min) + "/kg"],
      ...(result.futureNet === null ? [] : [["Recette future simulée", money(result.futureNet)]])];
  }
  if (topic === "stand") {
    const result = computeStand(data);
    if (!result || !Number.isFinite(result.seeds)) return null;
    return [["Densité des placettes", number.format(result.density) + " plants/ha"],
      ["Graines pour la surface envisagée", number.format(result.seeds)],
      ...(result.expense === null ? [] : [["Coût des graines", number.format(result.expense) + " FCFA"]])];
  }
  if (topic === "fertilizer" && decisionState.mode === "dose") {
    const result = workerDoseBudget(field, data);
    if (!result) return null;
    return [["Produit à préparer", number.format(result.total) + " kg"], ["Sacs à prévoir", number.format(result.bags)],
      ["Écart avec la dose uniforme", number.format(result.difference) + " kg"],
      ...(result.cost === null ? [] : [["Coût du produit", number.format(result.cost) + " FCFA"]]),
      ...(result.threshold === null ? [] : [["Grain pour couvrir le surcoût", number.format(result.threshold) + " kg"]])];
  }
  if (topic === "harvest") {
    if (![data.quantity, data.truck, data.trips, data.limit].every(positive) || !nonnegative(data.moisture)) return null;
    const drying = data.moisture > data.limit;
    if (drying && !nonnegative(data.dryer)) return null;
    const moved = Math.min(data.quantity, data.truck * data.trips, drying ? data.dryer : Infinity);
    return [["Quantité transportable", number.format(moved) + " t"], ["Reste au champ", number.format(data.quantity - moved) + " t"],
      ["Séchage selon le seuil saisi", drying ? "À prévoir" : "Humidité sous le seuil"]];
  }
  const result = workerDecision(field, topic);
  return [[result.label, result.value], ["À vérifier", result.note]];
}

function updateDecisionPreview() {
  const field = currentField();
  if (!field || state.view !== "decisions") return;
  const rows = decisionResult(field);
  element("decision-preview-btn").disabled = !rows;
  putText("decision-error", rows ? "" : "Complétez les mesures et les paramètres du scénario.");
  if (decisionState.topic === "stand") {
    const result = computeStand(decisionValues(field));
    putText("stand-density", result ? number.format(result.density) : "—");
  }
  if (isDecisionSplit()) {
    const result = workerDoseBudget(field, decisionValues(field));
    if (element("decision-dose-mass")) putText("decision-dose-mass", result ? number.format(result.total) + " kg" : "—");
    scheduleDraw();
  }
  if (decisionState.topic === "sale") {
    const result = computeSale(decisionValues(field));
    putText("sale-now", result ? number.format(result.cash) : "—");
    putText("sale-minimum", result ? number.format(result.min) : "—");
    putText("sale-now-detail", "Recette après les frais immédiats.");
    putText("sale-later-detail", result ? number.format(result.left) + " kg vendables après pertes." : "Renseignez les pertes et les coûts.");
    putText("sale-conclusion", result?.futureNet == null ? "Le prix futur est une hypothèse à renseigner." : "Recette simulée après stockage : " + number.format(result.futureNet) + " FCFA.");
  }
}

function setupDecisionInterface() {
  const dock = element("decision-dock");
  for (const topic of decisionTopics) {
    const button = makeNode("button", "");
    button.type = "button";
    button.dataset.topic = topic.id;
    button.append(makeIcon(topic.icon, true), document.createTextNode(topic.label));
    button.addEventListener("click", () => openDecision(topic.id));
    dock.append(button);
  }
  element("decision-field").addEventListener("change", event => selectField(event.target.value));
  element("decision-form").addEventListener("input", event => {
    const input = event.target;
    if (!input.dataset.param) return;
    decisionValues(currentField())[input.dataset.param] = input.validity.valid ? input.valueAsNumber : null;
    updateDecisionPreview();
  });
  element("decision-form").addEventListener("click", event => {
    const mode = event.target.closest("[data-decision-mode]")?.dataset.decisionMode;
    if (mode) openDecision(decisionState.topic, mode);
  });
  element("decision-form").addEventListener("submit", event => {
    event.preventDefault();
    const field = currentField();
    const rows = decisionResult(field);
    if (!rows) return;
    const topic = decisionTopics.find(item => item.id === decisionState.topic);
    decisionState.pending = {fieldId: field.id, topic: topic.id, mode: decisionState.mode, data: {...decisionValues(field)}};
    putText("decision-preview-title", topic.title);
    putText("decision-preview-field", field.name);
    element("decision-preview-list").replaceChildren(...rows.map(([label, value]) => {
      const row = makeNode("div", "preview-row");
      row.append(makeNode("dt", "", label), makeNode("dd", "", value));
      return row;
    }));
    element("decision-preview").showModal();
  });
  element("save-decision").addEventListener("click", () => {
    if (!decisionState.pending) return;
    decisionState.saved.unshift(decisionState.pending);
    decisionState.saved.length = Math.min(decisionState.saved.length, 50);
    decisionState.pending = null;
    element("decision-preview").close();
    let message = "Brouillon conservé pour cette session.";
    if (decisionState.scope) {
      try {
        localStorage.setItem("agriprevision.decisions." + decisionState.scope, JSON.stringify(decisionState.saved));
        message = "Brouillon enregistré pour votre compte sur cet appareil.";
      } catch { /* The session copy remains available. */ }
    }
    putText("decision-error", message);
  });
  element("decision-preview").addEventListener("close", () => { decisionState.pending = null; });
  element("decision-history").addEventListener("click", () => {
    const items = element("decision-history-items");
    const field = currentField();
    const records = decisionState.saved.filter(item => item.fieldId === field.id);
    items.replaceChildren(...records.map(record => {
      const button = makeNode("button", "", decisionTopics.find(topic => topic.id === record.topic).label);
      button.type = "button";
      button.addEventListener("click", () => {
        decisionState.inputs.set(field.id + "/" + record.topic, {...record.data});
        element("decision-history-dialog").close();
        openDecision(record.topic, record.mode);
      });
      return button;
    }));
    if (!records.length) items.append(makeNode("p", "decision-short", "Aucun brouillon pour ce champ."));
    element("decision-history-dialog").showModal();
  });
  document.querySelectorAll("[data-quick-decision]").forEach(button =>
    button.addEventListener("click", () => openDecision(button.dataset.quickDecision, button.dataset.quickMode)));
}

function isDecisionSplit() {
  return !!currentField() && state.view === "decisions" && decisionState.topic === "fertilizer" && decisionState.mode === "dose";
}

function hasSplitMap() { return isComparing() || isDecisionSplit(); }

function updateDecisionLayout() {
  const deciding = state.view === "decisions";
  const split = isDecisionSplit();
  const sale = deciding && decisionState.topic === "sale";
  element("workspace").classList.toggle("is-deciding", deciding);
  element("map-end").classList.toggle("is-decision-split", split);
  element("primary-sidebar").hidden = deciding;
  element("decision-sidebar").hidden = !deciding;
  element("decision-dock").hidden = !deciding;
  element("decision-pane-a").hidden = !split;
  element("decision-pane-b").hidden = !split;
  element("sale-view").hidden = !sale;
  element("map-actions").hidden = sale;
  element("map-end").hidden = sale;
}
