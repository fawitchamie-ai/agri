window.agriPendingReturnContext=null;
try{
  const saved=JSON.parse(window.sessionStorage.getItem("agriprevision.return-context")||"null");
  window.sessionStorage.removeItem("agriprevision.return-context");
  const views=["fields","compare","zones","notes","campaign","decisions"];
  if(saved&&views.includes(saved.view))window.agriPendingReturnContext={view:saved.view,
    ...(typeof saved.campaignId==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(saved.campaignId)?{campaignId:saved.campaignId}:{})};
}catch{}
element("worker-login-close").hidden = !nativeInvoke;
window.addEventListener("pageshow", event => { if (event.persisted) void refreshWorkerFields(); });
setupDecisionInterface();
mapCanvases.forEach(bindMap);
const resizing = new ResizeObserver(scheduleDraw);
[...mapCanvases, element("trend")].forEach((canvas) => resizing.observe(canvas));
recenter();
update();
void refreshWorkerFields();
