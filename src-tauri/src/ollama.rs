use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub modified_at: String,
    pub size: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaTagsResponse {
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Serialize)]
pub struct OllamaDetectionResult {
    pub available: bool,
    pub models: Vec<OllamaModel>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn detect_ollama() -> Result<OllamaDetectionResult, String> {
    let url = "http://localhost:11434/api/tags";

    match reqwest::get(url).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<OllamaTagsResponse>().await {
                    Ok(tags) => Ok(OllamaDetectionResult {
                        available: true,
                        models: tags.models,
                        error: None,
                    }),
                    Err(e) => Ok(OllamaDetectionResult {
                        available: false,
                        models: vec![],
                        error: Some(format!("Failed to parse Ollama response: {}", e)),
                    }),
                }
            } else {
                Ok(OllamaDetectionResult {
                    available: false,
                    models: vec![],
                    error: Some(format!("Ollama returned status: {}", response.status())),
                })
            }
        }
        Err(e) => {
            // Connection error - Ollama is not running
            Ok(OllamaDetectionResult {
                available: false,
                models: vec![],
                error: Some(format!("Ollama not available: {}", e)),
            })
        }
    }
}
