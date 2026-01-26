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
