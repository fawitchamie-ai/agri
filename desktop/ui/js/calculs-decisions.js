// Each decision is a local scenario. The values below are illustrative.
const decisionTopics = [
  { id: "sowing", label: "Semis", title: "Quand semer ?", icon: "plant" },
  { id: "variety", label: "Variété", title: "Quel cycle peut finir à temps ?", icon: "seed" },
  { id: "stand", label: "Levée", title: "Garder ou regarnir ?", icon: "stand" },
  { id: "water", label: "Eau", title: "Combien arroser ?", icon: "drop" },
  { id: "fertilizer", label: "Engrais", title: "Quand apporter l’engrais ?", icon: "input" },
  { id: "harvest", label: "Récolte", title: "Quel champ récolter d’abord ?", icon: "harvest" },
  { id: "sale", label: "Vente", title: "Vendre ou stocker ?", icon: "sale" }
];
Object.assign(iconPaths, {
  decide: "M5 4v4.2h6V4z M13 16h6v4.2h-6z M8 8.2v6.3c0 2 1 3.2 3.3 3.2H13 M8 12h6.7c1.6 0 2.3-.8 2.3-2V6.5 M15 8.2 17 6l2 2.2",
  plant: "M12 21v-6m0 0C12 7 15.5 5.2 20 5c0 5.7-2.5 9.7-8 10zm0 2C12 10 8 8.7 4 8.6c.2 5.3 3.5 8.4 8 8.4z",
  seed: "M17.4 4.4c2.4 2 2.2 8.2-1.2 12-3.7 4.1-9 2.9-10.4.5-1.7-2.9.1-7 3.9-9.7 2.8-2 6-3.5 7.7-2.8z M8.2 16.2l7.6-8.1",
  stand: "M4 4h16v16H4z M9 8v8 M15 8v8 M7 10l2 1.8 2-1.8 M13 10l2 1.8 2-1.8",
  drop: "M12 3.5c2.9 3.6 6.2 7.2 6.2 11.1a6.2 6.2 0 0 1-12.4 0C5.8 10.7 9.1 7.1 12 3.5Z M9 15.3c.3 1.6 1.3 2.3 2.6 2.6",
  input: "M8 4h8l-1.1 4.3 3.9 7v4.5H5.2v-4.5l3.9-7z M9.2 8.5h5.6 M8.8 14.2h6.4 M10.9 16.8h2.2",
  harvest: "M12 21V4m0 5c-2.4 0-3.8-1.1-4.9-3.6 2.6-.4 4.3.6 4.9 3.6zm0 3c2.4 0 3.8-1.1 4.9-3.6-2.6-.4-4.3.6-4.9 3.6zm0 4.2c-2.4 0-3.8-1.1-4.9-3.6 2.6-.4 4.3.6 4.9 3.6zm0 3.3c2.4 0 3.8-1.1 4.9-3.6-2.6-.4-4.3.6-4.9 3.6z",
  sale: "M4 7h16v11H4z M7 7V5h12v2 M12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5 M6.5 12.5h.4 M17.1 12.5h.4",
  archive: "M4 5h16v4H4z M5.5 9v11h13V9 M9.5 13h5"
});

const PUMP_SLOTS = ["18 oct. · 06 h 30", "19 oct. · 06 h 30"];
const HARVEST_SLOTS = ["8 déc. · 07 h 00", "9 déc. · 07 h 00"];
const RATE_COLORS = ["#bcdde1", "#78b5bd", "#387d84"];
const WATER_COLORS = ["#c5e0ec", "#7db9d2", "#317ea8"];
const decisionProfiles = {
  kpele: {
    sowing: "2026-09-12", rain: [0, 7, 12, 15, 2, 0, 4, 7], endRain: "2026-12-05", cycles: [[84, 94], [103, 114]],
    stand: { counts: [25, 29, 24], areas: [5, 5, 5], point: [[333, 366], [412, 353], [540, 337]] },
    water: { deficit: 16, rain: 6, area: .24, efficiency: 80, stage: "Floraison", reason: "Déficit dès demain", zone: "Bordure ouest" },
    fertilizer: { product: "Urée · 46 % N", amount: 35, date: "2026-10-05", alternative: "2026-10-07", rainfall: [14, 3], stage: "Croissance végétative", status: "prévu" },
    harvest: { dry: 13.8, amount: 6, kind: "Lot pesé", date: "7 déc.", label: "Maturité observée", rain: "Pluie le 9 déc.", priority: 0 }
  },
  sodji: {
    sowing: "2026-08-28", rain: [3, 5, 14, 8, 0, 1, 3, 11], endRain: "2026-12-05", cycles: [[90, 101], [110, 121]],
    stand: { counts: [30, 26, 25], areas: [5, 5, 5], point: [[164, 146], [218, 155], [253, 162]] },
    water: { deficit: 11, rain: 4, area: .18, efficiency: 75, stage: "Remplissage des grains", reason: "Déficit dans 2 jours", zone: "Bas de parcelle" },
    fertilizer: { product: "NPK 15–15–15", amount: 45, date: "2026-09-16", alternative: "2026-09-18", rainfall: [6, 2], stage: "Tallage", status: "réalisé" },
    harvest: { dry: 16.1, amount: 3, kind: "Volume estimé", date: "6 déc.", label: "Maturité observée", rain: "Sec le 8 déc.", priority: 1 }
  },
  adeta: {
    sowing: "2026-10-01", rain: [0, 9, 9, 7, 1, 0, 2, 4], endRain: "2026-12-10", cycles: [[93, 105], [112, 125]],
    stand: { counts: [21, 23, 19], areas: [5, 5, 5], point: [[752, 456], [779, 531], [695, 502]] },
    water: null,
    fertilizer: { product: "NPK 15–15–15", amount: 40, date: "2026-11-02", alternative: "2026-11-04", rainfall: [5, 2], stage: "Montaison", status: "prévu" },
    harvest: { dry: null, amount: null, label: "Maturité à confirmer", rain: "Pluie le 9 déc.", priority: 2 }
  }
};

const DECISION_STORE = "agriprevision.decisions.desktop.v3";
const decisionState = { topic: "water", drafts: new Map(), saved: readDecisionRecords(), pending: null, point: -1, doseZone: -1 };
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const francs = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function readDecisionRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(DECISION_STORE) || "[]");
    return Array.isArray(data) ? data.filter(item =>
      item && typeof item.fieldId === "string" && typeof item.topic === "string" &&
      item.data && typeof item.data === "object" && typeof item.summary === "string"
    ) : [];
  } catch {
    return [];
  }
}

function addDays(value, days) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function readDate(value, year = false) {
  if (!value) return "—";
  return (year ? fullDate : dayFormatter).format(new Date(value + "T12:00:00Z"));
}

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
  );
}

function priced(value) {
  return Number.isFinite(value) ? francs.format(value) + " FCFA" : "—";
}

function measured(value, unit) {
  return Number.isFinite(value) ? number.format(value) + " " + unit : "—";
}

function minutesLabel(minutes) {
  if (!Number.isFinite(minutes)) return "—";
  const whole = Math.ceil(minutes - 1e-7);
  if (whole < 60) return whole + " min";
  const remainder = whole % 60;
  return Math.floor(whole / 60) + " h" + (remainder ? " " + String(remainder).padStart(2, "0") : "");
}

function pumpMinutes(minutes) {
  return Number.isFinite(minutes) ? number.format(Math.round(minutes * 100) / 100) + " min" : "—";
}

function doseScale(data) {
  const rates = [data.rate0,data.rate1,data.rate2];
  const levels = [...new Set(rates.filter(nonnegative))].sort((a,b) => a - b);
  const colors = levels.length === 0 ? [] : levels.length === 1 ? [RATE_COLORS[1]] : levels.length === 2 ? [RATE_COLORS[0], RATE_COLORS[2]] : RATE_COLORS;
  const byZone = rates.map(rate => colors[levels.indexOf(rate)] ?? "#bbc9c6");
  const labels = levels.length === 1 ? ["",number.format(levels[0]),""] :
    levels.length === 2 ? [number.format(levels[0]),"",number.format(levels[1])] :
    [0,1,2].map(i => Number.isFinite(levels[i]) ? number.format(levels[i]) : "—");
  return { byZone, colors, labels };
}

function chooseDraft(field, topic) {
  const key = field.id + "/" + topic;
  if (decisionState.drafts.has(key)) return decisionState.drafts.get(key);
  const p = decisionProfiles[field.id];
  let draft = {};
  switch (topic) {
    case "sowing":
      draft = { slot: p?.sowing || "" };
      break;
    case "variety":
      draft = { cycle: "0" };
      break;
    case "stand":
      draft = { plants0: p?.stand.counts[0], plants1: p?.stand.counts[1], plants2: p?.stand.counts[2],
        sample0: 5, sample1: 5, sample2: 5, repair: .06, target: 55000, seedCost: 900 };
      break;
    case "water":
      draft = { mode: "field", flow: 15, efficiency: p?.water?.efficiency, area: p?.water?.area, slot: PUMP_SLOTS[0],
        hours: 2, reserved: 0, order: ["kpele", "sodji", "adeta"], minutes: {} };
      break;
    case "fertilizer":
      draft = { mode: "timing", slot: p?.fertilizer.date || "", rate0: 42, rate1: 34, rate2: 28,
        usual: 35, bag: 50, price: 440, grain: 200 };
      break;
    case "harvest":
      draft = { truck: 4, trips: 1, dryer: 3, limit: 14, slot: HARVEST_SLOTS[0] };
      break;
    case "sale":
      draft = { quantity: 1000, today: 200, immediate: 0, loss: 5, storage: 8500, futureFee: 1500, futurePrice: null };
      break;
  }
  const found = decisionState.saved.find(item => item.fieldId === field.id && item.topic === topic);
  const result = found ? { ...draft, ...copyScenario(found.data) } : draft;
  decisionState.drafts.set(key, result);
  return result;
}

function copyScenario(data) {
  return JSON.parse(JSON.stringify(data));
}

function decisionContext() {
  const field = currentField();
  const topic = decisionTopics.find(item => item.id === decisionState.topic);
  return { field, topic, profile: decisionProfiles[field.id], data: chooseDraft(field, topic.id) };
}

function plannedSowing(field, profile) {
  const savedSowing = decisionState.saved.find(item => item.fieldId === field.id && item.topic === "sowing");
  return savedSowing?.data.slot || profile?.sowing;
}

function computeIrrigation(profile, area, efficiency, flow) {
  if (!profile || !positive(area) || !positive(efficiency) || efficiency > 100 || !positive(flow)) return null;
  const mm = Math.max(0, profile.deficit - profile.rain);
  const net = mm * area * 10;
  const source = net / (efficiency / 100);
  return { mm, net, source, minutes: source / flow * 60 };
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function nonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function computePump(data) {
  if (!positive(data.flow) || !positive(data.hours) || !nonnegative(data.reserved)) return null;
  const available = Math.max(0, data.hours * 60 - data.reserved);
  let remaining = available;
  const order = data.order.filter(id => decisionProfiles[id]);
  const rows = order.map(id => {
    const water = decisionProfiles[id].water;
    const field = fields.find(item => item.id === id);
    if (!water) return { id, field, missing: true };
    const demand = computeIrrigation(water, water.area, water.efficiency, data.flow);
    const requested = data.minutes[id] ?? demand.minutes;
    const minutes = Math.max(0, Math.min(requested, demand.minutes, remaining));
    const volume = minutes * data.flow / 60;
    const fieldWater = volume * water.efficiency / 100;
    const rest = Math.max(0, demand.mm - fieldWater / (10 * water.area));
    remaining -= minutes;
    return { id, field, water, minutes, volume, rest, demand };
  });
  return { available, remaining, sourceAvailable: available * data.flow / 60, used: available - remaining, rows };
}

function computeStand(data) {
  const counts = [data.plants0, data.plants1, data.plants2];
  const surfaces = [data.sample0, data.sample1, data.sample2];
  if (!counts.every(nonnegative) || !surfaces.every(positive)) return null;
  const density = counts.reduce((sum, n) => sum + n, 0) * 10000 / surfaces.reduce((sum, n) => sum + n, 0);
  const seeds = nonnegative(data.repair) && positive(data.target) ? Math.ceil(data.target * data.repair) : null;
  const expense = seeds !== null && nonnegative(data.seedCost) ? seeds / 1000 * data.seedCost : null;
  return { density, counts, surfaces, seeds, expense };
}

function computeRates(field, data) {
  const areas = spatialData(field).areas;
  const rates = [data.rate0, data.rate1, data.rate2];
  if (!field.ndvi || !rates.every(nonnegative) || !nonnegative(data.usual) || !positive(data.bag)) return null;
  const mass = areas.reduce((sum, area, i) => sum + area * rates[i], 0);
  const difference = mass - field.area * data.usual;
  const cost = nonnegative(data.price) ? mass * data.price : null;
  const extra = cost !== null ? difference * data.price : null;
  return { rates, areas, mass, bags: Math.ceil(mass / data.bag), cost, extra,
    threshold: positive(data.grain) && extra !== null && extra > 0 ? extra / data.grain : null };
}

function harvestOption(field, data) {
  const item = decisionProfiles[field.id]?.harvest;
  if (!Number.isFinite(item?.dry) || !positive(item?.amount)) return { item, reason: "Humidité à mesurer", possible: false };
  if (!positive(data.truck) || !positive(data.trips) || !positive(data.limit)) return { item, reason: "Capacité à renseigner", possible: false };
  const needsDrying = item.dry > data.limit;
  if (needsDrying && !positive(data.dryer)) return { item, reason: "Séchage à réserver", possible: false };
  const capacity = data.truck * data.trips;
  const quantity = Math.min(item.amount, capacity, needsDrying ? data.dryer : Infinity);
  return { item, reason: needsDrying ? "Séchage nécessaire" : "Humidité sous le seuil saisi", possible: true, quantity, remainder: item.amount - quantity, needsDrying };
}

function computeSale(data) {
  const costs = [data.immediate, data.storage, data.futureFee];
  if (!positive(data.quantity) || !positive(data.today) || !costs.every(nonnegative) || !nonnegative(data.loss) || data.loss >= 100) return null;
  const cash = data.quantity * data.today - data.immediate;
  const left = data.quantity * (1 - data.loss / 100);
  const futureCost = data.storage + data.futureFee;
  const threshold = (cash + futureCost) / left;
  const futureNet = nonnegative(data.futurePrice) ? left * data.futurePrice - futureCost : null;
  return { cash, left, futureCost, threshold, min: Math.max(0, Math.ceil(threshold - 1e-9)), futureNet };
}

function numberInput(label, name, value, min, max, step = "any", options = {}) {
  const val = Number.isFinite(value) ? value : "";
  const input = `<input type="number" name="${name}" data-param="${name}" min="${min}" max="${max}" step="${step}"
    value="${val}"${options.inline ? ' class="inline-input"' : ""}${options.placeholder === undefined ? "" : ' placeholder="' + htmlEscape(options.placeholder) + '"'}
    ${options.inline ? ' aria-label="' + htmlEscape(label) + '"' : ""}${options.required ? " required" : ""}>`;
  if (options.inline) return input;
  return `<label${options.full ? ' class="full"' : ""}>${htmlEscape(label)}${input}</label>`;
}

function choiceInput(label, name, values, value, options = {}) {
  const list = values.map(entry => {
    const key = Array.isArray(entry) ? entry[0] : entry;
    const title = Array.isArray(entry) ? entry[1] : entry;
    return `<option value="${htmlEscape(key)}"${key === value ? " selected" : ""}>${htmlEscape(title)}</option>`;
  }).join("");
  return `<label${options.full ? ' class="full"' : ""}>${htmlEscape(label)}<select name="${name}" data-param="${name}">${list}</select></label>`;
}

function radioOption(name, value, current, label, hint) {
  return `<label><input type="radio" name="${name}" data-param="${name}" value="${htmlEscape(value)}"${current === value ? " checked" : ""}>
    <span><strong>${htmlEscape(label)}</strong><small>${htmlEscape(hint)}</small></span></label>`;
}

function segmented(label, options, active) {
  return `<div class="decision-switch" role="group" aria-label="${htmlEscape(label)}">${options.map(([mode, title]) =>
    `<button type="button" data-decision-mode="${mode}" aria-pressed="${active === mode}">${title}</button>`
  ).join("")}</div>`;
}

function line(label, value, id = "") {
  return `<div class="line"><span>${htmlEscape(label)}</span><b${id ? ' id="' + id + '"' : ""}>${htmlEscape(value)}</b></div>`;
}

function help(text) {
  return `<details class="decision-help"><summary>Détails</summary><p>${htmlEscape(text)}</p></details>`;
}

function htmlProfileMissing(message) {
  return `<p class="decision-status">${htmlEscape(message)}</p>`;
}

function buildSowing({ profile, data, field }) {
  if (!profile) return htmlProfileMissing("Renseigner une culture, une date de semis et des données de pluie.");
  const a = addDays(profile.sowing, -3);
  return `<section class="decision-section" aria-label="Dates de semis">
    <h3>Créneau envisagé</h3><div class="decision-options">
    ${radioOption("slot", a, data.slot, readDate(a), measured(profile.rain[3] + profile.rain[4], "mm prévus sur 2 jours"))}
    ${radioOption("slot", profile.sowing, data.slot, readDate(profile.sowing), measured(profile.rain[6] + profile.rain[7], "mm prévus sur 2 jours"))}</div></section>
    <section class="decision-section">${line("Semis déclaré", field.sowing)}</section>
    <p class="decision-status">Vérifier l’humidité du lit de semences.</p>
    ${help("Les pluies observées et prévues sont deux séries fictives. Les dates enregistrées sont des scénarios et le semis déclaré reste visible séparément.")}`;
}

function cycleWindows(field, profile) {
  const sow = plannedSowing(field, profile);
  return profile.cycles.map(([start, end], i) => ({
    start, end, from: addDays(sow, start), to: addDays(sow, end),
    label: i ? "Cycle intermédiaire" : "Cycle court"
  }));
}

function buildVariety({ profile, data, field }) {
  if (!profile) return htmlProfileMissing("Renseigner la date de semis et les durées de cycle disponibles.");
  const options = cycleWindows(field, profile);
  return `<section class="decision-section">
    ${line("Semis utilisé", readDate(plannedSowing(field, profile)))}
    ${line("Fin des pluies (exemple)", readDate(profile.endRain))}
  </section>
  <section class="decision-section"><h3>Cycles disponibles</h3><div class="decision-options">${options.map((cycle, i) =>
    radioOption("cycle", String(i), data.cycle, cycle.label, cycle.start + "–" + cycle.end + " j · " + readDate(cycle.from) + " au " + readDate(cycle.to))
  ).join("")}</div></section>
  <p id="decision-cycle-status" class="decision-status"></p>
  ${help("Les durées sont des exemples comptés depuis le semis. Elles ne permettent pas d’estimer un rendement ou de choisir une variété locale sans référence.")}`;
}

function buildStand({ profile, data, field }) {
  if (!profile?.stand) return htmlProfileMissing("Ajouter des placettes avec une surface mesurée et un nombre de plants.");
  return `<div class="decision-lead"><div><strong id="stand-density">—</strong><span class="lead-label">plants/ha mesurés</span></div>
    <span class="lead-side">3 placettes</span></div>
    <section class="decision-section"><h3>Comptage sur place</h3>
    <table class="decision-table"><thead><tr><th style="width:26%">Point</th><th>Plants</th><th>Surface (m²)</th></tr></thead>
    <tbody>${[0,1,2].map(i => `<tr data-stand-row="${i}">
    <td>${i + 1}</td><td>${numberInput("Plants au point " + (i + 1), "plants" + i, data["plants" + i], 0, 1000, 1, {inline:true,required:true})}</td>
    <td>${numberInput("Surface du point " + (i + 1) + " en m²", "sample" + i, data["sample" + i], .1, 500, .1, {inline:true,required:true})}</td></tr>`).join("")}</tbody></table></section>
    <section class="decision-section"><h3>Regarnissage envisagé</h3><div class="decision-inputs">
    ${numberInput("Surface à reprendre (ha)", "repair", data.repair, 0, field.area, .01, {required:true})}
    ${numberInput("Densité visée (plants/ha)", "target", data.target, 1, 300000, 1, {required:true})}
    ${numberInput("FCFA pour 1 000 graines", "seedCost", data.seedCost, 0, 100000, 1, {full:true})}
    </div></section>
    ${help("Densité = total de plants ÷ surface totale mesurée × 10 000. Le nombre indicatif de graines suppose une graine par emplacement.")}`;
}

function buildWater({ profile, data, field }) {
  const water = profile?.water;
  const tabs = segmented("Plan d’eau", [["field", "Ce champ"], ["pump", "Partager la pompe"]], data.mode);
  if (data.mode === "pump") {
    const list = data.order.map((id, index) => {
      const item = fields.find(field => field.id === id);
      const sample = decisionProfiles[id]?.water;
      const arrows = `<span class="pump-order">
        <button type="button" data-pump-up="${id}" aria-label="Remonter ${htmlEscape(item.name)}"${index === 0 ? " disabled" : ""}>↑</button>
        <button type="button" data-pump-down="${id}" aria-label="Descendre ${htmlEscape(item.name)}"${index === data.order.length - 1 ? " disabled" : ""}>↓</button>
      </span>`;
      return `<li><div class="pump-head"><b>${htmlEscape(item.name)}</b>${arrows}</div>
      ${sample ? `<div class="pump-values"><span>${htmlEscape(sample.reason)}</span><label>Max. ${numberInput("Durée maximale " + item.name + " en minutes", "pump-" + id, data.minutes[id], 0, 1440, 1, {inline:true,placeholder:"Auto"})} min</label></div>
      <div class="pump-values"><b id="pump-result-${id}"></b><span id="pump-rest-${id}"></span></div>` : `<p class="pump-missing">Bilan d’eau à compléter</p>`}</li>`;
    }).join("");
    return `${tabs}<div class="decision-inputs">
      ${numberInput("Débit source (m³/h)", "flow", data.flow, 1, 2000, "any", {required:true})}
      ${numberInput("Créneau (heures)", "hours", data.hours, .1, 24, "any", {required:true})}
      ${numberInput("Déjà réservé (min)", "reserved", data.reserved, 0, 1440, 1, {required:true})}
      ${choiceInput("Départ", "slot", PUMP_SLOTS, data.slot)}</div>
      <section class="decision-section"><h3>Ordre de passage</h3><ol class="pump-rows">${list}</ol></section>
      ${help("Le débit et la durée donnent le volume disponible à la source. Chaque champ reçoit au plus son besoin, après déduction des réservations et prise en compte des pertes d’irrigation.")}`;
  }
  if (!water) return tabs + htmlProfileMissing("Le déficit du sol et la surface irrigable sont à renseigner.");
  return `${tabs}<div class="decision-lead water"><div><strong>${measured(water.deficit - water.rain, "mm")}</strong>
    <span class="lead-label">à apporter au sol</span></div><span class="lead-side">${htmlEscape(water.zone)}</span></div>
    <section class="decision-section">${line("Déficit estimé", measured(water.deficit, "mm"))}${line("Pluie retenue", measured(water.rain, "mm"))}</section>
    <section class="decision-section"><h3>Préparer le tour d’eau</h3><div class="decision-inputs">
    ${numberInput("Surface irriguée (ha)", "area", data.area, .01, field.area, .01, {required:true})}
    ${numberInput("Débit source (m³/h)", "flow", data.flow, 1, 2000, "any", {required:true})}
    ${numberInput("Efficacité (%)", "efficiency", data.efficiency, 1, 100, 1, {required:true})}
    ${choiceInput("Départ", "slot", PUMP_SLOTS, data.slot)}
    </div></section>${help("1 mm sur 1 ha correspond à 10 m³. Le volume à la source est le besoin net divisé par l’efficacité d’irrigation.")}`;
}

function buildFertilizer({ profile, data, field }) {
  const item = profile?.fertilizer;
  const tabs = segmented("Plan d’engrais", [["timing", "Date d’apport"], ["dose", "Doses et coût"]], data.mode);
  if (data.mode === "dose") {
    if (!field.ndvi) return tabs + htmlProfileMissing("Tracer ou charger des zones avant de répartir les doses.");
    const areas = spatialData(field).areas;
    return `${tabs}<div class="decision-lead"><div><strong id="dose-mass">—</strong><span class="lead-label">de produit à préparer</span></div>
      <span class="lead-side" id="dose-bags">—</span></div>
      <section class="decision-section"><h3>Doses saisies par zone</h3>
      <div class="dose-strip" role="img" aria-label="Répartition des surfaces">${areas.map((area,i) =>
        `<span data-rate-swatch="${i}" style="width:${area / field.area * 100}%; background:${RATE_COLORS[i]}"></span>`).join("")}</div>
      <table class="decision-table"><thead><tr><th>Zone</th><th>Surface</th><th>kg/ha</th></tr></thead><tbody>${areas.map((area, i) =>
        `<tr data-dose-row="${i}"><td><i class="zone-color" data-rate-swatch="${i}" style="background:${RATE_COLORS[i]}"></i>${["Faible","Moyenne","Élevée"][i]}</td>
        <td>${measured(area, "ha")}</td><td>${numberInput("Dose de la zone " + (i + 1) + " en kg/ha", "rate"+i, data["rate"+i], 0, 1000, "any", {inline:true,required:true})}</td></tr>`
      ).join("")}</tbody></table></section>
      <section class="decision-section"><h3>Produit et budget</h3><div class="decision-inputs">
        ${numberInput("Dose habituelle (kg/ha)", "usual", data.usual, 0, 1000, "any", {required:true})}
        ${numberInput("Poids d’un sac (kg)", "bag", data.bag, 1, 1000, "any", {required:true})}
        ${numberInput("Engrais (FCFA/kg)", "price", data.price, 0, 30000, 1)}
        ${numberInput("Grain (FCFA/kg)", "grain", data.grain, 1, 30000, 1)}
      </div></section>${help("Les doses sont saisies pour l’exemple. Le coût porte sur les kg de produit utilisés. Aucun effet sur le rendement n’est estimé par cette fiche.")}`;
  }
  if (!item) return tabs + htmlProfileMissing("Ajouter un apport prévu à la campagne.");
  return `${tabs}<div class="decision-lead"><div><strong>${measured(item.amount, "kg/ha")}</strong><span class="lead-label">${htmlEscape(item.product)}</span></div><span class="lead-side">${item.status === "prévu" ? "Prévu" : "Réalisé"}</span></div>
    <section class="decision-section">${line("Stade d’exemple", item.stage)}${line("Surface traitée", measured(field.area, "ha"))}${line("Quantité totale", measured(item.amount * field.area, "kg"))}</section>
    ${item.status === "prévu" ? `<section class="decision-section"><h3>Comparer les créneaux</h3><div class="decision-options">
    ${radioOption("slot", item.date, data.slot, readDate(item.date) + " · prévu", measured(item.rainfall[0], "mm prévus"))}
    ${radioOption("slot", item.alternative, data.slot, readDate(item.alternative), measured(item.rainfall[1], "mm prévus"))}
    </div></section><p class="decision-status">Humidité du sol et référence locale à vérifier.</p>` : `<p class="decision-status good">L’apport réalisé le ${readDate(item.date)} est conservé.</p>`}
    ${help("Les pluies servent de repère. Une recommandation automatique demande une règle locale liée au produit et à la culture.")}`;
}

function buildHarvest({ data }) {
  return `<div class="decision-inputs">
    ${choiceInput("Créneau envisagé", "slot", HARVEST_SLOTS, data.slot, {full:true})}
    ${numberInput("Camion (t/rotation)", "truck", data.truck, .1, 30, "any", {required:true})}
    ${numberInput("Rotations", "trips", data.trips, 1, 20, 1, {required:true})}
    ${numberInput("Seuil acheteur (%)", "limit", data.limit, 1, 30, "any", {required:true})}
    ${numberInput("Séchage libre (t)", "dryer", data.dryer, 0, 100, "any")}
    </div><section class="decision-section"><h3>Parcelles à récolter</h3><div id="harvest-list"></div></section>
    ${help("Volumes pesés et estimés sont distingués. La priorité combine l’état observé, le risque de pluie et les moyens déclarés. Le seuil acheteur est une saisie d’exemple.")}`;
}

function buildSale({ data }) {
  return `<section class="decision-section" style="padding-top:0"><h3>Offre immédiate</h3><div class="decision-inputs">
    ${numberInput("Quantité vendable (kg)", "quantity", data.quantity, 1, 1000000, "any", {required:true})}
    ${numberInput("Prix actuel (FCFA/kg)", "today", data.today, 1, 30000, "any", {required:true})}
    ${numberInput("Frais immédiats (FCFA)", "immediate", data.immediate, 0, 100000000, 1, {full:true,required:true})}</div></section>
    <section class="decision-section"><h3>Hypothèses de stockage</h3><div class="decision-inputs">
    ${numberInput("Pertes (%)", "loss", data.loss, 0, 99.99, "any", {required:true})}
    ${numberInput("Stockage (FCFA)", "storage", data.storage, 0, 100000000, 1, {required:true})}
    ${numberInput("Frais futurs (FCFA)", "futureFee", data.futureFee, 0, 100000000, 1, {required:true})}
    ${numberInput("Prix futur (FCFA/kg)", "futurePrice", data.futurePrice, 0, 30000, "any", {placeholder:"Facultatif"})}
    </div></section>${help("Le seuil divise la recette nette immédiate plus les frais futurs par la quantité vendable après pertes. Comparer la même qualité de grain et la même humidité.")}`;
}

const decisionBuilders = { sowing: buildSowing, variety: buildVariety, stand: buildStand,
  water: buildWater, fertilizer: buildFertilizer, harvest: buildHarvest, sale: buildSale };
