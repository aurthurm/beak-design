use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub connection_id: String,
    pub process_type: String,
    pub command: String,
    pub args: Vec<String>,
}

pub struct ManagedProcess {
    pub info: ProcessInfo,
    pub child: Child,
    pub stdin: Option<ChildStdin>,
    pub stdout_reader: Option<BufReader<ChildStdout>>,
}

pub type ProcessMap = Arc<Mutex<HashMap<String, ManagedProcess>>>;

pub fn create_process_map() -> ProcessMap {
    Arc::new(Mutex::new(HashMap::new()))
}

#[tauri::command]
pub async fn spawn_mcp_server(
    command: String,
    args: Vec<String>,
    state: tauri::State<'_, ProcessMap>,
) -> Result<String, String> {
    spawn_process("mcp".to_string(), command, args, state).await
}

#[tauri::command]
pub async fn spawn_cli_agent(
    tool: String,
    args: Vec<String>,
    state: tauri::State<'_, ProcessMap>,
) -> Result<String, String> {
    spawn_process("cli".to_string(), tool, args, state).await
}

async fn spawn_process(
    process_type: String,
    command: String,
    args: Vec<String>,
    state: tauri::State<'_, ProcessMap>,
) -> Result<String, String> {
    // Generate unique connection ID
    let connection_id = uuid::Uuid::new_v4().to_string();

    // Spawn the process
    let mut child = Command::new(&command)
        .args(&args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn process '{}': {}", command, e))?;

    // Take ownership of stdin and stdout
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to capture stdin".to_string())?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;

    let stdout_reader = BufReader::new(stdout);

    // Create process info
    let info = ProcessInfo {
        connection_id: connection_id.clone(),
        process_type: process_type.clone(),
        command: command.clone(),
        args: args.clone(),
    };

    // Store the process
    let managed_process = ManagedProcess {
        info,
        child,
        stdin: Some(stdin),
        stdout_reader: Some(stdout_reader),
    };

    let mut processes = state.lock().await;
    processes.insert(connection_id.clone(), managed_process);

    Ok(connection_id)
}

#[tauri::command]
pub async fn send_mcp_message(
    connection_id: String,
    message: String,
    state: tauri::State<'_, ProcessMap>,
) -> Result<(), String> {
    let mut processes = state.lock().await;

    let process = processes
        .get_mut(&connection_id)
        .ok_or_else(|| format!("Process with ID '{}' not found", connection_id))?;

    let stdin = process
        .stdin
        .as_mut()
        .ok_or_else(|| "Process stdin not available".to_string())?;

    // Write message to stdin with newline
    let message_with_newline = format!("{}\n", message);
    stdin
        .write_all(message_with_newline.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to stdin: {}", e))?;

    stdin
        .flush()
        .await
        .map_err(|e| format!("Failed to flush stdin: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn read_mcp_response(
    connection_id: String,
    state: tauri::State<'_, ProcessMap>,
) -> Result<String, String> {
    let mut processes = state.lock().await;

    let process = processes
        .get_mut(&connection_id)
        .ok_or_else(|| format!("Process with ID '{}' not found", connection_id))?;

    let stdout_reader = process
        .stdout_reader
        .as_mut()
        .ok_or_else(|| "Process stdout not available".to_string())?;

    // Read one line from stdout
    let mut line = String::new();
    stdout_reader
        .read_line(&mut line)
        .await
        .map_err(|e| format!("Failed to read from stdout: {}", e))?;

    Ok(line)
}

#[tauri::command]
pub async fn kill_process(
    connection_id: String,
    state: tauri::State<'_, ProcessMap>,
) -> Result<(), String> {
    let mut processes = state.lock().await;

    let mut process = processes
        .remove(&connection_id)
        .ok_or_else(|| format!("Process with ID '{}' not found", connection_id))?;

    process
        .child
        .kill()
        .await
        .map_err(|e| format!("Failed to kill process: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn list_processes(state: tauri::State<'_, ProcessMap>) -> Result<Vec<ProcessInfo>, String> {
    let processes = state.lock().await;

    let info_list = processes
        .values()
        .map(|p| p.info.clone())
        .collect();

    Ok(info_list)
}

#[tauri::command]
pub async fn get_process_info(
    connection_id: String,
    state: tauri::State<'_, ProcessMap>,
) -> Result<ProcessInfo, String> {
    let processes = state.lock().await;

    let process = processes
        .get(&connection_id)
        .ok_or_else(|| format!("Process with ID '{}' not found", connection_id))?;

    Ok(process.info.clone())
}
