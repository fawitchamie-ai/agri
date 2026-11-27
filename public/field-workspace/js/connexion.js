const nativeInvoke = window.__TAURI__?.core?.invoke;

async function workerInvoke(command, args = {}) {
  if (nativeInvoke) return nativeInvoke(command, args);

  const query = new URLSearchParams();
  let options;
  switch (command) {
    case "open_worker_login":
      location.assign("/api/auth/login?" + new URLSearchParams({ returnTo: location.pathname + location.search }));
      return;
    case "close_worker_login":
      return;
    case "worker_get":
      if (args.campaignId) query.set("id", args.campaignId);
      break;
    case "worker_post":
    case "worker_mutate":
      options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args.body) };
      break;
    case "worker_image":
      query.set("satellite", "image");
      query.set("layer", args.layer);
      query.set("date", args.date);
      query.set("bbox", args.bounds.join(","));
      break;
    default:
      throw new Error("Action indisponible.");
  }

  const response = await fetch("/api/seasonal" + (query.size ? "?" + query : ""), {
    ...options, credentials: "same-origin", redirect: "manual"
  });
  const type = response.headers.get("Content-Type") || "";
  if (response.type === "opaqueredirect" || response.status === 401) {
    const error = "Connectez-vous à votre compte AgriPrévision.";
    if (command === "worker_image") throw new Error(error);
    return { status: 401, data: { error } };
  }
  if (command === "worker_image" && response.ok && type.startsWith("image/png")) {
    return { mime: "image/png", src: URL.createObjectURL(await response.blob()) };
  }
  const data = type.includes("application/json") ? await response.json() : {
    error: "AgriPrévision n’a pas pu charger les données (HTTP " + response.status + ")."
  };
  if (command === "worker_image") throw new Error(data.error || "Image indisponible.");
  return { status: response.status, data };
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

