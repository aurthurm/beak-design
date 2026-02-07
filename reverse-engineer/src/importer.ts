import {
  convertSvgToNodes,
  SceneGraph,
  type SceneManager,
  Skia,
} from "@ha/pencil-editor";
import type * as Schema from "@ha/schema";
import { logger } from "@ha/shared";
import { basename, extname } from "path";
import { toast } from "sonner";
import { getIPC } from "./lib/ipc-singleton";
import { imageFilePicker } from "./lib/utils";

export async function requestNativeImageFileImport(manager: SceneManager) {
  const x = manager.camera.centerX;
  const y = manager.camera.centerY;

  const files = await imageFilePicker({ multiple: true });

  await importFiles(manager, files, null, x, y);
}

export async function importFiles(
  manager: SceneManager,
  files: FileList | null,
  items: DataTransferItemList | null,
  worldX: number,
  worldY: number,
) {
  const block = manager.scenegraph.beginUpdate();

  try {
    const frame = manager.selectionManager.findFrameForPosition(
      worldX,
      worldY,
      undefined,
      undefined,
    );

    const schemaNodes: Schema.Document["children"][0][] = [];

    if (files) {
      for (const item of files) {
        const name = item.name;

        const node = await convertFileToSchemaNode(manager, item, null);
        if (!node) {
          toast.error(`Unable to import file: ${basename(name)}`);
          continue;
        }

        schemaNodes.push(node);
      }
    }

    if (items) {
      for (const item of items) {
        // NOTE(sedivy): text/uri-list is used when dragging files from the vscode/cursor sidebar into the canvas.
        if (item.type === "text/uri-list") {
          const list = await getItemString(item);

          for (const uri of list.split("\n")) {
            const content = await getIPC().request<
              { uri: string },
              { filePath: string; fileContents: ArrayBuffer }
            >("import-uri", {
              uri: uri,
            });

            const extension = extname(content.filePath).toLowerCase();

            const file = new File([content.fileContents], content.filePath, {
              type:
                extension === ".svg"
                  ? "image/svg+xml"
                  : "application/octet-stream",
            });

            const node = await convertFileToSchemaNode(
              manager,
              file,
              content.filePath,
            );
            if (!node) {
              toast.error(`Unable to import file: ${basename(file.name)}`);
              continue;
            }

            schemaNodes.push(node);
          }
        }
      }
    }

    // NOTE(sedivy): We collect all converted nodes first so we can insert them in a single operation.
    const nodes = manager.fileManager.insertNodes(
      block,
      undefined,
      undefined,
      schemaNodes,
      false,
    );

    // TODO(sedivy): We could organize multiple images into a grid.
    for (const node of nodes) {
      if (node.parent && !node.parent.root) {
        continue;
      }

      const bounds = node.getWorldBounds();
      let x = worldX - (bounds.x + bounds.width / 2);
      let y = worldY - (bounds.y + bounds.height / 2);

      if (frame) {
        const local = frame.toLocal(x, y);
        x = local.x;
        y = local.y;

        block.changeParent(node, frame);
      }

      block.update(node, {
        x: x,
        y: y,
      });
    }

    manager.scenegraph.commitBlock(block, { undo: true });

    manager.selectionManager.setSelection(new Set(nodes));
  } catch (error) {
    manager.scenegraph.rollbackBlock(block);
    logger.error("Failed to import file:", error);
    toast.error("Failed to import files.");
  }
}

async function convertFileToSchemaNode(
  manager: SceneManager,
  file: File,
  existingImagePath: string | null,
): Promise<Schema.Document["children"][0] | null> {
  if (file.type === "image/svg+xml") {
    const text = await file.text();
    return convertSvgToNodes(
      manager.skiaRenderer.fontManager,
      basename(file.name),
      text,
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  // NOTE(sedivy): Decode the image first to verify it's valid.
  const node = createImageNodeFromPathAndContent(arrayBuffer);
  if (!node) {
    return null;
  }

  // NOTE(sedivy): If we are converting a file that does not have an existing
  // file path we need to import it to the repo.
  if (!existingImagePath) {
    const ipc = getIPC();

    const filePath = window.electronAPI
      ? window.electronAPI.resolveFilePath(file)
      : file.name;

    const response = await ipc.request<
      { fileName: string; fileContents: ArrayBuffer },
      { filePath: string }
    >("import-file", {
      fileName: filePath,
      fileContents: arrayBuffer,
    });

    existingImagePath = response.filePath;
  }

  node.fill = [{ type: "image", url: existingImagePath, mode: "fill" }];

  return node;
}

function createImageNodeFromPathAndContent(
  arrayBuffer: ArrayBuffer,
): Schema.Rectangle | null {
  // TODO(sedivy): We should extract the width/height in a more efficient way
  // instead of decoding the entire image.
  const decodedImage = Skia.MakeImageFromEncoded(arrayBuffer);
  if (!decodedImage) {
    return null;
  }

  const node: Schema.Rectangle = {
    id: SceneGraph.createUniqueID(),
    type: "rectangle",
    x: 0,
    y: 0,
    width: decodedImage.width(),
    height: decodedImage.height(),
  };

  decodedImage.delete();

  return node;
}

function getItemString(item: DataTransferItem): Promise<string> {
  return new Promise((resolve) => item.getAsString((data) => resolve(data)));
}
