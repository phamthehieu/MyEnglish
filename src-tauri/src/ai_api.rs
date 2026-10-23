//! Direct Gemini API access with a key the learner pastes into Settings.
//!
//! When a key is stored, every AI feature calls the API over HTTPS and needs no CLI. The key lives in
//! the OS credential store (Windows Credential Manager / macOS Keychain), never in SQLite,
//! localStorage or a plain file. Without a key the app falls back to the AI CLI (see `run_ai_cli`).

use std::time::Duration;

const KEYRING_SERVICE: &str = "MyEnglish";
const KEYRING_USER: &str = "gemini_api_key";
const API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";
/// Public API model. The CLI model name (`gemini-3.6-flash-medium`) is not served by the API.
/// MYENGLISH_AI_MODEL overrides it (model retirement / testing).
const API_MODEL: &str = "gemini-3.8-flash";
/// Per model, for a real AI feature (some prompts write a whole dialogue)
const API_TIMEOUT: Duration = Duration::from_secs(40);
/// Per model, for the one-line check made when a key is saved
const PROBE_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_KEY_LEN: usize = 256;
/// The model the learner picked in Settings lives next to the key (not secret, but it must follow the key).
const KEYRING_MODEL_USER: &str = "gemini_model";
const MAX_MODEL_LEN: usize = 64;

/// Model used for API calls: MYENGLISH_AI_MODEL, then the one chosen in Settings, then the default.
fn api_model() -> String {
    std::env::var("MYENGLISH_AI_MODEL")
        .ok()
        .or_else(stored_model)
        .unwrap_or_else(|| API_MODEL.to_string())
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn entry(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, user).map_err(|e| format!("Không mở được kho khóa của hệ điều hành: {}", e))
}

/// A stored value, if any. A missing or unreadable credential store counts as "nothing stored".
fn read_entry(user: &str) -> Option<String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let value = entry(user).ok()?.get_password().ok()?;
        let value = value.trim().to_string();
        (!value.is_empty()).then_some(value)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let value = std::fs::read_to_string(secret_path(user)?).ok()?;
        let value = value.trim().to_string();
        (!value.is_empty()).then_some(value)
    }
}

fn write_entry(user: &str, value: &str) -> Result<(), String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        entry(user)?.set_password(value).map_err(|e| format!("Không lưu được vào kho khóa của hệ điều hành: {}", e))
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let path = secret_path(user).ok_or_else(|| "Chưa xác định được thư mục dữ liệu của ứng dụng.".to_string())?;
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| format!("Không tạo được thư mục lưu key: {}", e))?;
        }
        std::fs::write(&path, value).map_err(|e| format!("Không lưu được key: {}", e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }
}

fn delete_entry(user: &str) -> Result<(), String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        match entry(user)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Không xóa được khỏi kho khóa: {}", e)),
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        match secret_path(user) {
            Some(path) => match std::fs::remove_file(path) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(e) => Err(format!("Không xóa được key: {}", e)),
            },
            None => Ok(()),
        }
    }
}

/// Android, iOS and Linux have no credential store reachable from here: the key goes in a file of
/// the app's private data folder (other apps cannot read it; on Linux it is chmod 600).
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
static SECRET_DIR: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();

/// Called once at startup with the app data folder. Only used where there is no credential store.
pub fn init_secret_dir(dir: std::path::PathBuf) {
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = SECRET_DIR.set(dir);
    }
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let _ = dir;
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn secret_path(user: &str) -> Option<std::path::PathBuf> {
    SECRET_DIR.get().map(|dir| dir.join(format!("{}.secret", user)))
}

pub fn stored_api_key() -> Option<String> {
    read_entry(KEYRING_USER)
}

fn stored_model() -> Option<String> {
    read_entry(KEYRING_MODEL_USER)
}

/// Empty input means "use the default model" (None). Otherwise only characters a model id can have.
fn normalize_model(raw: &str) -> Result<Option<String>, String> {
    let model = raw.trim();
    if model.is_empty() {
        return Ok(None);
    }
    let model = model.strip_prefix("models/").unwrap_or(model);
    if model.len() > MAX_MODEL_LEN || !model.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')) {
        return Err("Tên model không hợp lệ (chỉ gồm chữ, số, - _ .), ví dụ gemini-3.8-flash.".to_string());
    }
    Ok(Some(model.to_string()))
}

fn apply_model(model: Option<&str>) -> Result<(), String> {
    match model {
        Some(m) => write_entry(KEYRING_MODEL_USER, m),
        None => delete_entry(KEYRING_MODEL_USER),
    }
}

/// Plain text of the first candidate, or a readable error. Thought parts are skipped.
fn extract_text(body: &serde_json::Value) -> Result<String, String> {
    let candidate = body
        .pointer("/candidates/0")
        .ok_or_else(|| match body.pointer("/promptFeedback/blockReason").and_then(|v| v.as_str()) {
            Some(reason) => format!("Gemini từ chối yêu cầu ({}).", reason),
            None => "Gemini không trả về nội dung.".to_string(),
        })?;
    let text: String = candidate
        .pointer("/content/parts")
        .and_then(|p| p.as_array())
        .map(|parts| {
            parts
                .iter()
                .filter(|p| !p.get("thought").and_then(|t| t.as_bool()).unwrap_or(false))
                .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();
    if text.trim().is_empty() {
        let reason = candidate.get("finishReason").and_then(|v| v.as_str()).unwrap_or("không rõ");
        return Err(format!("Gemini trả về nội dung rỗng (finishReason: {}).", reason));
    }
    Ok(text)
}

/// Vietnamese message for an HTTP failure. The response body names the cause, the key is never echoed.
fn describe_http_error(code: u16, body: &str) -> String {
    let api_message = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.pointer("/error/message").and_then(|m| m.as_str()).map(str::to_string))
        .unwrap_or_default();
    let hint = match code {
        400 | 401 | 403 if api_message.to_lowercase().contains("api key") => "API key không hợp lệ hoặc đã bị thu hồi.",
        401 | 403 => "API key không có quyền dùng Gemini API.",
        404 => "Model không tồn tại với key này. Đặt biến môi trường MYENGLISH_AI_MODEL sang model khác.",
        429 => "Đã vượt giới hạn lượt gọi của gói miễn phí. Hãy thử lại sau ít phút.",
        500..=599 => "Máy chủ Gemini đang lỗi. Hãy thử lại sau.",
        _ => "Gemini từ chối yêu cầu.",
    };
    let detail: String = api_message.chars().take(200).collect();
    if detail.is_empty() {
        format!("{} (HTTP {})", hint, code)
    } else {
        format!("{} (HTTP {}: {})", hint, code, detail)
    }
}

/// Vietnamese message for a request that never got an HTTP answer. Keeps the library's own detail
/// (it names the host and the OS error, never the key, which travels in a header) so a failure on a
/// device can be diagnosed from the screen.
fn describe_transport_error(t: &ureq::Transport) -> String {
    use ureq::ErrorKind;
    let hint = match t.kind() {
        ErrorKind::Dns => "Không phân giải được tên miền Google (kiểm tra DNS riêng, VPN hoặc app chặn quảng cáo).",
        ErrorKind::ConnectionFailed => "Không mở được kết nối tới Google (kiểm tra VPN, proxy hoặc mạng bị chặn).",
        ErrorKind::ProxyConnect | ErrorKind::ProxyUnauthorized => "Proxy từ chối kết nối.",
        ErrorKind::Io => "Kết nối bị ngắt hoặc quá thời gian chờ (sóng yếu, hoặc giờ máy bị lệch làm lỗi chứng chỉ TLS).",
        _ => "Không kết nối được tới Gemini (kiểm tra mạng).",
    };
    format!("{} [{:?}] {}", hint, t.kind(), t)
}

/// A failed call, and whether another model could still answer: overload (429, 5xx) and a request that
/// got no answer in time are the model's or the moment's problem, while a bad key or a missing model is not.
struct CallError {
    message: String,
    retryable: bool,
}

/// One call to one model. The prompts all ask for JSON, so the API is told to answer in JSON.
fn generate_once(key: &str, model: &str, prompt: &str, timeout: Duration) -> Result<String, CallError> {
    let url = format!("{}/{}:generateContent", API_BASE, model);
    let body = serde_json::json!({
        "contents": [{ "role": "user", "parts": [{ "text": prompt }] }],
        "generationConfig": { "responseMimeType": "application/json", "temperature": 0.4 }
    });
    let response = ureq::post(&url).set("x-goog-api-key", key).timeout(timeout).send_json(body);
    match response {
        Ok(resp) => {
            let json: serde_json::Value = resp
                .into_json()
                .map_err(|e| CallError { message: format!("Không đọc được phản hồi từ Gemini: {}", e), retryable: true })?;
            extract_text(&json).map_err(|message| CallError { message, retryable: true })
        }
        Err(ureq::Error::Status(code, resp)) => Err(CallError {
            message: describe_http_error(code, &resp.into_string().unwrap_or_default()),
            retryable: code == 429 || (500..=599).contains(&code),
        }),
        // Gemini sometimes holds the connection open without answering when a model is overloaded
        Err(ureq::Error::Transport(t)) => Err(CallError {
            retryable: t.kind() == ureq::ErrorKind::Io,
            message: describe_transport_error(&t),
        }),
    }
}

/// Models tried after the chosen one when it is overloaded or silent, newest first.
const FALLBACK_MODELS: [&str; 3] = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-lite-latest"];

/// One text generation. When the chosen model is overloaded or does not answer in time the next model is
/// tried, so a busy new model does not leave the learner staring at a spinner. The error of the chosen
/// model is the one reported when none of them answers.
fn generate_within(key: &str, model: &str, prompt: &str, timeout: Duration) -> Result<String, String> {
    let mut first_error: Option<String> = None;
    let candidates = std::iter::once(model).chain(FALLBACK_MODELS.iter().copied().filter(|m| *m != model)).take(3);
    for candidate in candidates {
        match generate_once(key, candidate, prompt, timeout) {
            Ok(text) => return Ok(text),
            Err(e) if !e.retryable => return Err(first_error.unwrap_or(e.message)),
            Err(e) => {
                first_error.get_or_insert(e.message);
            }
        }
    }
    Err(first_error.unwrap_or_else(|| "Gemini không trả lời.".to_string()))
}

fn generate(key: &str, model: &str, prompt: &str) -> Result<String, String> {
    generate_within(key, model, prompt, API_TIMEOUT)
}

/// Run a prompt against the Gemini API when a key is stored. `None` means "no key, use the CLI".
/// The result mimics a successful CLI run so every caller keeps parsing stdout the same way.
pub fn run_with_stored_key(prompt: &str) -> Option<Result<std::process::Output, String>> {
    let key = stored_api_key()?;
    Some(generate(&key, &api_model(), prompt).map(|text| std::process::Output {
        status: success_status(),
        stdout: text.into_bytes(),
        stderr: Vec::new(),
    }))
}

#[cfg(unix)]
fn success_status() -> std::process::ExitStatus {
    std::os::unix::process::ExitStatusExt::from_raw(0)
}

#[cfg(windows)]
fn success_status() -> std::process::ExitStatus {
    std::os::windows::process::ExitStatusExt::from_raw(0)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    pub configured: bool,
    /// Last 4 characters, so the learner can tell which key is stored.
    pub hint: Option<String>,
    /// Model in use for API calls (a custom one from Settings, or the default).
    pub model: String,
    pub default_model: String,
    /// True when MYENGLISH_AI_MODEL overrides whatever is chosen in Settings.
    pub model_from_env: bool,
}

#[tauri::command]
pub fn get_ai_api_key_status() -> ApiKeyStatus {
    let hint = stored_api_key().map(|key| key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect::<String>());
    ApiKeyStatus {
        configured: hint.is_some(),
        hint,
        model: api_model(),
        default_model: API_MODEL.to_string(),
        model_from_env: std::env::var("MYENGLISH_AI_MODEL").is_ok(),
    }
}

/// Pasted keys often carry invisible characters (spaces, line breaks, zero-width marks, BOM):
/// drop them, then accept only printable ASCII, which is also what an HTTP header value allows.
fn normalize_api_key(raw: &str) -> Result<String, String> {
    let key: String = raw
        .chars()
        .filter(|c| !c.is_whitespace() && !matches!(*c, '\u{200B}'..='\u{200F}' | '\u{2060}' | '\u{FEFF}'))
        .collect();
    if key.is_empty() {
        return Err("Hãy dán API key vào ô trước.".to_string());
    }
    if key.len() > MAX_KEY_LEN {
        return Err("API key quá dài, có thể bạn đã dán nhầm nội dung khác.".to_string());
    }
    if let Some(bad) = key.chars().find(|c| !c.is_ascii_graphic()) {
        return Err(format!(
            "API key có ký tự không hợp lệ ('{}'). Hãy copy lại key từ Google AI Studio.",
            bad.escape_default()
        ));
    }
    Ok(key)
}

const PROBE_PROMPT: &str = "Reply with the JSON {\"ok\":true}";

/// Check the key (and the chosen model) with a real call, and store them only when it works.
/// An empty `model` means the default model.
#[tauri::command]
pub async fn save_ai_api_key(key: String, model: Option<String>) -> Result<(), String> {
    let key = normalize_api_key(&key)?;
    let model = normalize_model(&model.unwrap_or_default())?;
    tauri::async_runtime::spawn_blocking(move || {
        generate_within(&key, model.as_deref().unwrap_or(API_MODEL), PROBE_PROMPT, PROBE_TIMEOUT)?;
        write_entry(KEYRING_USER, &key)?;
        apply_model(model.as_deref())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

/// Switch the model while keeping the stored key. The model is tried first and kept only when it works.
#[tauri::command]
pub async fn set_ai_model(model: String) -> Result<(), String> {
    let model = normalize_model(&model)?;
    tauri::async_runtime::spawn_blocking(move || {
        let key = stored_api_key().ok_or_else(|| "Chưa có API key. Hãy lưu key trước.".to_string())?;
        generate_within(&key, model.as_deref().unwrap_or(API_MODEL), PROBE_PROMPT, PROBE_TIMEOUT)?;
        apply_model(model.as_deref())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub fn clear_ai_api_key() -> Result<(), String> {
    delete_entry(KEYRING_USER)?;
    delete_entry(KEYRING_MODEL_USER)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_text_joins_parts_and_skips_thoughts() {
        let body = serde_json::json!({
            "candidates": [{ "content": { "parts": [
                { "text": "thinking", "thought": true },
                { "text": "{\"a\":" },
                { "text": "1}" }
            ] } }]
        });
        assert_eq!(extract_text(&body).unwrap(), "{\"a\":1}");
    }

    #[test]
    fn extract_text_reports_blocked_prompt() {
        let body = serde_json::json!({ "promptFeedback": { "blockReason": "SAFETY" } });
        assert!(extract_text(&body).unwrap_err().contains("SAFETY"));
    }

    #[test]
    fn extract_text_rejects_empty_output() {
        let body = serde_json::json!({ "candidates": [{ "finishReason": "MAX_TOKENS", "content": { "parts": [] } }] });
        assert!(extract_text(&body).unwrap_err().contains("MAX_TOKENS"));
    }

    #[test]
    fn http_errors_are_explained_in_vietnamese() {
        let bad_key = r#"{"error":{"message":"API key not valid. Please pass a valid API key."}}"#;
        assert!(describe_http_error(400, bad_key).contains("không hợp lệ"));
        assert!(describe_http_error(429, "").contains("giới hạn"));
        assert!(describe_http_error(404, "").contains("MYENGLISH_AI_MODEL"));
    }

    #[test]
    fn normalize_api_key_strips_invisible_characters() {
        assert_eq!(normalize_api_key("  AIzaSy-abc_123\r\n").unwrap(), "AIzaSy-abc_123");
        assert_eq!(normalize_api_key("AIza\u{200B}Sy abc\u{FEFF}").unwrap(), "AIzaSyabc");
        // Characters other than letters, digits, - and _ are fine (key formats change)
        assert_eq!(normalize_api_key("AQ.Ab8RN6-x_y").unwrap(), "AQ.Ab8RN6-x_y");
    }

    #[test]
    fn normalize_model_accepts_ids_and_empty_means_default() {
        assert_eq!(normalize_model("  ").unwrap(), None);
        assert_eq!(normalize_model("gemini-3.8-flash").unwrap().as_deref(), Some("gemini-3.8-flash"));
        assert_eq!(normalize_model("models/gemini-3.8-pro").unwrap().as_deref(), Some("gemini-3.8-pro"));
        assert!(normalize_model("gemini flash").is_err());
        assert!(normalize_model("a/../b").is_err());
        assert!(normalize_model(&"a".repeat(MAX_MODEL_LEN + 1)).is_err());
    }

    #[test]
    fn normalize_api_key_rejects_empty_and_non_ascii() {
        assert!(normalize_api_key(" \n ").is_err());
        assert!(normalize_api_key("AIzaSyé").unwrap_err().contains("không hợp lệ"));
        assert!(normalize_api_key(&"a".repeat(MAX_KEY_LEN + 1)).is_err());
    }

    #[cfg(any(unix, windows))]
    #[test]
    fn success_status_is_success() {
        assert!(success_status().success());
    }
}
