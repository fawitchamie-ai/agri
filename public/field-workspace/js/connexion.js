const nativeInvoke = window.__TAURI__?.core?.invoke;
window.agriActiveWorkspace = null;

async function workerInvoke(command, args = {}) {
  if (nativeInvoke) return nativeInvoke(command, args);

  const query = new URLSearchParams();
  let options, endpoint = "/api/seasonal";
  switch (command) {
    case "open_worker_login":
      location.assign("/api/auth/login?" + new URLSearchParams({ returnTo: workerSafeReturnPath() }));
      return;
    case "close_worker_login":
      return;
    case "worker_session":
      endpoint = "/api/session";
      break;
    case "worker_space_switch":
      endpoint = "/api/session";
      options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args.body) };
      break;
    case "worker_get":
      if (args.campaignId) query.set("id", args.campaignId);
      if (args.coopId) query.set("workspace", args.coopId);
      break;
    case "worker_post":
    case "worker_mutate":
      options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...args.body,
        ...(args.body?.workspaceId || !window.agriActiveWorkspace ? {} : { workspaceId: window.agriActiveWorkspace })
      }) };
      break;
    case "worker_image":
      query.set("satellite", "image");
      query.set("layer", args.layer);
      query.set("date", args.date);
      query.set("bbox", args.bounds.join(","));
      if (window.agriActiveWorkspace) query.set("workspace", window.agriActiveWorkspace);
      break;
    default:
      throw new Error("Action indisponible.");
  }

  let response;
  try {
    response = await fetch(endpoint + (query.size ? "?" + query : ""), {
      ...options, credentials: "same-origin", redirect: "manual",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", ...(options?.headers || {}) }
    });
  } catch {
    const error = new Error("Le service est injoignable. Vérifiez votre réseau; les données du compte ont été effacées de cet écran.");
    error.code = "NETWORK";
    window.agriHandleSessionFailure?.(error);
    throw error;
  }
  const type = response.headers.get("Content-Type") || "";
  if (response.type === "opaqueredirect" || response.status >= 300 && response.status < 400) {
    const error={message:"Cloudflare Access a redirigé la requête vers la connexion. La session doit être vérifiée à nouveau.",code:"ACCESS_REDIRECT"};
    window.agriHandleSessionFailure?.(error);
    return { status: 302, redirected: true, data: { error:error.message, code:error.code } };
  }
  if (command === "worker_image" && response.ok && type.startsWith("image/png")) {
    return { mime: "image/png", src: URL.createObjectURL(await response.blob()) };
  }
  const data = type.includes("application/json") ? await response.json() : {
    error: "AgriPrévision n’a pas pu charger les données (HTTP " + response.status + ")."
  };
  if (response.status === 401) data.code = "SESSION_EXPIRED";
  else if (response.status === 403) data.code = "FORBIDDEN";
  else if (response.status === 503) data.code = "SERVICE_UNAVAILABLE";
  else if (response.status >= 500 && command !== "worker_image") data.code = "SERVICE_UNAVAILABLE";
  else if (response.status === 409 && /^L’espace actif a changé/i.test(data.error || "")) data.code = "WORKSPACE_CHANGED";
  if (["SESSION_EXPIRED","FORBIDDEN","SERVICE_UNAVAILABLE","WORKSPACE_CHANGED"].includes(data.code))
    window.agriHandleSessionFailure?.({code:data.code,message:data.error||"La session ou l’espace actif a changé."});
  if (command === "worker_image" && !response.ok) {
    const error = new Error(data.error || "Image indisponible.");
    error.code = data.code || "HTTP_ERROR";
    error.status = response.status;
    throw error;
  }
  return { status: response.status, data };
}

function workerSafeReturnPath() {
  try{window.agriBeforeAccessLogin?.();}catch{}
  const path = location.pathname.startsWith("/field-workspace/") ? location.pathname : "/field-workspace/";
  const context=window.agriPendingReturnContext||window.agriReturnContext;
  const views=["fields","compare","zones","notes","campaign","decisions"];
  if(context&&views.includes(context.view))try{
    window.sessionStorage.setItem("agriprevision.return-context",JSON.stringify({
      view:context.view,
      ...(typeof context.campaignId==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(context.campaignId)?{campaignId:context.campaignId}:{})
    }));
  }catch{}
  return path + location.search + location.hash;
}

async function workerImage(args) {
  const response = await workerInvoke("worker_image", args);
  if (response.mime !== "image/png" || (!response.src && !response.data)) throw new Error("Image indisponible.");
  const image = new Image();
  image.src = response.src || "data:image/png;base64," + response.data;
  try {
    await image.decode();
    return image;
  } finally {
    if (response.src) URL.revokeObjectURL(response.src);
  }
}

