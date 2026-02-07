// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ollama;
mod process_manager;

use tauri::Manager;
use std::sync::mpsc;

#[tauri::command]
async fn open_file_dialog(
  app: tauri::AppHandle,
) -> Result<Option<String>, String> {
  use tauri_plugin_dialog::DialogExt;

  let (tx, rx) = mpsc::channel();

  app.dialog()
    .file()
    .add_filter("Beaki Design Files", &["beaki", "json"])
    .pick_file(move |path| {
      let _ = tx.send(path);
    });

  // Convert sync receiver to async
  match tokio::task::spawn_blocking(move || rx.recv()).await {
    Ok(Ok(Some(path))) => {
      let path_str = match path {
        tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
        tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
      };
      Ok(Some(path_str))
    },
    Ok(Ok(None)) => Ok(None),
    _ => Ok(None), // User cancelled or channel closed
  }
}

#[tauri::command]
async fn save_file_dialog(
  app: tauri::AppHandle,
  default_path: Option<String>,
) -> Result<Option<String>, String> {
  use tauri_plugin_dialog::DialogExt;

  let (tx, rx) = mpsc::channel();

  app.dialog()
    .file()
    .set_file_name(default_path.as_deref().unwrap_or("untitled.beaki"))
    .add_filter("Beaki Design Files", &["beaki", "json"])
    .save_file(move |path| {
      let _ = tx.send(path);
    });

  match tokio::task::spawn_blocking(move || rx.recv()).await {
    Ok(Ok(Some(path))) => {
      let path_str = match path {
        tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
        tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
      };
      Ok(Some(path_str))
    },
    Ok(Ok(None)) => Ok(None),
    _ => Ok(None), // User cancelled or channel closed
  }
}

#[tauri::command]
async fn open_directory_dialog(
  app: tauri::AppHandle,
) -> Result<Option<String>, String> {
  use tauri_plugin_dialog::DialogExt;

  let (tx, rx) = mpsc::channel();

  app.dialog()
    .file()
    .pick_folder(move |path| {
      let _ = tx.send(path);
    });

  match tokio::task::spawn_blocking(move || rx.recv()).await {
    Ok(Ok(Some(path))) => {
      let path_str = match path {
        tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
        tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
      };
      Ok(Some(path_str))
    },
    Ok(Ok(None)) => Ok(None),
    _ => Ok(None), // User cancelled or channel closed
  }
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
  tokio::fs::read_to_string(path)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file(path: String, contents: String) -> Result<(), String> {
  tokio::fs::write(path, contents)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_directory(path: String) -> Result<Vec<String>, String> {
  let mut entries = Vec::new();
  let mut dir = tokio::fs::read_dir(path)
    .await
    .map_err(|e| e.to_string())?;

  while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
    entries.push(entry.path().to_string_lossy().to_string());
  }

  Ok(entries)
}

#[tauri::command]
async fn file_exists(path: String) -> Result<bool, String> {
  Ok(tokio::fs::metadata(path).await.is_ok())
}

#[tauri::command]
async fn is_directory(path: String) -> Result<bool, String> {
  match tokio::fs::metadata(path).await {
    Ok(metadata) => Ok(metadata.is_dir()),
    Err(_) => Ok(false),
  }
}

#[tauri::command]
async fn get_documents_directory() -> Result<String, String> {
  match dirs::document_dir() {
    Some(path) => Ok(path.to_string_lossy().to_string()),
    None => Err("Could not find Documents directory".to_string()),
  }
}

#[tauri::command]
async fn ensure_directory_exists(path: String) -> Result<(), String> {
  tokio::fs::create_dir_all(path)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
  tokio::fs::rename(old_path, new_path)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn detect_cli_tools() -> Result<Vec<serde_json::Value>, String> {
  use std::process::Command;

  let cli_tools = vec!["codex", "geminicli", "claudecode"];
  let mut detected: Vec<serde_json::Value> = Vec::new();

  for tool_name in cli_tools {
    // Check if tool exists in PATH
    let which_output = if cfg!(target_os = "windows") {
      Command::new("where")
        .arg(tool_name)
        .output()
    } else {
      Command::new("which")
        .arg(tool_name)
        .output()
    };

    if let Ok(output) = which_output {
      if output.status.success() {
        let command_path = String::from_utf8_lossy(&output.stdout)
          .trim()
          .to_string();

        if !command_path.is_empty() {
          // Try to get version
          let mut version = "unknown".to_string();
          let version_output = Command::new(tool_name)
            .arg("--version")
            .output();

          if let Ok(ver_output) = version_output {
            if ver_output.status.success() {
              version = String::from_utf8_lossy(&ver_output.stdout)
                .trim()
                .to_string();
            }
          }

          detected.push(serde_json::json!({
            "id": format!("cli-{}", tool_name),
            "name": format!("{} (CLI)", tool_name),
            "type": "cli",
            "status": "available",
            "command": command_path,
            "metadata": {
              "version": version
            }
          }));
        }
      }
    }
  }

  Ok(detected)
}

#[tauri::command]
async fn detect_mcp_servers() -> Result<Vec<serde_json::Value>, String> {
  use std::fs;
  use std::path::PathBuf;

  let mut servers: Vec<serde_json::Value> = Vec::new();

  // Get home directory
  let home_dir = match dirs::home_dir() {
    Some(path) => path,
    None => return Ok(servers), // No home directory, return empty
  };

  // Common MCP server config locations
  let config_paths = vec![
    home_dir.join(".config").join("mcp").join("servers.json"),
    home_dir.join(".mcp").join("servers.json"),
    PathBuf::from(".").join(".mcp").join("servers.json"),
  ];

  for config_path in config_paths {
    if config_path.exists() {
      match fs::read_to_string(&config_path) {
        Ok(content) => {
          match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(config) => {
              // Parse MCP server configs
              if let Some(config_obj) = config.as_object() {
                for (server_id, server_config) in config_obj {
                  if let Some(server_obj) = server_config.as_object() {
                    servers.push(serde_json::json!({
                      "id": format!("mcp-{}", server_id),
                      "name": format!("{} (MCP)", server_id),
                      "type": "mcp",
                      "status": "available",
                      "endpoint": server_obj.get("endpoint"),
                      "command": server_obj.get("command"),
                      "args": server_obj.get("args"),
                      "metadata": {
                        "version": server_obj.get("version")
                      }
                    }));
                  }
                }
              }
            }
            Err(e) => {
              eprintln!("Failed to parse MCP config at {:?}: {}", config_path, e);
            }
          }
        }
        Err(e) => {
          eprintln!("Failed to read MCP config at {:?}: {}", config_path, e);
        }
      }
    }
  }

  Ok(servers)
}

fn main() {
  // Create process manager state
  let process_map = process_manager::create_process_map();

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .manage(process_map)
    .invoke_handler(tauri::generate_handler![
      open_file_dialog,
      save_file_dialog,
      open_directory_dialog,
      read_file,
      write_file,
      read_directory,
      file_exists,
      is_directory,
      get_documents_directory,
      ensure_directory_exists,
      rename_file,
      detect_cli_tools,
      detect_mcp_servers,
      ollama::detect_ollama,
      process_manager::spawn_mcp_server,
      process_manager::spawn_cli_agent,
      process_manager::send_mcp_message,
      process_manager::read_mcp_response,
      process_manager::kill_process,
      process_manager::list_processes,
      process_manager::get_process_info,
    ])
    .setup(|app| {
      let window = app.get_webview_window("main").unwrap();

      // Enable devtools in debug mode
      #[cfg(debug_assertions)]
      {
        window.open_devtools();
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
