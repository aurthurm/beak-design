import { logger } from "@ha/shared";
import { Loader2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { DialogContent } from "@/src/components/dialog";
import { useIPC } from "@/src/contexts/ipc-context";
import { BACKEND_HOSTNAME } from "@/src/lib/environment";
import { cn, getRequestOrigin } from "@/src/lib/utils";
import { useModal } from "@/src/ui/modal-manager";
import { platform } from "../platform";

interface Template {
  id: string;
  name: string;
  thumbnail?: string;
}

interface StyleGuide {
  id: string;
  name: string;
  blob_url: string;
  thumbnail_blob_url?: string;
  pen_blob_url?: string;
}

const templates: Template[] = [
  {
    id: "new",
    name: "New .pen file",
    thumbnail: "/images/design-kit-new.png",
  },
  {
    id: "shadcn",
    name: "Shadcn UI",
    thumbnail: "/images/design-kit-shadcn.png",
  },
  {
    id: "lunaris",
    name: "Lunaris",
    thumbnail: "/images/design-kit-lunaris.png",
  },
  {
    id: "halo",
    name: "Halo",
    thumbnail: "/images/design-kit-halo.png",
  },
  {
    id: "nitro",
    name: "Nitro",
    thumbnail: "/images/design-kit-nitro.png",
  },
  {
    id: "welcome",
    name: "Welcome File",
    thumbnail: "/images/design-kit-welcome.png",
  },
];

interface TemplatePickerProps {
  styleGuidesOnly?: boolean;
}

export function TemplatePicker({
  styleGuidesOnly = false,
}: TemplatePickerProps) {
  const baseUri = getRequestOrigin();
  const { ipc, isReady } = useIPC();
  const posthog = usePostHog();
  const { closeModal } = useModal();
  const [styleGuides, setStyleGuides] = useState<StyleGuide[]>([]);
  const [isLoadingStyleGuides, setIsLoadingStyleGuides] = useState(false);

  useEffect(() => {
    const fetchStyleGuides = async () => {
      if (!isReady || !ipc) return;

      setIsLoadingStyleGuides(true);
      try {
        const { email, licenseToken } = await ipc.request<
          void,
          { email?: string; licenseToken?: string }
        >("get-license");

        if (!email || !licenseToken) {
          logger.debug("No license credentials available for style guides");
          return;
        }

        const response = await fetch(
          `${BACKEND_HOSTNAME}/public/style-guides`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              license_token: licenseToken,
              client: platform.isElectron ? "desktop" : "editor",
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          setStyleGuides(data.guides || []);
        }
      } catch (error) {
        logger.error("Failed to fetch style guides:", error);
      } finally {
        setIsLoadingStyleGuides(false);
      }
    };

    fetchStyleGuides();
  }, [ipc, isReady]);

  const handleSelectTemplate = (templateId: string) => {
    logger.debug(`handleSelectTemplate called with id: ${templateId}`);
    posthog.capture(`handleOpenTemplate:${templateId}`);

    // Use desktop-specific welcome file on Electron
    const effectiveTemplateId =
      templateId === "welcome" && platform.isElectron
        ? "welcome-desktop"
        : templateId;

    if (isReady && ipc) {
      ipc.notify("open-document", effectiveTemplateId);
    }

    closeModal();
  };

  const handleSelectStyleGuide = (styleGuide: StyleGuide) => {
    logger.debug(`handleSelectStyleGuide called with id: ${styleGuide.id}`);
    posthog.capture(`handleSelectStyleGuide:${styleGuide.id}`);

    const message = `Use style guide with ID ${styleGuide.id}`;

    if (isReady && ipc) {
      ipc.notify("add-to-chat", message);
    }

    closeModal();
  };

  return (
    <DialogContent
      className={cn(
        "w-[90vw] min-w-[740px] max-w-[1024px] p-1 gap-4 rounded-lg",
        "data-[state=open]:animate-none data-[state=closed]:animate-none",
        "duration-0",
        "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700",
      )}
    >
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto scrollbar-minimal p-4">
        {!styleGuidesOnly && (
          <>
            <div className="flex items-center justify-center">
              <span className="text-[18px] font-semibold leading-[28px] text-zinc-900 dark:text-zinc-100">
                Choose Design System Components
              </span>
            </div>
            <div className="flex flex-wrap gap-8 justify-center">
              {templates
                .filter(
                  (template) => template.id !== "new" || platform.isVSCode,
                )
                .map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={cn(
                      "flex flex-col gap-2 w-[224px] flex-shrink-0 group",
                      "focus:outline-none",
                    )}
                    onClick={() => handleSelectTemplate(template.id)}
                  >
                    <div
                      className={cn(
                        "w-full h-[140px]",
                        "bg-zinc-300 dark:bg-zinc-700",
                        "hover:ring-1",
                        "bg-cover bg-center",
                      )}
                      style={
                        template.thumbnail
                          ? {
                              backgroundImage: `url(${baseUri}${template.thumbnail.startsWith("/") ? template.thumbnail.slice(1) : template.thumbnail})`,
                            }
                          : undefined
                      }
                    />
                    <span className="text-xs font-regular leading-4 text-center text-zinc-700 dark:text-zinc-300">
                      {template.name}
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}

        {/* Style Guides Section */}
        {(styleGuides.length > 0 || isLoadingStyleGuides) && (
          <>
            <div
              className={cn(
                "flex items-center justify-center",
                !styleGuidesOnly && "mt-2",
              )}
            >
              <span className="text-[18px] font-semibold leading-[28px] text-zinc-900 dark:text-zinc-100">
                {styleGuidesOnly
                  ? "Pick a Style Guide"
                  : "Select a Style Guide to apply in chat"}
              </span>
            </div>
            <div className="flex flex-wrap gap-8 justify-center">
              {isLoadingStyleGuides ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                styleGuides.map((styleGuide) => (
                  <button
                    key={styleGuide.id}
                    type="button"
                    className={cn(
                      "flex flex-col gap-3 w-[300px] flex-shrink-0 group",
                      "focus:outline-none",
                    )}
                    onClick={() => handleSelectStyleGuide(styleGuide)}
                  >
                    <div
                      className={cn(
                        "w-full h-[200px]",
                        "bg-zinc-300 dark:bg-zinc-700",
                        "hover:ring-1",
                        "bg-cover bg-center",
                      )}
                      style={
                        styleGuide.thumbnail_blob_url
                          ? {
                              backgroundImage: `url(${styleGuide.thumbnail_blob_url})`,
                            }
                          : undefined
                      }
                    />
                    <span className="text-xxs font-regular leading-4 text-center text-zinc-700 dark:text-zinc-300">
                      {styleGuide.name
                        .replace(/Dashboard$/, "")
                        .replace(/ — Style Guide$/, "")
                        .replace(/Design System$/, "")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </DialogContent>
  );
}
