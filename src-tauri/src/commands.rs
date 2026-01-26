use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub hotkey: String,
    pub language: String,
    pub enrichment_mode: String,
    pub output_target: String,
    pub retention_days: u32,
    pub llm_provider: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hotkey: "CommandOrControl+Shift+Space".to_string(),
            language: "en".to_string(),
            enrichment_mode: "clean-transcript".to_string(),
            output_target: "clipboard".to_string(),
            retention_days: 7,
            llm_provider: "openai".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub language: String,
    pub duration: f64,
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn get_settings() -> AppSettings {
    // TODO: Load from persistent storage
    AppSettings::default()
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    // TODO: Save to persistent storage
    log::info!("Saving settings: {:?}", settings);
    Ok(())
}

/// Check if whisper is available on the system
#[tauri::command]
pub fn check_whisper_available() -> bool {
    // Check for whisper-cpp binary
    if let Ok(output) = Command::new("whisper").arg("--help").output() {
        return output.status.success();
    }

    // Check for whisper.cpp main binary
    if let Ok(output) = Command::new("main").arg("--help").output() {
        if let Ok(stdout) = String::from_utf8(output.stdout) {
            return stdout.contains("whisper");
        }
    }

    false
}

/// Transcribe audio using whisper.cpp
#[tauri::command]
pub async fn transcribe_audio(
    audio_path: String,
    language: String,
    model: String,
) -> Result<TranscriptionResult, String> {
    let audio_path = PathBuf::from(&audio_path);

    if !audio_path.exists() {
        return Err(format!("Audio file not found: {}", audio_path.display()));
    }

    // Try to find whisper binary
    let whisper_cmd = find_whisper_binary().ok_or("Whisper binary not found")?;

    // Build command arguments
    let mut cmd = Command::new(&whisper_cmd);
    cmd.arg("-f").arg(&audio_path)
       .arg("-l").arg(&language)
       .arg("-m").arg(get_model_path(&model)?)
       .arg("--output-txt")
       .arg("--no-timestamps");

    log::info!("Running whisper command: {:?}", cmd);

    let output = cmd.output().map_err(|e| format!("Failed to run whisper: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Whisper failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse whisper output
    let text = stdout.trim().to_string();

    Ok(TranscriptionResult {
        text,
        language,
        duration: 0.0, // TODO: Extract from whisper output
    })
}

/// Find the whisper binary on the system
fn find_whisper_binary() -> Option<String> {
    // Check common locations
    let candidates = vec![
        "whisper",
        "whisper-cpp",
        "main",
        "./whisper",
        "./main",
    ];

    for candidate in candidates {
        if let Ok(output) = Command::new(candidate).arg("--help").output() {
            if output.status.success() {
                return Some(candidate.to_string());
            }
        }
    }

    None
}

/// Get the path to the whisper model
fn get_model_path(model: &str) -> Result<String, String> {
    // Common model locations
    let model_name = match model {
        "tiny" | "tiny.en" => "ggml-tiny.en.bin",
        "base" | "base.en" => "ggml-base.en.bin",
        "small" | "small.en" => "ggml-small.en.bin",
        "medium" | "medium.en" => "ggml-medium.en.bin",
        "large" => "ggml-large.bin",
        _ => "ggml-base.en.bin",
    };

    // Check common model paths
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();

    let paths = vec![
        format!("{}/.cache/whisper/{}", home, model_name),
        format!("{}/whisper.cpp/models/{}", home, model_name),
        format!("./models/{}", model_name),
        format!("./{}", model_name),
    ];

    for path in paths {
        if PathBuf::from(&path).exists() {
            return Ok(path);
        }
    }

    Err(format!("Whisper model not found: {}. Please download using 'npx whisper-node download'", model))
}
