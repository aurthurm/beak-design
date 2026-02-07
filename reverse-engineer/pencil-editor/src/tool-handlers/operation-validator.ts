import type * as Schema from "@ha/schema";
import { type SceneNode, SizingBehavior } from "../canvas";
import { lookupIconEntry, lookupIconSet, type SceneManager } from "../managers";

export class Validator {
  // NOTE(sedivy): A list of unique warnings. We ignore duplicates to keep
  // the output as small as possible.
  messages: Set<string> = new Set();

  pendingLayoutsToValidate: Set<SceneNode> = new Set();
  processedNodes: Set<SceneNode> = new Set();

  constructor(private manager: SceneManager) {}

  queueLayoutValidation(node: SceneNode) {
    // NOTE(sedivy): We don't want to validate the viewport node.
    if (node.root) {
      return;
    }

    this.pendingLayoutsToValidate.add(node);
  }

  private processPendingValidation(node: SceneNode) {
    if (this.processedNodes.has(node)) {
      return;
    }
    this.processedNodes.add(node);

    // NOTE(sedivy): Verify nodes are not using FillContainer sizing when not inside a layout.
    if (
      !node.isInLayout() &&
      (node.properties.resolved.horizontalSizing ===
        SizingBehavior.FillContainer ||
        node.properties.resolved.verticalSizing ===
          SizingBehavior.FillContainer)
    ) {
      this.messages.add(
        `Node '${node.id}' has 'fill_container' sizing but is not inside a flexbox layout. Make sure parent has 'layout' property set.`,
      );
    }

    // NOTE(sedivy): Verify nodes are not using FitContent sizing when not having a layout.
    if (
      !node.hasLayout() &&
      (node.properties.resolved.horizontalSizing ===
        SizingBehavior.FitContent ||
        node.properties.resolved.verticalSizing === SizingBehavior.FitContent)
    ) {
      this.messages.add(
        `Node '${node.id}' has 'fit_content' sizing but does not have flexbox layout enabled. Set 'layout' property to enable layout.`,
      );
    }

    // NOTE(sedivy): Verify collapsed layout.
    if (node.hasLayout()) {
      for (const sizingProp of [
        "verticalSizing",
        "horizontalSizing",
      ] as const) {
        const axis =
          sizingProp === "horizontalSizing" ? "horizontal" : "vertical";

        if (
          node.properties.resolved[sizingProp] === SizingBehavior.FitContent
        ) {
          // NOTE(sedivy): FitContent sizing with no nodes.
          if (node.children.length === 0) {
            this.messages.add(
              `Node '${node.id}' has 'fit_content' sizing on the ${axis} axis but has no children. This will result in zero size.`,
            );
          } else if (
            // NOTE(sedivy): Circular layout sizing. FitContent size with all children using FillContainer.
            node.children.every(
              (child) =>
                child.properties.resolved[sizingProp] ===
                SizingBehavior.FillContainer,
            )
          ) {
            this.messages.add(
              `Circular layout sizing detected on node '${node.id}': the node has 'fit_content' sizing but all children have 'fill_container' sizing on the ${axis} axis.`,
            );
          }
        }
      }
    }

    // TODO(sedivy): We don't need to validate all children if the
    // change was only on a specific parent property.
    for (const child of node.children) {
      this.processPendingValidation(child);
    }
  }

  // NOTE(sedivy): This method is meant to validate any incoming input
  // properties. We need to do this validation on the input to catch
  // invalid property names and invalid values that would not be stored
  // on the node.
  //
  // This method is called after the properties are applied.
  validateInputProperties(
    node: SceneNode,
    data: Partial<Schema.Child>,
    validateLayout: boolean,
  ) {
    // NOTE(sedivy): Validate x/y are not being used for nodes inside layout.
    // We need to do this check because we are validating the input and not
    // the entity configuration at the end.
    if (node.isInLayout()) {
      if (typeof data.x === "number" || typeof data.y === "number") {
        this.messages.add(
          `Properties 'x' and 'y' are ignored on node '${node.id}' because it is inside a flexbox layout.`,
        );
      }
    }

    switch (node.type) {
      case "text": {
        data = data as Schema.Text;

        // NOTE(sedivy): Validate invalid textColor property name.
        if ((data as any).textColor) {
          // TODO(sedivy): We could be smart and auto-rewrite the input to make it always valid.
          this.messages.add(
            `Property 'textColor' is invalid on text nodes. Use 'fill' instead.`,
          );
        }

        // NOTE(sedivy): Validate fontFamily.
        if (data.fontFamily) {
          if (
            !this.manager.skiaRenderer.fontManager.getFontForFamily(
              data.fontFamily,
            )
          ) {
            this.messages.add(`Font family '${data.fontFamily}' is invalid.`);
          }
        }

        break;
      }

      case "icon_font": {
        data = data as Schema.IconFont;

        // NOTE(sedivy): Validate iconFontFamily and iconFontName.
        if (data.iconFontFamily || data.iconFontName) {
          if (
            node.properties.resolved.iconFontFamily &&
            node.properties.resolved.iconFontName
          ) {
            const iconSet = lookupIconSet(
              node.properties.resolved.iconFontFamily,
            );
            if (!iconSet) {
              this.messages.add(
                `Icon set '${node.properties.resolved.iconFontFamily}' was not found.`,
              );
            } else {
              const icon = lookupIconEntry(
                iconSet,
                node.properties.resolved.iconFontName,
              );
              if (!icon) {
                this.messages.add(
                  `Icon '${node.properties.resolved.iconFontName}' was not found in the '${node.properties.resolved.iconFontFamily}' icon set.`,
                );
              }
            }
          }
        }

        break;
      }
    }

    if (validateLayout) {
      // NOTE(sedivy): Validate full layout a result of add/remove/move operations.
      this.queueLayoutValidation(node);
    } else {
      data = data as Schema.Layout;

      // NOTE(sedivy): Only validate layout if any layout-related properties were changed.
      if (data.width || data.height || data.layout) {
        this.queueLayoutValidation(node);
      }
    }
  }

  result(): string | undefined {
    for (const node of this.pendingLayoutsToValidate) {
      this.processPendingValidation(node);
    }

    if (this.messages.size === 0) {
      return undefined;
    }

    let result = "## Potential issues detected:\n";

    for (const msg of this.messages) {
      result += `- ${msg}\n`;
    }

    result +=
      "\n\nReview these potential issues and attempt to resolve them in subsequent calls.";

    return result;
  }
}
