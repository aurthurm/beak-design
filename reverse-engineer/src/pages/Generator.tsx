import { useRef, useState, useEffect } from "react";
import type { SceneManager } from "@ha/pencil-editor";
import { logger } from "@ha/shared";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { useIPC } from "../contexts/ipc-context";
import Editor from "./Editor";

export default function Generator() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<any>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const { ipc } = useIPC();

  const sceneManager = useRef<SceneManager>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        setFile({
          path: file.name,
          content: jsonData,
        });
      } catch (error) {
        console.error("Error parsing JSON file:", error);
        alert("Invalid JSON file");
        setSelectedFileName("");
      }
    };
    reader.readAsText(file);
  };

  const handleBrowseClick = async () => {
    if (ipc) {
      try {
        const result = await ipc.request<any, any>(
          "show-open-dialog",
          null,
          90_000,
        );
        if (!result.canceled && result.content && result.fileName) {
          setSelectedFileName(result.fileName);
          try {
            const jsonData = JSON.parse(result.content);
            setFile({
              path: result.filePath || result.fileName,
              content: jsonData,
            });
            showToast(
              `File "${result.fileName}" loaded successfully`,
              "success",
            );
          } catch (error) {
            console.error("Error parsing JSON file:", error);
            showToast("Invalid JSON file", "error");
            setSelectedFileName("");
          }
        }
      } catch (error) {
        console.error("Error opening file dialog:", error);
        showToast("Failed to open file dialog", "error");
      }
    } else {
      // Fall back to HTML file input for browser/VSCode
      fileInputRef.current?.click();
    }
  };

  const handlePasteClick = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        showToast("Clipboard is empty", "error");
        return;
      }

      try {
        const jsonData = JSON.parse(clipboardText);
        setFile({
          path: null,
          jsonData,
        });
        setSelectedFileName("pasted-data.json");
        showToast("JSON data loaded from clipboard", "success");
      } catch (parseError) {
        showToast("Invalid JSON in clipboard", "error");
      }
    } catch (clipboardError) {
      showToast("Failed to read clipboard", "error");
    }
  };

  const handleExport = async () => {
    if (!file.content) {
      return;
    }

    try {
      const currentState = sceneManager.current?.fileManager.export();
      if (!currentState) {
        logger.error("Failed to get current design state");
        alert("Failed to export design. Unable to get current state.");
        return;
      }

      if (ipc) {
        const promptText = promptInputRef.current?.value || "";
        const result = await ipc.request<any, any>(
          "export-design-files",
          {
            beforeContent: JSON.stringify(file.content, null, 2),
            afterContent: currentState,
            promptText: promptText,
          },
          90_000,
        );

        if (result.success) {
          logger.debug(`Files exported successfully to ${result.folderPath}`);
          showToast(
            `Files exported successfully to ${result.folderPath}`,
            "success",
          );
        } else {
          logger.error("Export failed:", result.error);
          if (result.error !== "No folder selected") {
            showToast(`Export failed: ${result.error}`, "error");
          }
        }
      }
    } catch (error) {
      logger.error("Error during export:", error);
      showToast("An error occurred while exporting the design.", "error");
    }
  };

  const TopBar = () => (
    <div className="w-full bg-background border-b border-border p-4">
      <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 w-1/3">
          <Label
            htmlFor="json-file"
            className="text-sm font-medium whitespace-nowrap"
          >
            File:
          </Label>
          <Input
            id="json-file"
            type="text"
            readOnly
            value={selectedFileName}
            placeholder="No file selected"
            className="flex-1 min-w-0"
          />
          <Button onClick={handleBrowseClick} size="sm">
            Browse
          </Button>
          <Button onClick={handlePasteClick} size="sm" variant="outline">
            Paste
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Input
            ref={promptInputRef}
            type="text"
            placeholder="Design prompt..."
            className="flex-1"
          />
          <Button onClick={handleExport} size="sm">
            Export
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.pen"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );

  return (
    <div className="generator w-full h-full bg-background flex flex-col">
      <TopBar />
      {file ? (
        <div className="flex-1">
          <Editor file={file} ref={sceneManager} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Generator</h1>
            <p className="text-muted-foreground">
              Select a JSON or OD file to start editing
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-md shadow-lg max-w-md transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white hover:text-gray-200 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
