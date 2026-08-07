use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize, Deserialize, Clone)]
struct ProgressPayload {
    current: u32,
    total: u32,
    percentage: f64,
    message: String,
}

#[derive(Serialize, Clone)]
struct FinishedPayload {
    code: Option<i32>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct ModelDefinition {
    id: String,
    label: String,
    family: String,
    description: String,
    builtin: bool,
    model_name: String,
    path: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct CustomModelManifest {
    id: String,
    label: String,
    family: String,
    model_name: String,
    description: String,
    #[serde(default)]
    model_dir: Option<String>,
}

fn builtin_models() -> Vec<ModelDefinition> {
    vec![
        (
            "realesrgan-x4plus",
            "Real-ESRGAN Plus",
            "realesrgan",
            "실사·일반 영상에 균형 잡힌 선명도",
        ),
        (
            "realesrgan-x4plus-anime",
            "Real-ESRGAN Anime",
            "realesrgan",
            "애니메이션과 일러스트 선 최적화",
        ),
        (
            "realesr-animevideov3",
            "Real-ESRGAN AnimeVideo V3",
            "realesrgan",
            "애니메이션 영상 프레임에 최적화",
        ),
        (
            "realcugan-se",
            "Real-CUGAN SE",
            "realcugan",
            "빠른 처리와 자연스러운 보정",
        ),
        (
            "realcugan-pro",
            "Real-CUGAN Pro",
            "realcugan",
            "실사·애니 공통 고품질 보정",
        ),
        (
            "realcugan-nose",
            "Real-CUGAN NoSe",
            "realcugan",
            "노이즈가 많은 오래된 영상용",
        ),
    ]
    .into_iter()
    .map(|(id, label, family, description)| ModelDefinition {
        id: id.to_string(),
        label: label.to_string(),
        family: family.to_string(),
        description: description.to_string(),
        builtin: true,
        model_name: id.to_string(),
        path: None,
    })
    .collect()
}

fn models_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");
    std::fs::create_dir_all(root.join("custom")).map_err(|e| e.to_string())?;
    Ok(root)
}

fn read_custom_models(app: &AppHandle) -> Result<Vec<ModelDefinition>, String> {
    let root = models_root(app)?.join("custom");
    let mut models = Vec::new();
    for entry in std::fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let manifest_path = entry.path().join("model.json");
        if !manifest_path.is_file() {
            continue;
        }
        let text = match std::fs::read_to_string(&manifest_path) {
            Ok(text) => text,
            Err(_) => continue,
        };
        let manifest: CustomModelManifest = match serde_json::from_str(&text) {
            Ok(manifest) => manifest,
            Err(_) => continue,
        };
        let model_path = manifest
            .model_dir
            .as_ref()
            .filter(|relative| !relative.is_empty())
            .map(|relative| entry.path().join(relative))
            .unwrap_or_else(|| entry.path());
        models.push(ModelDefinition {
            id: manifest.id,
            label: manifest.label,
            family: manifest.family,
            model_name: manifest.model_name,
            description: manifest.description,
            builtin: false,
            path: Some(model_path.to_string_lossy().to_string()),
        });
    }
    models.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));
    Ok(models)
}

#[tauri::command]
fn list_models(app: AppHandle) -> Result<Vec<ModelDefinition>, String> {
    let mut models = builtin_models();
    models.extend(read_custom_models(&app)?);
    Ok(models)
}

fn copy_model_files(source: &Path, destination: &Path) -> Result<Vec<PathBuf>, String> {
    let mut copied = Vec::new();
    let mut stack = vec![source.to_path_buf()];
    while let Some(path) = stack.pop() {
        if path.is_dir() {
            for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
                stack.push(entry.map_err(|e| e.to_string())?.path());
            }
            continue;
        }
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(extension.as_str(), "bin" | "param" | "json") {
            continue;
        }
        let relative = if source.is_dir() {
            path.strip_prefix(source)
                .map_err(|e| e.to_string())?
                .to_path_buf()
        } else {
            PathBuf::from(
                path.file_name()
                    .ok_or("모델 파일 이름을 확인할 수 없습니다")?,
            )
        };
        let target = destination.join(relative);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::copy(&path, &target).map_err(|e| e.to_string())?;
        copied.push(target);
    }
    Ok(copied)
}

#[tauri::command]
fn import_model(
    app: AppHandle,
    source: String,
    family: String,
    label: Option<String>,
) -> Result<ModelDefinition, String> {
    if !matches!(family.as_str(), "realesrgan" | "realcugan") {
        return Err("지원하지 않는 모델 엔진입니다".into());
    }
    let source_path =
        std::fs::canonicalize(&source).map_err(|e| format!("모델 경로를 읽을 수 없습니다: {e}"))?;
    if !source_path.is_dir() && !source_path.is_file() {
        return Err("모델 파일 또는 폴더를 선택해 주세요".into());
    }
    if source_path.is_file() {
        let extension = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(extension.as_str(), "bin" | "param") {
            return Err(".bin 또는 .param 모델 파일을 선택해 주세요".into());
        }
    }

    let root = models_root(&app)?.join("custom");
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let id = format!("custom-{stamp}");
    let destination = root.join(&id);
    std::fs::create_dir_all(&destination).map_err(|e| e.to_string())?;
    let copied = match copy_model_files(&source_path, &destination) {
        Ok(copied) => copied,
        Err(error) => {
            let _ = std::fs::remove_dir_all(&destination);
            return Err(error);
        }
    };
    let has_param = copied.iter().any(|path| {
        path.extension()
            .and_then(|e| e.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("param"))
    });
    let has_bin = copied.iter().any(|path| {
        path.extension()
            .and_then(|e| e.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("bin"))
    });
    if !has_param || !has_bin {
        let _ = std::fs::remove_dir_all(&destination);
        return Err("같은 모델의 .param과 .bin 파일이 모두 포함된 폴더를 선택해 주세요".into());
    }
    let model_file = copied
        .iter()
        .find(|path| {
            path.extension()
                .and_then(|e| e.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("param"))
        })
        .ok_or("모델 파일을 찾을 수 없습니다")?;
    let model_name = model_file
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("모델 이름을 읽을 수 없습니다")?
        .to_string();
    let display_name = label
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            source_path
                .file_stem()
                .or_else(|| source_path.file_name())
                .and_then(|s| s.to_str())
                .unwrap_or("사용자 모델")
                .to_string()
        });
    let manifest = CustomModelManifest {
        id: id.clone(),
        label: display_name.clone(),
        family: family.clone(),
        model_name: model_name.clone(),
        description: "사용자가 추가한 모델".into(),
        model_dir: model_file
            .strip_prefix(&destination)
            .ok()
            .and_then(|relative| relative.parent())
            .filter(|relative| !relative.as_os_str().is_empty())
            .map(|relative| relative.to_string_lossy().to_string()),
    };
    std::fs::write(
        destination.join("model.json"),
        serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let engine_path = manifest
        .model_dir
        .as_ref()
        .filter(|relative| !relative.is_empty())
        .map(|relative| destination.join(relative))
        .unwrap_or_else(|| destination.clone());
    Ok(ModelDefinition {
        id,
        label: display_name,
        family,
        description: manifest.description,
        builtin: false,
        model_name,
        path: Some(engine_path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
fn remove_model(app: AppHandle, model_id: String) -> Result<(), String> {
    if !model_id.starts_with("custom-")
        || model_id
            .chars()
            .any(|character| matches!(character, '/' | '\\' | '.'))
    {
        return Err("기본 제공 모델은 삭제할 수 없습니다".into());
    }
    let target = models_root(&app)?.join("custom").join(model_id);
    if !target.exists() {
        return Err("모델을 찾을 수 없습니다".into());
    }
    std::fs::remove_dir_all(target).map_err(|e| e.to_string())
}

fn find_sidecar_binary(app: &AppHandle, name: &str) -> String {
    if let Ok(resource_dir) = app.path().resource_dir() {
        // Dev mode: resource_dir is src-tauri/, binaries are in binaries/ subdir with triple suffix
        let dev_path = resource_dir
            .join("binaries")
            .join(format!("{}-x86_64-pc-windows-msvc.exe", name));
        if dev_path.exists() {
            return dev_path.to_string_lossy().to_string();
        }

        // Release mode: Tauri strips the triple suffix during bundling
        let release_path = resource_dir.join(format!("{}.exe", name));
        if release_path.exists() {
            return release_path.to_string_lossy().to_string();
        }
    }

    // Fallback: check next to the app executable (some NSIS layouts)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join(format!("{}.exe", name));
            if p.exists() {
                return p.to_string_lossy().to_string();
            }
        }
    }

    name.to_string()
}

#[tauri::command]
async fn start_upscale(
    app: AppHandle,
    input: String,
    output: String,
    scale: u32,
    model: String,
    model_family: Option<String>,
    model_name: Option<String>,
    model_path: Option<String>,
) -> Result<(), String> {
    // Security check: prevents argument injection and ensures paths are valid
    if input.is_empty() || output.is_empty() {
        return Err("Input and output paths cannot be empty".into());
    }
    if input.starts_with('-') || output.starts_with('-') {
        return Err(
            "Invalid path: paths cannot start with '-' to prevent argument injection".into(),
        );
    }
    if !std::path::Path::new(&input).exists() {
        return Err(format!("Input file does not exist: {}", input));
    }

    let ffmpeg_path = find_sidecar_binary(&app, "ffmpeg");
    let ffprobe_path = find_sidecar_binary(&app, "ffprobe");

    let mut sidecar_args = vec![
        "--input".to_string(),
        input.clone(),
        "--output".to_string(),
        output.clone(),
        "--scale".to_string(),
        scale.to_string(),
        "--model".to_string(),
        model.clone(),
        "--ffmpeg".to_string(),
        ffmpeg_path,
        "--ffprobe".to_string(),
        ffprobe_path,
    ];

    if let Some(family) = model_family {
        sidecar_args.extend(["--model-family".to_string(), family]);
    }
    if let Some(name) = model_name {
        sidecar_args.extend(["--model-name".to_string(), name]);
    }
    if let Some(path) = model_path {
        let custom_root = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("models")
            .join("custom");
        let canonical_root = std::fs::canonicalize(&custom_root).map_err(|e| e.to_string())?;
        let canonical_path = std::fs::canonicalize(&path)
            .map_err(|e| format!("모델 경로를 읽을 수 없습니다: {e}"))?;
        if !canonical_path.starts_with(&canonical_root) {
            return Err("허용되지 않은 모델 경로입니다".into());
        }
        sidecar_args.extend([
            "--model-path".to_string(),
            canonical_path.to_string_lossy().to_string(),
        ]);
    }

    let sidecar_command = app
        .shell()
        .sidecar("vibe-engine")
        .map_err(|e| e.to_string())?
        .args(sidecar_args);

    let (mut rx, _child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn(async move {
        let mut stderr_buf: Vec<String> = Vec::new();

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    if let Ok(payload) = serde_json::from_str::<ProgressPayload>(&line_str) {
                        let _ = app.emit("upscale-progress", payload);
                    }
                }
                CommandEvent::Stderr(line) => {
                    let s = String::from_utf8_lossy(&line).trim().to_string();
                    if !s.is_empty() {
                        stderr_buf.push(s);
                    }
                }
                CommandEvent::Terminated(payload) => {
                    let code = payload.code;
                    let error = if code != Some(0) {
                        if !stderr_buf.is_empty() {
                            Some(stderr_buf.join("\n"))
                        } else {
                            Some(format!("Process exited with code {:?}", code))
                        }
                    } else {
                        None
                    };
                    let _ = app.emit("upscale-finished", FinishedPayload { code, error });
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            start_upscale,
            list_models,
            import_model,
            remove_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
