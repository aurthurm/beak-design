import type * as Schema from "@ha/schema";
import { logger } from "@ha/shared";
import type { Resolved, Value } from "../managers/variable-manager";
import { convertBlurRadiusToSigma } from "../skia";
import type { Bounds } from "../utils/bounds";

export enum EffectType {
  DropShadow = 1,
  LayerBlur = 2,
  BackgroundBlur = 3,
}

export type Effect = DropShadowEffect | LayerBlurEffect | BackgroundBlurEffect;

export type DropShadowEffect = {
  type: EffectType.DropShadow;
  enabled: Value<"boolean">;

  color: Value<"color">;
  radius: Value<"number">;
  offsetX: Value<"number">;
  offsetY: Value<"number">;
  spread: Value<"number">;
  blendMode: Schema.BlendMode;
};

export type LayerBlurEffect = {
  type: EffectType.LayerBlur;
  radius: Value<"number">;
  enabled: Value<"boolean">;
};

export type BackgroundBlurEffect = {
  type: EffectType.BackgroundBlur;
  radius: Value<"number">;
  enabled: Value<"boolean">;
};

export function expandBoundingBoxWithEffects(
  effects: Resolved<ReadonlyArray<Readonly<Effect>>> | undefined,
  bounds: Bounds,
) {
  if (!effects) {
    return;
  }

  for (const effect of effects) {
    if (!effect.enabled) {
      continue;
    }

    const type = effect.type;
    switch (type) {
      case EffectType.DropShadow: {
        const blur = convertBlurRadiusToSigma(effect.radius) * 2;

        const x = effect.offsetX;
        const y = effect.offsetY;

        bounds.minX += Math.min(x - blur, 0);
        bounds.minY += Math.min(y - blur, 0);
        bounds.maxX += Math.max(x + blur, 0);
        bounds.maxY += Math.max(y + blur, 0);
        break;
      }

      case EffectType.LayerBlur: {
        const blur = convertBlurRadiusToSigma(effect.radius) * 2;
        bounds.minX -= blur;
        bounds.minY -= blur;
        bounds.maxX += blur;
        bounds.maxY += blur;
        break;
      }

      case EffectType.BackgroundBlur: {
        // Nothing to do
        break;
      }

      default: {
        const missing: never = type;
        logger.warn(`Unknown effect type: ${missing}`);
      }
    }
  }
}
