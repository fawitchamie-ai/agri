element("worker-login-close").hidden = !nativeInvoke;
window.addEventListener("pageshow", event => { if (event.persisted) void refreshWorkerFields(); });
setupDecisionInterface();
mapCanvases.forEach(bindMap);
const resizing = new ResizeObserver(scheduleDraw);
[...mapCanvases, element("trend")].forEach((canvas) => resizing.observe(canvas));
recenter();
update();
void refreshWorkerFields();
