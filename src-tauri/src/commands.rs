use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use futures::StreamExt;
use std::io::Write;
use tauri::{Emitter, Window};

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

/// Result of whisper availability check
#[derive(Debug, Serialize, Deserialize)]
pub struct WhisperCheckResult {
    pub available: bool,
    pub path: Option<String>,
}

/// Check if whisper is available on the system
#[tauri::command]
pub fn check_whisper_available(saved_path: Option<String>) -> WhisperCheckResult {
    // First check the saved path if provided
    if let Some(ref path) = saved_path {
        let path_buf = PathBuf::from(path);
        if path_buf.exists() {
            // Verify it's actually whisper
            if let Ok(output) = Command::new(&path_buf).arg("--help").output() {
                if output.status.success() {
                    return WhisperCheckResult {
                        available: true,
                        path: Some(path.clone()),
                    };
                }
            }
        }
    }

    // Check for whisper-cpp binary in PATH
    if let Ok(output) = Command::new("whisper").arg("--help").output() {
        if output.status.success() {
            return WhisperCheckResult {
                available: true,
                path: Some("whisper".to_string()),
            };
        }
    }

    // Check for whisper.cpp main binary in PATH
    if let Ok(output) = Command::new("main").arg("--help").output() {
        if let Ok(stdout) = String::from_utf8(output.stdout) {
            if stdout.contains("whisper") {
                return WhisperCheckResult {
                    available: true,
                    path: Some("main".to_string()),
                };
            }
        }
    }

    // Check in our installation directory
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        let whisper_dir = PathBuf::from(&home).join(".voiceintelligence").join("whisper");

        // Check for Windows binaries
        let whisper_exe = whisper_dir.join("whisper.exe");
        if whisper_exe.exists() {
            return WhisperCheckResult {
                available: true,
                path: Some(whisper_exe.to_string_lossy().to_string()),
            };
        }

        let main_exe = whisper_dir.join("main.exe");
        if main_exe.exists() {
            return WhisperCheckResult {
                available: true,
                path: Some(main_exe.to_string_lossy().to_string()),
            };
        }

        // Check for Unix binaries
        let whisper_bin = whisper_dir.join("whisper");
        if whisper_bin.exists() {
            return WhisperCheckResult {
                available: true,
                path: Some(whisper_bin.to_string_lossy().to_string()),
            };
        }

        let main_bin = whisper_dir.join("main");
        if main_bin.exists() {
            return WhisperCheckResult {
                available: true,
                path: Some(main_bin.to_string_lossy().to_string()),
            };
        }
    }

    WhisperCheckResult {
        available: false,
        path: None,
    }
}

/// Verify a user-selected whisper path
#[tauri::command]
pub fn verify_whisper_path(path: String) -> WhisperCheckResult {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return WhisperCheckResult {
            available: false,
            path: None,
        };
    }

    // Try to run the binary
    if let Ok(output) = Command::new(&path_buf).arg("--help").output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Check if it looks like whisper
        if output.status.success() || stdout.contains("whisper") || stderr.contains("whisper")
           || stdout.contains("usage") || stderr.contains("usage") {
            return WhisperCheckResult {
                available: true,
                path: Some(path),
            };
        }
    }

    WhisperCheckResult {
        available: false,
        path: None,
    }
}

/// Result of OLLAMA service availability check
#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaCheckResult {
    pub available: bool,
    pub version: Option<String>,
    pub base_url: String,
}

/// Check if OLLAMA service is running via HTTP API
#[tauri::command]
pub async fn check_ollama_available(base_url: Option<String>) -> OllamaCheckResult {
    let url = base_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let version_endpoint = format!("{}/api/version", url);

    log::info!("Checking OLLAMA availability at: {}", version_endpoint);

    // Create HTTP client with timeout
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            log::warn!("Failed to create HTTP client: {}", e);
            return OllamaCheckResult {
                available: false,
                version: None,
                base_url: url,
            };
        }
    };

    // Try to reach the OLLAMA version endpoint
    match client.get(&version_endpoint).send().await {
        Ok(response) => {
            if response.status().is_success() {
                // Try to parse the version from the response text
                let version = match response.text().await {
                    Ok(text) => {
                        match serde_json::from_str::<serde_json::Value>(&text) {
                            Ok(json) => json.get("version")
                                .and_then(|v| v.as_str())
                                .map(String::from),
                            Err(_) => None,
                        }
                    }
                    Err(_) => None,
                };

                log::info!("OLLAMA is available, version: {:?}", version);
                OllamaCheckResult {
                    available: true,
                    version,
                    base_url: url,
                }
            } else {
                log::warn!("OLLAMA responded with non-success status: {}", response.status());
                OllamaCheckResult {
                    available: false,
                    version: None,
                    base_url: url,
                }
            }
        }
        Err(e) => {
            log::info!("OLLAMA is not available: {}", e);
            OllamaCheckResult {
                available: false,
                version: None,
                base_url: url,
            }
        }
    }
}

/// Information about an OLLAMA model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub model: String,
    pub size: u64,
    pub digest: String,
    pub modified_at: String,
}

/// Result of getting OLLAMA models
#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModelsResult {
    pub success: bool,
    pub models: Vec<OllamaModel>,
    pub error: Option<String>,
}

/// Get list of installed models from OLLAMA
#[tauri::command]
pub async fn get_ollama_models(base_url: Option<String>) -> OllamaModelsResult {
    let url = base_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let tags_endpoint = format!("{}/api/tags", url);

    log::info!("Getting OLLAMA models from: {}", tags_endpoint);

    // Create HTTP client with timeout
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            log::warn!("Failed to create HTTP client: {}", e);
            return OllamaModelsResult {
                success: false,
                models: vec![],
                error: Some(format!("Failed to create HTTP client: {}", e)),
            };
        }
    };

    // Query the OLLAMA tags endpoint
    match client.get(&tags_endpoint).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.text().await {
                    Ok(text) => {
                        // Parse the JSON response
                        match serde_json::from_str::<serde_json::Value>(&text) {
                            Ok(json) => {
                                let models = json.get("models")
                                    .and_then(|m| m.as_array())
                                    .map(|arr| {
                                        arr.iter()
                                            .filter_map(|m| {
                                                Some(OllamaModel {
                                                    name: m.get("name")?.as_str()?.to_string(),
                                                    model: m.get("model")
                                                        .and_then(|v| v.as_str())
                                                        .unwrap_or_else(|| m.get("name").and_then(|v| v.as_str()).unwrap_or(""))
                                                        .to_string(),
                                                    size: m.get("size")
                                                        .and_then(|v| v.as_u64())
                                                        .unwrap_or(0),
                                                    digest: m.get("digest")
                                                        .and_then(|v| v.as_str())
                                                        .unwrap_or("")
                                                        .to_string(),
                                                    modified_at: m.get("modified_at")
                                                        .and_then(|v| v.as_str())
                                                        .unwrap_or("")
                                                        .to_string(),
                                                })
                                            })
                                            .collect::<Vec<OllamaModel>>()
                                    })
                                    .unwrap_or_default();

                                log::info!("Found {} OLLAMA models", models.len());
                                OllamaModelsResult {
                                    success: true,
                                    models,
                                    error: None,
                                }
                            }
                            Err(e) => {
                                log::warn!("Failed to parse OLLAMA response: {}", e);
                                OllamaModelsResult {
                                    success: false,
                                    models: vec![],
                                    error: Some(format!("Failed to parse response: {}", e)),
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to read OLLAMA response: {}", e);
                        OllamaModelsResult {
                            success: false,
                            models: vec![],
                            error: Some(format!("Failed to read response: {}", e)),
                        }
                    }
                }
            } else {
                log::warn!("OLLAMA responded with non-success status: {}", response.status());
                OllamaModelsResult {
                    success: false,
                    models: vec![],
                    error: Some(format!("OLLAMA responded with status: {}", response.status())),
                }
            }
        }
        Err(e) => {
            log::info!("Failed to connect to OLLAMA: {}", e);
            OllamaModelsResult {
                success: false,
                models: vec![],
                error: Some(format!("Failed to connect to OLLAMA: {}", e)),
            }
        }
    }
}

/// Transcribe audio using whisper.cpp
#[tauri::command]
pub async fn transcribe_audio(
    audio_path: String,
    language: String,
    model: String,
    whisper_path: Option<String>,
) -> Result<TranscriptionResult, String> {
    let audio_path_buf = PathBuf::from(&audio_path);

    if !audio_path_buf.exists() {
        return Err(format!("Audio file not found: {}", audio_path_buf.display()));
    }

    let audio_size = std::fs::metadata(&audio_path_buf)
        .map(|m| m.len())
        .unwrap_or(0);
    log::info!("Audio file size: {} bytes", audio_size);

    // Audio should already be WAV format from the frontend
    let wav_path = audio_path_buf.clone();

    // Try to find whisper binary - first check provided path, then search
    let whisper_cmd = if let Some(ref path) = whisper_path {
        let path_buf = PathBuf::from(path);
        if path_buf.exists() {
            log::info!("Using provided whisper path: {}", path);
            path.clone()
        } else {
            log::warn!("Provided whisper path does not exist: {}", path);
            find_whisper_binary()
                .ok_or_else(|| format!("Whisper binary not found. Saved path '{}' does not exist and no whisper found in PATH.", path))?
        }
    } else {
        find_whisper_binary()
            .ok_or("Whisper binary not found. Please install whisper.cpp or configure the path in Settings.")?
    };

    log::info!("Using whisper binary: {}", whisper_cmd);

    // Verify whisper binary exists
    let whisper_path_buf = PathBuf::from(&whisper_cmd);
    if !whisper_path_buf.exists() && !whisper_cmd.starts_with("whisper") {
        return Err(format!("Whisper binary not found at path: {}", whisper_cmd));
    }

    // Get model path (considering language for multilingual support)
    let model_path = get_model_path(&model, &language)?;
    log::info!("Using model: {}", model_path);

    // Verify model exists
    if !PathBuf::from(&model_path).exists() {
        return Err(format!("Whisper model file not found: {}", model_path));
    }

    // Build command arguments - whisper.cpp uses different args
    // Standard whisper.cpp CLI: main -m <model> -f <audio> -l <lang>
    let mut cmd = Command::new(&whisper_cmd);
    cmd.arg("-m").arg(&model_path)
       .arg("-f").arg(&wav_path)
       .arg("-l").arg(&language)
       .arg("--no-timestamps")
       .arg("-otxt");  // Output as text

    let cmd_str = format!("{:?}", cmd);
    log::info!("Running whisper command: {}", cmd_str);

    let output = cmd.output().map_err(|e| {
        format!(
            "Failed to execute whisper command.\nCommand: {}\nError: {}\n\nMake sure whisper.cpp is properly installed.",
            cmd_str, e
        )
    })?;

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    log::info!("Whisper stdout: {}", stdout);
    log::info!("Whisper stderr: {}", stderr);
    log::info!("Whisper exit code: {:?}", output.status.code());

    if !output.status.success() {
        return Err(format!(
            "Whisper transcription failed (exit code: {:?}).\n\nCommand: {}\n\nStderr:\n{}\n\nStdout:\n{}",
            output.status.code(),
            cmd_str,
            stderr,
            stdout
        ));
    }

    // Parse whisper output - the text output might be in stdout or in a .txt file
    let mut text = stdout.trim().to_string();

    // If stdout is empty, check if a .txt file was created
    if text.is_empty() {
        let txt_path = wav_path.with_extension("wav.txt");
        if txt_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&txt_path) {
                text = content.trim().to_string();
            }
            // Clean up the txt file
            let _ = std::fs::remove_file(&txt_path);
        }

        // Also try without .wav extension
        let txt_path2 = wav_path.with_extension("txt");
        if text.is_empty() && txt_path2.exists() {
            if let Ok(content) = std::fs::read_to_string(&txt_path2) {
                text = content.trim().to_string();
            }
            let _ = std::fs::remove_file(&txt_path2);
        }
    }

    // Clean up WAV file if we created it
    if wav_path != audio_path_buf {
        let _ = std::fs::remove_file(&wav_path);
    }

    if text.is_empty() {
        return Err(format!(
            "Whisper returned empty transcription.\n\nThis could mean:\n- The audio is too short or silent\n- The audio format is not supported\n- Whisper couldn't process the file\n\nStderr: {}\nStdout: {}",
            stderr, stdout
        ));
    }

    Ok(TranscriptionResult {
        text,
        language,
        duration: 0.0,
    })
}

/// Find the whisper binary on the system
fn find_whisper_binary() -> Option<String> {
    // First check our installation directory
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        let whisper_dir = PathBuf::from(&home).join(".voiceintelligence").join("whisper");

        // Check for Windows binaries
        let whisper_exe = whisper_dir.join("whisper.exe");
        if whisper_exe.exists() {
            return Some(whisper_exe.to_string_lossy().to_string());
        }

        let main_exe = whisper_dir.join("main.exe");
        if main_exe.exists() {
            return Some(main_exe.to_string_lossy().to_string());
        }

        // Check for Unix binaries
        let whisper_bin = whisper_dir.join("whisper");
        if whisper_bin.exists() {
            return Some(whisper_bin.to_string_lossy().to_string());
        }

        let main_bin = whisper_dir.join("main");
        if main_bin.exists() {
            return Some(main_bin.to_string_lossy().to_string());
        }
    }

    // Then check common locations in PATH
    let candidates = vec![
        "whisper",
        "whisper-cpp",
        "main",
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

/// Install whisper.cpp
#[tauri::command]
pub async fn install_whisper() -> Result<InstallResult, String> {
    // Get user's home directory
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not find home directory")?;

    let whisper_dir = PathBuf::from(&home).join(".voiceintelligence").join("whisper");

    // Create directory if it doesn't exist
    if !whisper_dir.exists() {
        std::fs::create_dir_all(&whisper_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Check the platform and provide instructions
    #[cfg(target_os = "windows")]
    {
        // On Windows, we'll download a pre-built binary
        let download_url = "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip";

        log::info!("Downloading whisper.cpp from {}", download_url);

        // Use PowerShell to download
        let output = Command::new("powershell")
            .args([
                "-Command",
                &format!(
                    "Invoke-WebRequest -Uri '{}' -OutFile '{}'",
                    download_url,
                    whisper_dir.join("whisper.zip").display()
                )
            ])
            .output()
            .map_err(|e| format!("Failed to download: {}", e))?;

        if !output.status.success() {
            return Ok(InstallResult {
                success: false,
                message: "Failed to download whisper.cpp. Please install manually.".to_string(),
                path: None,
            });
        }

        // Extract the zip
        let output = Command::new("powershell")
            .args([
                "-Command",
                &format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    whisper_dir.join("whisper.zip").display(),
                    whisper_dir.display()
                )
            ])
            .output()
            .map_err(|e| format!("Failed to extract: {}", e))?;

        if !output.status.success() {
            return Ok(InstallResult {
                success: false,
                message: "Failed to extract whisper.cpp. Please install manually.".to_string(),
                path: None,
            });
        }

        // Download both English and multilingual models for language support
        let models = vec![
            ("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin", "ggml-base.en.bin"),
            ("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin", "ggml-base.bin"),
        ];

        for (model_url, model_name) in models {
            let model_path = whisper_dir.join(model_name);

            if !model_path.exists() {
                log::info!("Downloading whisper model: {}...", model_name);
                let output = Command::new("powershell")
                    .args([
                        "-Command",
                        &format!(
                            "Invoke-WebRequest -Uri '{}' -OutFile '{}'",
                            model_url,
                            model_path.display()
                        )
                    ])
                    .output()
                    .map_err(|e| format!("Failed to download model {}: {}", model_name, e))?;

                if !output.status.success() {
                    log::warn!("Failed to download model: {}", model_name);
                    // Continue with other models, don't fail completely
                }
            }
        }

        // Find the installed binary
        let whisper_exe = whisper_dir.join("whisper.exe");
        let main_exe = whisper_dir.join("main.exe");
        let installed_path = if whisper_exe.exists() {
            whisper_exe.to_string_lossy().to_string()
        } else if main_exe.exists() {
            main_exe.to_string_lossy().to_string()
        } else {
            whisper_dir.to_string_lossy().to_string()
        };

        return Ok(InstallResult {
            success: true,
            message: format!("Whisper.cpp installed to {}", whisper_dir.display()),
            path: Some(installed_path),
        });
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, use Homebrew
        let output = Command::new("brew")
            .args(["install", "whisper-cpp"])
            .output();

        match output {
            Ok(o) if o.status.success() => {
                return Ok(InstallResult {
                    success: true,
                    message: "Whisper.cpp installed via Homebrew".to_string(),
                    path: Some("whisper".to_string()),
                });
            }
            _ => {
                return Ok(InstallResult {
                    success: false,
                    message: "Failed to install via Homebrew. Please run: brew install whisper-cpp".to_string(),
                    path: None,
                });
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        return Ok(InstallResult {
            success: false,
            message: "Please install whisper.cpp manually: https://github.com/ggerganov/whisper.cpp".to_string(),
            path: None,
        });
    }

    #[allow(unreachable_code)]
    Ok(InstallResult {
        success: false,
        message: "Unsupported platform".to_string(),
        path: None,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
    pub path: Option<String>,
}

/// Information about a whisper model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhisperModel {
    pub id: String,
    pub name: String,
    pub size: String,
    pub size_bytes: u64,
    pub download_url: String,
    pub installed: bool,
    pub installed_path: Option<String>,
    pub is_multilingual: bool,
}

/// Get list of available whisper models with their installation status
#[tauri::command]
pub fn get_available_models() -> Vec<WhisperModel> {
    // Define available models based on whisper.cpp
    let models_info = vec![
        ("tiny", "Tiny (English)", "75 MB", 75_000_000u64, "ggml-tiny.en.bin", false),
        ("tiny-multi", "Tiny (Multilingual)", "75 MB", 75_000_000u64, "ggml-tiny.bin", true),
        ("base", "Base (English)", "142 MB", 142_000_000u64, "ggml-base.en.bin", false),
        ("base-multi", "Base (Multilingual)", "142 MB", 142_000_000u64, "ggml-base.bin", true),
        ("small", "Small (English)", "466 MB", 466_000_000u64, "ggml-small.en.bin", false),
        ("small-multi", "Small (Multilingual)", "466 MB", 466_000_000u64, "ggml-small.bin", true),
        ("medium", "Medium (English)", "1.5 GB", 1_500_000_000u64, "ggml-medium.en.bin", false),
        ("medium-multi", "Medium (Multilingual)", "1.5 GB", 1_500_000_000u64, "ggml-medium.bin", true),
        ("large", "Large (Multilingual)", "2.9 GB", 2_900_000_000u64, "ggml-large.bin", true),
    ];

    let base_url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

    // Get whisper models directory
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    let whisper_dir = PathBuf::from(&home).join(".voiceintelligence").join("whisper");

    models_info
        .into_iter()
        .map(|(id, name, size, size_bytes, filename, is_multilingual)| {
            let download_url = format!("{}/{}", base_url, filename);
            let model_path = whisper_dir.join(filename);
            let installed = model_path.exists();
            let installed_path = if installed {
                Some(model_path.to_string_lossy().to_string())
            } else {
                None
            };

            WhisperModel {
                id: id.to_string(),
                name: name.to_string(),
                size: size.to_string(),
                size_bytes,
                download_url,
                installed,
                installed_path,
                is_multilingual,
            }
        })
        .collect()
}

/// Progress event for model download
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub model_id: String,
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f32,
    pub status: String,
}

/// Result of model download
#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub message: String,
    pub model_path: Option<String>,
}

/// Download a whisper model with progress tracking
#[tauri::command]
pub async fn download_whisper_model(
    window: Window,
    model_id: String,
) -> Result<DownloadResult, String> {
    // Get model info from available models
    let models = get_available_models();
    let model = models
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Model '{}' not found", model_id))?;

    // Check if already installed
    if model.installed {
        return Ok(DownloadResult {
            success: true,
            message: "Model already installed".to_string(),
            model_path: model.installed_path.clone(),
        });
    }

    // Get whisper models directory
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not find home directory")?;
    let whisper_dir = PathBuf::from(&home).join(".voiceintelligence").join("whisper");

    // Create directory if it doesn't exist
    if !whisper_dir.exists() {
        std::fs::create_dir_all(&whisper_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Determine model filename from URL
    let filename = model.download_url
        .split('/')
        .last()
        .ok_or("Invalid download URL")?;
    let model_path = whisper_dir.join(filename);

    log::info!("Downloading model {} from {}", model_id, model.download_url);

    // Emit initial progress
    let _ = window.emit("download-progress", DownloadProgress {
        model_id: model_id.clone(),
        downloaded: 0,
        total: model.size_bytes,
        percentage: 0.0,
        status: "starting".to_string(),
    });

    // Create HTTP client and start download
    let client = reqwest::Client::new();
    let response = client
        .get(&model.download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    // Get content length for progress tracking
    let total_size = response
        .content_length()
        .unwrap_or(model.size_bytes);

    // Create temporary file for download
    let temp_path = model_path.with_extension("bin.tmp");
    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    // Stream the download with progress updates
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut last_progress_update = std::time::Instant::now();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result
            .map_err(|e| format!("Download error: {}", e))?;

        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write to file: {}", e))?;

        downloaded += chunk.len() as u64;

        // Emit progress every 100ms to avoid overwhelming the frontend
        if last_progress_update.elapsed().as_millis() >= 100 {
            let percentage = (downloaded as f32 / total_size as f32) * 100.0;
            let _ = window.emit("download-progress", DownloadProgress {
                model_id: model_id.clone(),
                downloaded,
                total: total_size,
                percentage,
                status: "downloading".to_string(),
            });
            last_progress_update = std::time::Instant::now();
        }
    }

    // Flush and close the file
    file.flush()
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    drop(file);

    // Rename temp file to final path
    std::fs::rename(&temp_path, &model_path)
        .map_err(|e| format!("Failed to move downloaded file: {}", e))?;

    // Emit completion progress
    let _ = window.emit("download-progress", DownloadProgress {
        model_id: model_id.clone(),
        downloaded: total_size,
        total: total_size,
        percentage: 100.0,
        status: "completed".to_string(),
    });

    log::info!("Model {} downloaded successfully to {}", model_id, model_path.display());

    Ok(DownloadResult {
        success: true,
        message: format!("Model '{}' downloaded successfully", model_id),
        model_path: Some(model_path.to_string_lossy().to_string()),
    })
}

/// Get the path to the whisper model
fn get_model_path(model: &str, language: &str) -> Result<String, String> {
    // Use multilingual model for non-English languages
    // English-only models (.en) only work for English
    let use_multilingual = language != "en";

    let model_name = if use_multilingual {
        // Multilingual models (support all languages including German, Norwegian, etc.)
        match model {
            "tiny" | "tiny.en" => "ggml-tiny.bin",
            "base" | "base.en" => "ggml-base.bin",
            "small" | "small.en" => "ggml-small.bin",
            "medium" | "medium.en" => "ggml-medium.bin",
            "large" => "ggml-large.bin",
            _ => "ggml-base.bin",
        }
    } else {
        // English-only models (faster for English)
        match model {
            "tiny" | "tiny.en" => "ggml-tiny.en.bin",
            "base" | "base.en" => "ggml-base.en.bin",
            "small" | "small.en" => "ggml-small.en.bin",
            "medium" | "medium.en" => "ggml-medium.en.bin",
            "large" => "ggml-large.bin",
            _ => "ggml-base.en.bin",
        }
    };

    log::info!("Looking for model: {} (language: {}, multilingual: {})", model_name, language, use_multilingual);

    // Check common model paths
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();

    // Use PathBuf for cross-platform path handling
    let mut search_paths: Vec<PathBuf> = vec![
        // Our installation directory (most likely location)
        PathBuf::from(&home).join(".voiceintelligence").join("whisper").join(model_name),
        // Common locations
        PathBuf::from(&home).join(".cache").join("whisper").join(model_name),
        PathBuf::from(&home).join("whisper.cpp").join("models").join(model_name),
        PathBuf::from("models").join(model_name),
        PathBuf::from(model_name),
    ];

    // Also check next to the whisper binary if it's in our install dir
    let whisper_dir = PathBuf::from(&home).join(".voiceintelligence").join("whisper");
    if whisper_dir.exists() {
        // Check for model in subdirectories
        search_paths.insert(0, whisper_dir.join("models").join(model_name));
    }

    log::info!("Searching for model {} in paths: {:?}", model_name, search_paths);

    for path in &search_paths {
        if path.exists() {
            let path_str = path.to_string_lossy().to_string();
            log::info!("Found model at: {}", path_str);
            return Ok(path_str);
        }
    }

    // If multilingual model not found for non-English, try English model as fallback
    // (will still work but might transcribe in wrong language)
    if use_multilingual {
        let fallback_model_name = match model {
            "tiny" | "tiny.en" => "ggml-tiny.en.bin",
            "base" | "base.en" => "ggml-base.en.bin",
            "small" | "small.en" => "ggml-small.en.bin",
            "medium" | "medium.en" => "ggml-medium.en.bin",
            "large" => "ggml-large.bin",
            _ => "ggml-base.en.bin",
        };

        let fallback_paths: Vec<PathBuf> = vec![
            PathBuf::from(&home).join(".voiceintelligence").join("whisper").join(fallback_model_name),
            PathBuf::from(&home).join(".cache").join("whisper").join(fallback_model_name),
            PathBuf::from(&home).join("whisper.cpp").join("models").join(fallback_model_name),
        ];

        for path in &fallback_paths {
            if path.exists() {
                let path_str = path.to_string_lossy().to_string();
                log::warn!(
                    "Multilingual model '{}' not found for language '{}'. Using English model '{}' as fallback. For best results, download the multilingual model.",
                    model_name, language, fallback_model_name
                );
                return Ok(path_str);
            }
        }
    }

    let paths_str: Vec<String> = search_paths.iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    let extra_hint = if use_multilingual {
        format!("\n\nFor {} transcription, you need the multilingual model '{}'.\nRe-run the whisper installation or download from:\nhttps://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}", language, model_name, model_name)
    } else {
        String::new()
    };

    Err(format!(
        "Whisper model '{}' not found. Searched in:\n{}{}",
        model_name,
        paths_str.join("\n"),
        extra_hint
    ))
}
