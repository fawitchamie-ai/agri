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

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
  );
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function nonnegative(value) {
  return Number.isFinite(value) && value >= 0;
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

function segmented(label, options, active) {
  return `<div class="decision-switch" role="group" aria-label="${htmlEscape(label)}">${options.map(([mode, title]) =>
    `<button type="button" data-decision-mode="${mode}" aria-pressed="${active === mode}">${title}</button>`
  ).join("")}</div>`;
}

function help(text) {
  return `<details class="decision-help"><summary>Détails</summary><p>${htmlEscape(text)}</p></details>`;
}

function buildStand({data, field}) {
  return `<div class="decision-lead"><div><strong id="stand-density">—</strong><span class="lead-label">plants/ha mesurés</span></div>
    <span class="lead-side">3 placettes</span></div>
    <section class="decision-section"><h3>Comptage sur place</h3>
    <table class="decision-table"><thead><tr><th style="width:26%">Point</th><th>Plants</th><th>Surface (m²)</th></tr></thead>
    <tbody>${[0,1,2].map(i => `<tr data-stand-row="${i}">
    <td>${i + 1}</td><td>${numberInput("Plants au point " + (i + 1), "plants" + i, data["plants" + i], 0, 1000, 1, {inline:true,required:true})}</td>
    <td>${numberInput("Surface du point " + (i + 1) + " en m²", "sample" + i, data["sample" + i], .1, 500, .1, {inline:true,required:true})}</td></tr>`).join("")}</tbody></table></section>
    <section class="decision-section"><h3>Regarnissage envisagé</h3><div class="decision-inputs">
    ${numberInput("Surface à reprendre (ha)", "repair", data.repair, 0, Number.isFinite(field.area) ? field.area : 10000, .01, {required:true})}
    ${numberInput("Densité visée (plants/ha)", "target", data.target, 1, 300000, 1, {required:true})}
    ${numberInput("FCFA pour 1 000 graines", "seedCost", data.seedCost, 0, 100000, 1, {full:true})}
    </div></section>
    ${help("Densité = total de plants ÷ surface totale mesurée × 10 000. Le nombre indicatif de graines suppose une graine par emplacement.")}`;
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
