#![cfg_attr(all(target_os = "windows", not(debug_assertions)), windows_subsystem = "windows")]

use serde::Serialize;
use base64::Engine;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const WORKER: &str = "https://agri.fawitchamie.workers.dev/";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiReply {
    status: u16,
    data: serde_json::Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageReply {
    mime: &'static str,
    data: String,
}

#[tauri::command]
fn worker_origin() -> &'static str {
    WORKER
}

#[tauri::command]
fn open_worker_login(caller: tauri::WebviewWindow) -> Result<(), String> {
    if caller.label() != "main" { return Err("Fenêtre non autorisée.".to_owned()); }
    let app = caller.app_handle();
    if let Some(window) = app.get_webview_window("worker-login") {
        window.show().map_err(|_| "Impossible d’ouvrir la connexion.".to_owned())?;
        window.set_focus().map_err(|_| "Impossible d’activer la fenêtre de connexion.".to_owned())?;
        return Ok(());
    }
    let url = Url::parse(WORKER).map_err(|_| "Adresse du Worker invalide.".to_owned())?;
    WebviewWindowBuilder::new(app, "worker-login", WebviewUrl::External(url))
        .title("Connexion AgriPrévision")
        .inner_size(1000.0, 760.0)
        .build()
        .map_err(|_| "Impossible d’ouvrir la fenêtre de connexion.".to_owned())?;
    Ok(())
}

/// Les cookies HTTP-only restent dans WebView2 ; aucun jeton ne traverse le JavaScript.
#[tauri::command]
async fn access_cookie(window: tauri::WebviewWindow) -> Result<String, String> {
    if window.label() != "main" { return Err("Fenêtre non autorisée.".to_owned()); }
    let cookie_url = Url::parse(WORKER).map_err(|_| "Adresse du Worker invalide.".to_owned())?;
    let login = window.app_handle().get_webview_window("worker-login");
    // Sur Windows, la lecture des cookies doit se faire hors du thread UI.
    tauri::async_runtime::spawn_blocking(move || {
        let from_login = login.and_then(|view| view.cookies_for_url(cookie_url.clone()).ok());
        let cookies = match from_login {
            Some(cookies) if cookies.iter().any(|c| c.name() == "CF_Authorization") => Ok(cookies),
            _ => window.cookies_for_url(cookie_url),
        };
        cookies
            .map(|cookies| cookies.into_iter()
                .filter(|c| c.name() == "CF_Authorization")
                .map(|c| format!("{}={}", c.name(), c.value()))
                .collect::<Vec<_>>().join("; "))
    }).await.map_err(|_| "Lecture de session interrompue.".to_owned())?
      .map_err(|_| "Session WebView indisponible. Relancez la connexion.".to_owned())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|_| "Connexion réseau indisponible.".to_owned())
}

async fn send_json(window: tauri::WebviewWindow, request: reqwest::RequestBuilder) -> Result<ApiReply, String> {
    let cookie = access_cookie(window).await?;
    let mut request = request.header("Accept", "application/json");
    if !cookie.is_empty() { request = request.header("Cookie", cookie); }
    let response = request.send().await.map_err(|_| "Worker inaccessible. Vérifiez votre connexion.".to_owned())?;
    let status = response.status().as_u16();
    if (300..400).contains(&status) {
        return Ok(ApiReply { status: 401, data: serde_json::json!({"error":"Connexion Cloudflare Access requise. Cliquez sur « Se connecter »."}) });
    }
    let bytes = response.bytes().await.map_err(|_| "Réponse du Worker interrompue.".to_owned())?;
    if bytes.len() > 8_000_000 { return Err("Réponse du Worker trop volumineuse.".to_owned()); }
    let data = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| serde_json::json!({"error":"Le Worker n’a pas retourné de données JSON."}));
    Ok(ApiReply { status, data })
}

#[tauri::command]
async fn worker_get(window: tauri::WebviewWindow, campaign_id: Option<String>) -> Result<ApiReply, String> {
    if campaign_id.as_ref().is_some_and(|id| id.is_empty() || id.len() > 100) {
        return Err("Identifiant de campagne invalide.".to_owned());
    }
    let mut url = Url::parse(WORKER)
        .and_then(|url| url.join("api/seasonal"))
        .map_err(|_| "Adresse du Worker invalide.".to_owned())?;
    if let Some(id) = campaign_id { url.query_pairs_mut().append_pair("id", &id); }
    send_json(window, client()?.get(url)).await
}

#[tauri::command]
async fn worker_post(window: tauri::WebviewWindow, body: serde_json::Value) -> Result<ApiReply, String> {
    if window.label() != "main" { return Err("Fenêtre non autorisée.".to_owned()); }
    let action = body.get("action").and_then(|v| v.as_str()).unwrap_or("");
    if !["satellite-catalog", "satellite-scenes", "satellite-index-series",
         "field-zone-season", "field-zone-map", "sowing-plan", "capabilities", "weather",
         "fertilizer-evidence", "fertilizer-information", "calibration-status", "product-catalog",
         "nutrient-balance", "compare-interventions", "data-readiness"].contains(&action) {
        return Err("Action de lecture non autorisée dans le desktop.".to_owned());
    }
    let serialized = serde_json::to_vec(&body).map_err(|_| "Données invalides.".to_owned())?;
    if serialized.len() > 100_000 { return Err("Requête trop volumineuse.".to_owned()); }
    let url = Url::parse(WORKER).and_then(|u| u.join("api/seasonal"))
        .map_err(|_| "Adresse du Worker invalide.".to_owned())?;
    send_json(window, client()?.post(url).header("Content-Type", "application/json").body(serialized)).await
}

/// Enregistrement explicite, avec révision attendue. Aucun envoi en arrière-plan.
#[tauri::command]
async fn worker_mutate(window: tauri::WebviewWindow, body: serde_json::Value) -> Result<ApiReply, String> {
    if window.label() != "main" { return Err("Fenêtre non autorisée.".to_owned()); }
    let action = body.get("action").and_then(|v| v.as_str()).unwrap_or("");
    if !["save", "event"].contains(&action) { return Err("Modification non autorisée.".to_owned()); }
    let id = body.get("id").and_then(|v| v.as_str()).unwrap_or("");
    if id.is_empty() || id.len() > 100 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') {
        return Err("Identifiant de campagne invalide.".to_owned());
    }
    if body.get("expectedRevision").and_then(|v| v.as_u64()).is_none() {
        return Err("Révision de campagne requise.".to_owned());
    }
    let serialized = serde_json::to_vec(&body).map_err(|_| "Données invalides.".to_owned())?;
    if serialized.len() > 7_500_000 { return Err("Campagne trop volumineuse.".to_owned()); }
    let url = Url::parse(WORKER).and_then(|u| u.join("api/seasonal"))
        .map_err(|_| "Adresse du Worker invalide.".to_owned())?;
    send_json(window, client()?.post(url).header("Content-Type", "application/json").body(serialized)).await
}

#[tauri::command]
async fn worker_image(window: tauri::WebviewWindow, layer: String, date: String, bounds: Vec<f64>) -> Result<ImageReply, String> {
    if window.label() != "main" { return Err("Fenêtre non autorisée.".to_owned()); }
    if !["rgb", "ndvi"].contains(&layer.as_str()) || date.len() != 10 ||
        !date.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() }) ||
        bounds.len() != 4 || bounds.iter().any(|v| !v.is_finite()) {
        return Err("Image ou emprise invalide.".to_owned());
    }
    let mut url = Url::parse(WORKER).and_then(|u| u.join("api/seasonal"))
        .map_err(|_| "Adresse du Worker invalide.".to_owned())?;
    url.query_pairs_mut().append_pair("satellite", "image").append_pair("layer", &layer)
        .append_pair("date", &date).append_pair("bbox",
            &bounds.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(","));
    let cookie = access_cookie(window).await?;
    let mut request = client()?.get(url).header("Accept", "image/png");
    if !cookie.is_empty() { request = request.header("Cookie", cookie); }
    let response = request.send().await.map_err(|_| "Image satellite indisponible.".to_owned())?;
    if !response.status().is_success() { return Err(format!("Image satellite indisponible (HTTP {}).", response.status().as_u16())); }
    if !response.headers().get("content-type").and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("image/png")) {
        return Err("Le Worker n’a pas retourné une image PNG.".to_owned());
    }
    let bytes = response.bytes().await.map_err(|_| "Image satellite interrompue.".to_owned())?;
    if bytes.len() > 3_000_000 || !bytes.starts_with(&[137,80,78,71,13,10,26,10]) {
        return Err("Image satellite invalide ou trop volumineuse.".to_owned());
    }
    Ok(ImageReply { mime: "image/png", data: base64::engine::general_purpose::STANDARD.encode(bytes) })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![worker_origin, open_worker_login, worker_get, worker_post, worker_mutate, worker_image])
        .run(tauri::generate_context!())
        .expect("AgriPrévision n’a pas pu ouvrir sa fenêtre");
}
