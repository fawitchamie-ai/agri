const legacyView = location.hash.slice(1).split(/[?\/]/)[0];
if (!nativeInvoke && (toolEntries.has(legacyView) || ["guide", "atlas", "models", "lineage", "quality", "explorer", "comparaison", "fiche", "import", "home"].includes(legacyView))) {
  location.replace("/outils" + location.search + location.hash);
}
element("worker-login-close").hidden = !nativeInvoke;
element("tools-toggle").addEventListener("click", () => element("tools-dialog").showModal());
document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
  element("tools-dialog").close();
  openAgriTool(button.dataset.tool, button.dataset.library ? { library: button.dataset.library } : {});
}));
document.querySelectorAll("[data-field-tool]").forEach(button => button.addEventListener("click", () => {
  const field = currentField();
  if (field) openAgriTool("seasonal", { campaign: field.id, section: button.dataset.fieldTool });
}));
window.addEventListener("pageshow", event => { if (event.persisted) void refreshWorkerFields(); });
setupDecisionInterface();
mapCanvases.forEach(bindMap);
const resizing = new ResizeObserver(scheduleDraw);
[...mapCanvases, element("trend")].forEach((canvas) => resizing.observe(canvas));
recenter();
update();
void refreshWorkerFields();
