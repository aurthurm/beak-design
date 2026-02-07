import {
  type APIServiceName,
  Bounds,
  colorToCss,
  createNodeProperties,
  FillType,
  PencilEditor,
  type SceneManager,
  type SceneNode,
  StretchMode,
} from "@ha/pencil-editor";
import { type ClaudeConnectionStatus, logger } from "@ha/shared";
import * as Sentry from "@sentry/browser";
import debounce from "lodash.debounce";
import { PanelLeft } from "lucide-react";
import path from "path";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import haloDocument from "../../data/pencil-halo.pen?raw";
import lunarisDocument from "../../data/pencil-lunaris.pen?raw";
import newDocument from "../../data/pencil-new.pen?raw";
import nitroDocument from "../../data/pencil-nitro.pen?raw";
import shadcnDocument from "../../data/pencil-shadcn.pen?raw";
import welcomeDocument from "../../data/pencil-welcome.pen?raw";
import welcomeDocumentDesktop from "../../data/pencil-welcome-desktop.pen?raw";
import { Button } from "../components/button";
import Chat from "../components/chat";
import { Toaster } from "../components/sonner";
import TextEditorOverlay from "../components/text-editor-overlay";
import { Titlebar } from "../components/titlebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { IconDesignKits } from "../components/icons";
import { TemplatePicker } from "../components/template-picker";
import { globalEventEmitter } from "../lib/global-event-emitter";
import { importFiles } from "../importer";
import { useIPC } from "../contexts/ipc-context";
import { useColorScheme } from "../hooks/use-color-scheme";
import { useIsFullscreen } from "../hooks/use-fullscreen";
import { useChat } from "../hooks/useChat";
import {
  BACKEND_HOSTNAME,
  DEV_ENV,
  REVE_API_KEY,
  REVE_API_URL,
  SKIP_LICENSE,
} from "../lib/environment";
import { cn, getRequestOrigin } from "../lib/utils";
import { Config } from "../managers/config";
import { WebInput } from "../managers/input";
import { PixiManager } from "../managers/pixi-manager";
import { PencilWebCanvas } from "../managers/web-canvas";
import { platform } from "../platform";
import { CanvasSelectMenu } from "../ui/canvas-select-menu";
import ImagePanel from "../ui/image-panel";
import { LayerListPanel } from "../ui/layer-list";
import { ModalManager } from "../ui/modal-manager";
import PropertiesPanel, {
  PROPERTIES_PANEL_WIDTH,
} from "../ui/properties-panel";
import ToolsPanel from "../ui/tools-panel";
import VariablesPanel from "../ui/variables-panel";
import { ZoomControls } from "../ui/zoom-controls";
import { Activation } from "./Activation";

const predefinedDocuments: Record<string, string> = {
  "pencil-new.pen": newDocument,
  "pencil-welcome.pen": welcomeDocument,
  "pencil-welcome-desktop.pen": welcomeDocumentDesktop,
  "pencil-shadcn.pen": shadcnDocument,
  "pencil-halo.pen": haloDocument,
  "pencil-lunaris.pen": lunarisDocument,
  "pencil-nitro.pen": nitroDocument,
};

const SceneManagerContext = createContext<SceneManager | undefined>(undefined);

export function useSceneManager(): SceneManager {
  const context = useContext(SceneManagerContext);
  if (!context) {
    throw new Error(
      "useSceneManager must be used within a SceneManagerContext.Provider",
    );
  }
  return context;
}

function LayersButton({
  onToggleLayerList,
  isFullscreen,
}: {
  onToggleLayerList?: () => void;
  isFullscreen?: boolean;
}) {
  // On Mac Electron, leave space for traffic lights unless in fullscreen mode
  const isElectronMac = platform.isElectron && platform.isMac;
  const leftPosition = isElectronMac
    ? isFullscreen
      ? "left-2.5 top-1.5" // Mac Electron fullscreen - traffic lights hidden
      : "left-20 top-1.5" // Mac Electron - traffic lights visible
    : "top-1.5 mb-3 bg-card shadow-md rounded-lg p-1 "; // Normal (VSCode, etc.)

  return (
    <div
      className={cn(
        "tools-panel absolute left-1.5 flex z-100 flex-col pointer-events-auto ",
        leftPosition,
      )}
    >
      <Tooltip key="toggle-layer-list" delayDuration={750}>
        <TooltipTrigger asChild>
          <Button
            variant={"ghost"}
            size="icon"
            onClick={onToggleLayerList}
            aria-label="toggle-layer-list"
            className="w-7 h-7 z-100"
            tabIndex={-1}
          >
            <PanelLeft
              className="w-4 h-4 text-zinc-800 dark:text-zinc-100"
              strokeWidth={1.5}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="flex items-center gap-1.5">Layers</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function DesignKitsButton({ side = "right" }: { side?: "right" | "bottom" }) {
  return (
    <Tooltip key="templates" delayDuration={750}>
      <TooltipTrigger asChild>
        <Button
          variant={"ghost"}
          size="icon"
          onClick={() => {
            globalEventEmitter.emit("openModal", <TemplatePicker />);
          }}
          aria-label="templates"
          className="w-7 h-7 no-drag"
          tabIndex={-1}
        >
          <IconDesignKits className="w-4 h-4 text-zinc-800 dark:text-zinc-100" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side} className="text-xs">
        <p>Design Kits & Style Guides</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface EditorProps {
  file: {
    content: string;
    path: string | null;
    zoomToFit?: boolean;
  } | null;
}

function LeftPanel(props: {
  onToggleImagePanel?: () => void;
  onToggleVariablesPanel?: () => void;
  onToggleDesignMode?: () => void;
  onToggleLayerList: () => void;
  layerListVisible: boolean;
  isFullscreen: boolean;
  isLoggedIn: boolean;
}) {
  return (
    <div
      className="h-full z-10 flex-shrink-0 relative"
      data-pencil-allow-canvas-clipboard
    >
      {props.layerListVisible && <LayerListPanel />}
      <div className="absolute top-0 right-0 bottom-0 translate-x-full pointer-events-none">
        <ToolsPanel
          isLoggedIn={props.isLoggedIn}
          onToggleImagePanel={props.onToggleImagePanel}
          onToggleVariablesPanel={props.onToggleVariablesPanel}
          onToggleDesignMode={props.onToggleDesignMode}
          layersButton={
            platform.isVSCode ? (
              <LayersButton
                onToggleLayerList={props.onToggleLayerList}
                isFullscreen={props.isFullscreen}
              />
            ) : undefined
          }
          designKitsButton={
            platform.isVSCode ? <DesignKitsButton side="right" /> : undefined
          }
        />
      </div>
    </div>
  );
}

const Editor = forwardRef(({ file }: EditorProps, ref) => {
  logger.debug("Editor mounted");
  const posthog = usePostHog();
  /* TODO:
    -  FIX MOUNTING HAPPENING ALL THE TIME
    */
  const mainRef = useRef<HTMLDivElement>(null);
  const [sceneManager, setSceneManager] = useState<SceneManager>();
  const [pencilEditor, setPencilEditor] = useState<PencilEditor>();
  const { colorScheme, toggleTheme, setTheme } = useColorScheme();
  const isFullscreen = useIsFullscreen();
  const [isImagePanelOpen, setIsImagePanelOpen] = useState(false);
  const [isPropertiesPanelCollapsed, setIsPropertiesPanelCollapsed] =
    useState(false);
  const [needsLicense, setNeedsLicense] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [licenseToken, setLicenseToken] = useState("");
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [isVariablesPanelOpen, setIsVariablesPanelOpen] = useState(false);
  const { ipc, isReady } = useIPC();
  const [claudeCodeStatus, setClaudeCodeStatus] = useState<
    ClaudeConnectionStatus | undefined
  >(undefined);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [ideName, setIDEName] = useState<string | undefined>(undefined);
  const [codeMcpDialogOpen, setCodeMcpDialogOpen] = useState(false);
  const [isLayerListVisible, setIsLayerListVisible] = useState(false);
  const [layerListPanelWidth, setLayerListPanelWidth] = useState(0);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  const chat = useChat({
    ipc,
    isReady,
    selectedIDs,
    posthog,
  });

  useImperativeHandle(ref, () => {
    return sceneManager;
  }, [sceneManager]);

  const handleAddImageToCanvas = useCallback(
    (imageUrl: string) => {
      if (sceneManager) {
        // Use a default size for the image, or calculate based on image dimensions if possible
        const imageWidth = 300; // Example width
        const imageHeight = 200; // Example height
        const x = sceneManager.camera.centerX; // Center horizontally
        const y = sceneManager.camera.centerY; // Center vertically

        // TODO(sedivy): The undo is not entirely correct. We would want to
        // record the undo the moment the user does the action to place the
        // image, not when it its asynchronously loaded.
        const block = sceneManager.scenegraph.beginUpdate();

        sceneManager.scenegraph.createAndInsertNode(
          block,
          undefined,
          "rectangle",
          createNodeProperties("rectangle", {
            x: x,
            y: y,
            width: imageWidth,
            height: imageHeight,
            fills: [
              {
                type: FillType.Image,
                url: imageUrl,
                mode: StretchMode.Fit,
                opacityPercent: 100,
                enabled: true,
              },
            ],
          }),
          sceneManager.scenegraph.getViewportNode(),
        );

        sceneManager.scenegraph.commitBlock(block, { undo: true });
      }
    },
    [sceneManager],
  );

  const toggleImagePanel = useCallback(() => {
    setIsImagePanelOpen((prev) => !prev);
  }, []);

  const toggleDesignMode = useCallback(() => {
    ipc?.notify("toggle-design-mode");
  }, [ipc]);

  const toggleVariablesPanel = useCallback(() => {
    setIsVariablesPanelOpen((prev) => !prev);
  }, []);

  const handleToggleLayerList = useCallback(
    (visible: boolean) => {
      setIsLayerListVisible(visible);
      if (visible && sceneManager) {
        setLayerListPanelWidth(sceneManager.config.data.leftPanelWidth);
      } else {
        setLayerListPanelWidth(0);
      }
      if (sceneManager?.config.data.hideSidebarWhenLayersAreOpen) {
        ipc?.notify("set-left-sidebar-visible", { visible: !visible });
      }
    },
    [ipc, sceneManager],
  );

  const toggleLayerList = useCallback(() => {
    const newVisible = !isLayerListVisible;
    handleToggleLayerList(newVisible);
    sceneManager?.config.set("leftPanelOpen", newVisible);
  }, [isLayerListVisible, handleToggleLayerList, sceneManager]);

  // Initialize layer list visibility and subscribe to width changes
  useEffect(() => {
    if (!sceneManager) return;

    // Initialize visibility on first sceneManager availability
    const initialVisible =
      sceneManager.config.data.leftPanelOpen &&
      sceneManager.getContainerBounds().width >= 1200;
    setIsLayerListVisible(initialVisible);
    if (initialVisible) {
      setLayerListPanelWidth(sceneManager.config.data.leftPanelWidth);
    }

    // Subscribe to width changes
    const handleConfigChange = (key: string) => {
      if (key === "leftPanelWidth") {
        setLayerListPanelWidth(sceneManager.config.data.leftPanelWidth);
      }
    };

    sceneManager.config.on("change", handleConfigChange);
    return () => {
      sceneManager.config.removeListener("change", handleConfigChange);
    };
  }, [sceneManager]);

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(colorScheme);

    if (sceneManager) {
      sceneManager.colorScheme = colorScheme;
      sceneManager.requestFrame();
    }
  }, [colorScheme, sceneManager]);

  useEffect(() => {
    const handleColorThemeChanged = (message: { theme: "dark" | "light" }) => {
      if (!platform.isElectron) {
        setTheme(message.theme);
        return;
      }

      // In desktop app, only use the automatic value if no user preference is
      // set yet.
      if (!localStorage.getItem("theme")) {
        setTheme(message.theme);
      }
    };

    const handleClaudeStatus = (status: ClaudeConnectionStatus) => {
      setClaudeCodeStatus(status);
    };

    const handleDirtyChanged = (newIsDirty: boolean) => {
      setIsDirty(newIsDirty);
    };

    const handleIDENameChanged = (ideName: string) => {
      setIDEName(ideName);
    };

    const handleToggleTheme = () => {
      toggleTheme();
    };

    const handleDidSignOut = () => {
      setUserEmail("");
      setDeviceToken("");
    };

    const handleDrop = (e: DragEvent) => {
      if (
        !window.electronAPI ||
        !e.dataTransfer?.files ||
        e.dataTransfer.files.length !== 1
      ) {
        return;
      }

      if (path.extname(e.dataTransfer.files[0].name) !== ".pen") {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const filePath = window.electronAPI.resolveFilePath(
        e.dataTransfer.files[0],
      );

      ipc?.notify("load-file", { filePath, zoomToFit: true });
    };

    const handleDesktopUpdateAvailable = () => {
      toast("Update Available", {
        id: "desktop-update-available",
        description: "Downloading new version…",
        descriptionClassName: "sonner-description",
        duration: 3000,
      });
    };

    const handleDesktopUpdateReady = () => {
      toast("Update Ready To Install", {
        id: "desktop-update-ready",
        description:
          "Can take 10-15 seconds for the app to relaunch automatically",
        descriptionClassName: "sonner-description",
        duration: Infinity,
        action: {
          label: "Restart & Install",
          onClick: () => {
            ipc?.notify("desktop-update-install");
          },
        },
      });
    };

    const handleImportImages = async (payload: { filePaths: string[] }) => {
      if (!sceneManager || !ipc) return;

      const files: File[] = [];
      for (const filePath of payload.filePaths) {
        try {
          const response = await ipc.request<
            { uri: string },
            { filePath: string; fileContents: ArrayBuffer }
          >("import-uri", { uri: `file://${filePath}` });

          const extension = path.extname(filePath).toLowerCase();
          const mimeType =
            extension === ".svg"
              ? "image/svg+xml"
              : extension === ".png"
                ? "image/png"
                : "image/jpeg";

          const file = new File(
            [response.fileContents],
            path.basename(filePath),
            {
              type: mimeType,
            },
          );
          files.push(file);
        } catch (error) {
          logger.error("Failed to read file:", filePath, error);
          toast.error(`Failed to import: ${path.basename(filePath)}`);
        }
      }

      if (files.length > 0) {
        const dataTransfer = new DataTransfer();
        for (const f of files) {
          dataTransfer.items.add(f);
        }

        const x = sceneManager.camera.centerX;
        const y = sceneManager.camera.centerY;
        await importFiles(sceneManager, dataTransfer.files, null, x, y);
      }
    };

    const handleShowCodeMcpDialog = () => {
      setCodeMcpDialogOpen(true);
    };

    if (isReady && ipc) {
      ipc.on("color-theme-changed", handleColorThemeChanged);
      ipc.on("claude-status", handleClaudeStatus);
      ipc.on("dirty-changed", handleDirtyChanged);
      ipc.on("ide-name-changed", handleIDENameChanged);
      ipc.on("toggle-theme", handleToggleTheme);
      ipc.on("did-sign-out", handleDidSignOut);
      ipc.on("desktop-update-available", handleDesktopUpdateAvailable);
      ipc.on("desktop-update-ready", handleDesktopUpdateReady);
      ipc.on("import-images", handleImportImages);
      ipc.on("show-code-mcp-dialog", handleShowCodeMcpDialog);
      document.addEventListener("drop", handleDrop);
    }

    return () => {
      ipc?.off("color-theme-changed", handleColorThemeChanged);
      ipc?.off("claude-status", handleClaudeStatus);
      ipc?.off("dirty-changed", handleDirtyChanged);
      ipc?.off("ide-name-changed", handleIDENameChanged);
      ipc?.off("toggle-theme", handleToggleTheme);
      ipc?.off("did-sign-out", handleDidSignOut);
      ipc?.off("desktop-update-available", handleDesktopUpdateAvailable);
      ipc?.off("desktop-update-ready", handleDesktopUpdateReady);
      ipc?.off("import-images", handleImportImages);
      ipc?.off("show-code-mcp-dialog", handleShowCodeMcpDialog);
      document.removeEventListener("drop", handleDrop);
    };
  }, [isReady, ipc, toggleTheme, setTheme, sceneManager]);

  const fetchRecentFiles = useCallback(async () => {
    if (isReady && ipc && platform.isElectron) {
      try {
        const files = await ipc.request<void, string[]>("get-recent-files");
        setRecentFiles(files);
      } catch (error) {
        // Ignore errors
      }
    }
  }, [isReady, ipc]);

  useEffect(() => {
    fetchRecentFiles();
  }, [fetchRecentFiles]);

  const handleRecentFileClicked = useCallback(
    (filePath: string) => {
      ipc?.notify("load-file", { filePath, zoomToFit: true });
    },
    [ipc],
  );

  const handleClearRecentFiles = useCallback(() => {
    if (ipc) {
      ipc.notify("clear-recent-files");
      setRecentFiles([]);
    }
  }, [ipc]);

  useEffect(() => {
    if (isReady && ipc) {
      if (!mainRef.current) {
        logger.error("mainRef.current is null during setup");
        return;
      }

      if (!window.__PIXI_APP__) {
        const sendAPIRequest = async (
          method: string,
          service: APIServiceName,
          payload: Record<string, unknown>,
        ): Promise<{ success: boolean; [key: string]: any }> => {
          // Special handling for generate-image in dev environment
          if (
            service === "generate-image" &&
            DEV_ENV &&
            REVE_API_KEY &&
            REVE_API_URL
          ) {
            const response = await fetch(REVE_API_URL, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${REVE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                prompt: payload.prompt,
              }),
            });

            if (!response.ok) {
              return { success: false };
            }

            const data = await response.json();
            return { success: true, image: data.image };
          }

          // Get license credentials
          const { email, licenseToken: token } = await ipc.request<
            void,
            { email?: string; licenseToken?: string }
          >("get-license");

          if (!email || !token) {
            throw new Error("No license credentials available");
          }

          const url = `${BACKEND_HOSTNAME}/public/${service}`;

          logger.debug(
            `Sending API request to ${url} with method ${method} and payload ${JSON.stringify(payload)}`,
          );
          logger.debug(`Email: ${email}`);
          logger.debug(`License token: ${token}`);

          const response = await fetch(url, {
            method,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...payload,
              email,
              license_token: token,
              client: platform.isElectron ? "desktop" : "extension",
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `API error ${url} (${response.status}): ${errorText}`,
            );
          }

          const data = await response.json();

          if (data.error) {
            throw new Error(`API error: ${data.error}`);
          }

          return data;
        };

        const setup = async (container: HTMLElement) => {
          const editor = new PencilEditor();
          const containerRect = container.getBoundingClientRect();
          const containerBounds = Bounds.MakeXYWH(
            containerRect.x,
            containerRect.y,
            containerRect.width,
            containerRect.height,
          );

          const pixiManager = await PixiManager.create(container);

          const canvas = document.createElement("canvas");
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.position = "absolute";
          canvas.style.top = "0px";
          canvas.style.left = "0px";
          canvas.style.pointerEvents = "none";

          // NOTE(sedivy): Put the Skia canvas below the pixi canvas. This way
          // we can start to render canvas content with Skia and still use Pixi
          // for the interactive handles.
          container.prepend(canvas);

          const pencilCanvas = new PencilWebCanvas(canvas);

          const canvasKitConfig =
            typeof window !== "undefined" &&
            window.vscodeapi &&
            (window as any).canvaskitWasm
              ? {
                  wasmBinary: (window as any).canvaskitWasm,
                }
              : {
                  locateFile: () => {
                    return `${getRequestOrigin()}assets/pencil.wasm`;
                  },
                };

          await editor.setup({
            canvas: pencilCanvas,
            pixiManager,
            containerBounds,
            colorScheme,
            ipc,
            sendAPIRequest,
            canvasKitConfig,
            config: new Config(),
            errorReportCallback: (error: unknown) => {
              Sentry.captureException(error);
            },
          });

          if (editor.initialized) {
            if (editor.sceneManager) {
              container.style.background = colorToCss(
                editor.sceneManager.getBackgroundColor(),
              );

              const resizeObserver = new ResizeObserver((entries) => {
                if (entries.length === 1) {
                  const rect = container.getBoundingClientRect();

                  const bounds = Bounds.MakeXYWH(
                    rect.x,
                    rect.y,
                    rect.width,
                    rect.height,
                  );
                  editor.onDidResizeContainer(bounds);
                }
              });

              resizeObserver.observe(container);

              const editorInput = new WebInput(editor.sceneManager, container);
              editor.setInput(editorInput);

              editor.on("did-change-cursor", (cursor) => {
                container.style.cursor = cursor;
              });
            }

            setSceneManager(editor.sceneManager);
          }

          editor.on("telemetry", (event: { name: string; args?: object }) => {
            posthog.capture(event.name, event.args);
          });

          setPencilEditor(editor);
        };

        setup(mainRef.current).then(() => {
          logger.debug("PencilEditor is ready, sending initialized message.");
          ipc.notify("initialized");
        });
      }
    } else {
      logger.debug(
        `Waiting for initialization: ipc=${!!ipc}, isReady=${isReady}`,
      );
    }
  }, [ipc, isReady, posthog, colorScheme]);

  useEffect(() => {
    if (sceneManager) {
      // Disable all interactions when license is needed
      sceneManager.setInteractionsEnabled(!needsLicense);
    }
  }, [sceneManager, needsLicense]);

  useEffect(() => {
    if (sceneManager && isReady && ipc) {
      const handleDocumentModified = debounce(() => {
        const jsonData = sceneManager.fileManager.export();
        ipc.notify<{ content: string }>("file-changed", {
          content: jsonData,
        });
      }, 300);

      const handleSelectionChange = (selectedNodes: Set<SceneNode>) => {
        const selectedElementIds = Array.from(
          selectedNodes.values().map((item) => item.id),
        );

        setSelectedIDs(selectedElementIds);
      };

      sceneManager.selectionManager.subscribeSelectionChange(
        handleSelectionChange,
      );

      sceneManager.eventEmitter.on("document-modified", handleDocumentModified);

      logger.info("Processing license...");

      // Verify license
      if (SKIP_LICENSE) {
        setNeedsLicense(false);
      } else {
        ipc
          .request<void, { email?: string; licenseToken?: string }>(
            "get-license",
          )
          .then(async ({ email, licenseToken }) => {
            if (!email || !licenseToken) {
              logger.info("No license found, activation needed");
              setNeedsLicense(true);
            } else {
              // Verify existing license with backend
              const res = await fetch(
                BACKEND_HOSTNAME +
                  "/public/activation?licenseToken=" +
                  encodeURIComponent(licenseToken),
                {
                  method: "GET",
                },
              );

              if (res.ok) {
                logger.info(`License valid for ${email}`);

                setUserEmail(email);
                setLicenseToken(licenseToken);

                posthog.identify(email, {
                  email,
                });

                posthog.register({
                  client: platform.isElectron ? "desktop" : "extension",
                });

                posthog.capture("session-start");
              } else {
                logger.warn("License verification failed, activation needed");
                setNeedsLicense(true);
              }
            }
          })
          .catch((error) => {
            logger.error("Error getting license", error);
            setNeedsLicense(true);
          });
      }

      return () => {
        sceneManager.selectionManager.unsubscribeSelectionChange(
          handleSelectionChange,
        );

        sceneManager.eventEmitter.off(
          "document-modified",
          handleDocumentModified,
        );
      };
    }
  }, [sceneManager, ipc, isReady, posthog]);

  useEffect(() => {
    if (file && sceneManager) {
      logger.debug("Loading design file:", file.path, file.content);
      posthog.capture("load-design-file");
      sceneManager.fileManager.open(file.content, file.path, file.zoomToFit);
      fetchRecentFiles();
    }
  }, [file, sceneManager, posthog, fetchRecentFiles]);

  return (
    <SceneManagerContext.Provider value={sceneManager}>
      <div className="w-full h-full fixed top-0 left-0">
        <div className="h-screen flex relative">
          <div className="flex flex-1 min-w-0 group/editor">
            {platform.isElectron && (
              <Chat
                {...chat}
                selectedIDs={selectedIDs}
                propertiesPanelWidth={
                  sceneManager &&
                  !needsLicense &&
                  selectedIDs.length > 0 &&
                  !isPropertiesPanelCollapsed
                    ? PROPERTIES_PANEL_WIDTH
                    : 0
                }
                layersListPanelWidth={
                  sceneManager && !needsLicense ? layerListPanelWidth : 0
                }
                claudeCodeStatus={claudeCodeStatus}
              />
            )}
            {platform.isElectron && (
              <Titlebar
                title={file?.path?.split("/").pop()}
                isFullscreen={isFullscreen}
                isDirty={isDirty}
                claudeCodeStatus={claudeCodeStatus}
                ideName={ideName}
                isPropertiesPanelVisible={
                  sceneManager &&
                  !needsLicense &&
                  selectedIDs.length > 0 &&
                  !isPropertiesPanelCollapsed
                }
                recentFiles={recentFiles}
                codeMcpDialogOpen={codeMcpDialogOpen}
                onCodeMcpDialogOpenChange={setCodeMcpDialogOpen}
                onHelpClicked={() => {
                  ipc?.notify("claude-status-help-triggered");
                }}
                onOpenTerminal={() => {
                  ipc?.notify("desktop-open-terminal", { runCheck: false });
                }}
                onAddClicked={() => {
                  ipc?.notify("load-file", {
                    filePath: "pencil-new.pen",
                    zoomToFit: true,
                  });
                }}
                onAddToIDEClicked={() => {
                  ipc?.notify("add-extension-to-ide", ideName);
                }}
                onRecentFileClicked={handleRecentFileClicked}
                onClearRecentFiles={handleClearRecentFiles}
                layersButton={
                  <LayersButton
                    onToggleLayerList={toggleLayerList}
                    isFullscreen={isFullscreen}
                  />
                }
                designKitsButton={<DesignKitsButton side="bottom" />}
                toggleTheme={toggleTheme}
                isDarkMode={colorScheme === "dark"}
              />
            )}
            {sceneManager && !needsLicense && (
              <LeftPanel
                onToggleImagePanel={toggleImagePanel}
                onToggleVariablesPanel={toggleVariablesPanel}
                onToggleDesignMode={toggleDesignMode}
                onToggleLayerList={toggleLayerList}
                layerListVisible={isLayerListVisible}
                isFullscreen={isFullscreen}
                isLoggedIn={Boolean(userEmail && licenseToken)}
              />
            )}
            <div className="h-full flex-1 min-w-0 relative">
              <div
                role="application"
                ref={mainRef}
                className="h-full w-full"
                data-pencil-canvas-container
              >
                {sceneManager && <TextEditorOverlay />}
              </div>

              {sceneManager && !needsLicense && (
                <>
                  <CanvasSelectMenu />
                  <ZoomControls />
                </>
              )}
            </div>

            {sceneManager && !needsLicense && (
              <PropertiesPanel
                toggleTheme={toggleTheme}
                isDarkMode={colorScheme === "dark"}
                isCollapsed={isPropertiesPanelCollapsed}
                setIsCollapsed={setIsPropertiesPanelCollapsed}
              />
            )}
          </div>

          {isImagePanelOpen && sceneManager && !needsLicense && (
            <div className="absolute top-0 left-0 z-30 bg-background border rounded-md shadow-lg w-full h-full">
              <ImagePanel
                onClose={toggleImagePanel}
                onAddImageToCanvas={handleAddImageToCanvas}
              />
            </div>
          )}
        </div>

        {isVariablesPanelOpen && sceneManager && (
          <VariablesPanel
            onClose={toggleVariablesPanel}
            propertiesPanelWidth={
              sceneManager &&
              !needsLicense &&
              selectedIDs.length > 0 &&
              !isPropertiesPanelCollapsed
                ? PROPERTIES_PANEL_WIDTH
                : 0
            }
            layersListPanelWidth={
              sceneManager && !needsLicense ? layerListPanelWidth : 0
            }
          />
        )}

        {sceneManager && !needsLicense ? <ModalManager /> : null}

        <Toaster />

        {needsLicense && (
          <Activation onActivation={() => setNeedsLicense(false)} />
        )}
      </div>
    </SceneManagerContext.Provider>
  );
});

function EditorWithFile() {
  const { fileName } = useParams();
  const [file, setFile] = useState<{
    content: string;
    path: string;
    zoomToFit?: boolean;
  } | null>(null);
  const { ipc, isReady } = useIPC();

  useEffect(() => {
    // Handle fileName parameter from URL
    if (fileName && Object.keys(predefinedDocuments).includes(fileName)) {
      setFile({
        path: fileName,
        content: JSON.parse(predefinedDocuments[fileName]),
      });
    }
  }, [fileName]);

  useEffect(() => {
    const handleFileUpdate = (data: {
      content: string;
      filePath: string;
      zoomToFit?: boolean;
    }) => {
      if (
        data.content === "" &&
        Object.keys(predefinedDocuments).includes(data.filePath)
      ) {
        setFile({
          path: data.filePath,
          content: JSON.parse(predefinedDocuments[data.filePath]),
          zoomToFit: data.zoomToFit,
        });

        ipc?.notify<{ content: string }>("file-changed", {
          content: predefinedDocuments[data.filePath],
        });
      } else {
        setFile({
          path: data.filePath,
          content: data.content,
          zoomToFit: data.zoomToFit,
        });
      }
    };
    if (isReady && ipc) {
      ipc.on("file-update", handleFileUpdate);
    }

    return () => {
      ipc?.off("file-update", handleFileUpdate);
    };
  }, [ipc, isReady]);

  useEffect(() => {
    const handleFileError = ({
      filePath,
      errorMessage,
    }: {
      filePath: string;
      errorMessage?: string;
    }) => {
      toast.error(`Failed to open ${filePath}`, {
        id: "file-error",
        description: errorMessage,
        descriptionClassName: "sonner-description text-xxs",
      });
    };
    if (isReady && ipc) {
      ipc.on("file-error", handleFileError);
    }

    return () => {
      ipc?.off("file-error", handleFileError);
    };
  }, [ipc, isReady]);

  return <Editor file={file} />;
}

export default EditorWithFile;
