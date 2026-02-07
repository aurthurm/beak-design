import type GPTImage from "./gptimage";
import { logger } from "@ha/shared";

// --- Constants for Predefined Values ---

// Style
export const IMAGE_STYLES = [
  "Stylized 3D Isometric Illustration",
  "Photorealistic",
  "Pixel Art",
  "Watercolor",
  "Cartoonish",
  "Abstract",
  "Concept Art",
  "Surreal",
  "Minimalist",
  "Vintage",
] as const;

// Scene Type
export const SCENE_TYPES = [
  "Isolated object on a plain background",
  "Full scene with environment",
  "Close-up",
  "Portrait",
  "Landscape",
  "Still Life",
  "Action Scene",
] as const;

// Object Size
export const OBJECT_SIZES = [
  "Small-scale, icon-like representation",
  "Medium-scale, detailed object",
  "Large-scale, dominant object",
  "Life-size",
  "Miniature",
] as const;

// Object Position
export const OBJECT_POSITIONS = [
  "Typically centered or balanced within the frame",
  "Off-center",
  "Foreground",
  "Midground",
  "Background",
  "Floating",
  "Dynamic/In-motion",
] as const;

// Object Material
export const OBJECT_MATERIALS = [
  "Varied and true-to-life (e.g., ceramic, stone, textile, metal, plastic, organic materials like food or plants), rendered with clean surfaces",
  "Ceramic",
  "Stone",
  "Textile",
  "Metal (e.g., brushed, polished, rusted)",
  "Plastic (e.g., matte, glossy)",
  "Wood (e.g., polished, rough-hewn)",
  "Glass",
  "Organic (e.g., food, plants, skin)",
  "Fabric",
  "Leather",
  "Rubber",
] as const;

// Object Surface Texture
export const SURFACE_TEXTURES = [
  "Smooth with appropriate natural textures (e.g., fabric weave, food texture, brushed metal), soft highlights, generally matte to satin finish",
  "Smooth",
  "Rough",
  "Matte",
  "Satin",
  "Glossy",
  "Textured (e.g., fabric weave, wood grain, stone pores)",
  "Metallic Sheen",
  "Velvety",
  "Patterned",
] as const;

// Color Scheme - Primary
export const PRIMARY_COLORS = [
  "Realistic, often slightly muted or pastel-leaning colors",
  "Vibrant",
  "Muted",
  "Pastel",
  "Monochromatic (specify color)",
  "Achromatic (black, white, grey)",
  "Earthy Tones",
  "Cool Colors (blues, greens, purples)",
  "Warm Colors (reds, oranges, yellows)",
  "Neon",
] as const;

// Color Scheme - Secondary
export const SECONDARY_COLORS = [
  "Natural complementary or accent colors that are part of the object itself",
  "Complementary",
  "Analogous",
  "Triadic",
  "Contrasting Accent",
  "Subtle Accent",
  "Harmonious",
] as const;

// Color Scheme - Highlights
export const HIGHLIGHT_STYLES = [
  "Soft, diffused highlights defining form and material properties",
  "Sharp, specular highlights",
  "Broad, soft highlights",
  "Minimal highlights",
  "Colored highlights (specify color)",
  "Glistening",
] as const;

// Color Scheme - Rim Light
export const RIM_LIGHT_STYLES = [
  "Minimal or absent, form is primarily defined by main light and subtle ambient occlusion",
  "Subtle rim light",
  "Pronounced rim light",
  "Colored rim light (specify color)",
  "No rim light",
  "Backlit halo effect",
] as const;

// Environment Elements
export const ENVIRONMENT_ELEMENTS = [
  "Plain, featureless background for each object",
  "Natural (e.g., forest, beach, mountains)",
  "Urban (e.g., city street, modern interior)",
  "Sci-Fi (e.g., spaceship interior, alien planet)",
  "Fantasy (e.g., enchanted forest, castle)",
  "Abstract background",
  "Studio backdrop",
  "Minimalist geometric shapes",
] as const;

// Environment Material (relevant if elements are not plain)
export const ENVIRONMENT_MATERIALS = [
  "N/A (background is a simple white color field)",
  "Natural (e.g., wood, stone, foliage)",
  "Man-made (e.g., concrete, metal, fabric)",
  "Futuristic (e.g., glowing panels, energy fields)",
  "As per environment elements", // Default if specific material not chosen
] as const;

// Environment Scale
export const ENVIRONMENT_SCALES = [
  "N/A (objects are scaled for clarity as icons within their own space)",
  "Microscopic",
  "Close-up of a larger environment",
  "Room-scale",
  "Expansive landscape",
  "Cosmic scale",
] as const;

// Environment Layout
export const ENVIRONMENT_LAYOUTS = [
  "Individual, distinct presentation",
  "Cluttered",
  "Spacious",
  "Symmetrical",
  "Asymmetrical",
  "Layered depth",
  "Open concept",
] as const;

// Lighting Type
export const LIGHTING_TYPES = [
  "Soft, even studio lighting",
  "Direct sunlight",
  "Overcast",
  "Twilight/Golden Hour",
  "Night lighting (e.g., moonlight, artificial city lights)",
  "Dramatic spotlight",
  "Ambient",
  "Backlighting",
  "Rim lighting",
  "Volumetric lighting",
  "Neon lighting",
] as const;

// Lighting Intensity
export const LIGHTING_INTENSITIES = [
  "Moderate, providing clear visibility without harsh shadows or overly bright highlights",
  "Low and moody",
  "Bright and airy",
  "High contrast",
  "Subtle",
  "Intense",
] as const;

// Lighting Direction
export const LIGHTING_DIRECTIONS = [
  "Likely slightly elevated front or top-left, creating soft, subtle grounding shadows",
  "Frontal",
  "Side (Left/Right)",
  "Top-down",
  "Bottom-up (Uplighting)",
  "Backlighting",
  "Three-point lighting (Key, Fill, Back)",
  "Global illumination",
] as const;

// Lighting Accent Colors
export const LIGHTING_ACCENT_COLORS = [
  "Neutral (no strong colored lights observed; colors come from the objects themselves)",
  "Warm (e.g., orange, yellow)",
  "Cool (e.g., blue, purple)",
  "Monochromatic (matching scene)",
  "Contrasting (e.g., blue light on red object)",
  "Multiple accent colors (specify)",
  "No accent colors",
] as const;

// Lighting Reflections
export const LIGHTING_REFLECTIONS = [
  "Subtle, diffuse reflections on materials like metal or ceramics; no sharp mirror-like reflections",
  "None",
  "Diffuse",
  "Sharp/Mirror-like",
  "Anisotropic (e.g., brushed metal)",
  "Environment reflections",
  "Matte (no noticeable reflections)",
] as const;

// Lighting Refractions
export const LIGHTING_REFRACTIONS = [
  "Present if the material naturally requires it (e.g., water in the waterfall icon), but not a general characteristic across all objects",
  "None",
  "Clear (e.g., glass, water)",
  "Distorted (e.g., frosted glass, heat haze)",
  "Caustics present",
  "Material-dependent",
] as const;

// Background Color
export const BACKGROUND_COLORS = [
  "White",
  "Black",
  "Grey (Light/Medium/Dark)",
  "Transparent",
  "Solid color (specify hex or name)",
  "Gradient (specify colors and direction)",
  "Matches environment primary color",
] as const;

// Background Texture
export const BACKGROUND_TEXTURES = [
  "None",
  "Subtle noise",
  "Paper texture",
  "Fabric texture",
  "Concrete texture",
  "Brushed metal texture",
  "Wood grain",
  "Patterned (e.g., geometric, floral)",
] as const;

// Camera Angle
export const CAMERA_ANGLES = [
  "Consistent isometric or slightly off-axis axonometric projection for all objects",
  "Isometric",
  "Axonometric (e.g., Dimetric, Trimetric)",
  "Perspective (e.g., One-point, Two-point, Three-point)",
  "Eye-level",
  "Low angle (worm\'s-eye view)",
  "High angle (bird\'s-eye view)",
  "Dutch angle",
  "Top-down",
  "Front view",
  "Side view",
] as const;

// Camera Focus
export const CAMERA_FOCUS_POINTS = [
  "Entire object in sharp focus",
  "Main subject in focus, background blurred",
  "Foreground in focus",
  "Specific detail in focus",
  "Soft focus",
  "Deep focus (everything sharp)",
] as const;

// Camera Depth of Field
export const CAMERA_DEPTH_OF_FIELDS = [
  "Deep, ensuring all parts of each small object are clear and well-defined",
  "Shallow (strong bokeh)",
  "Moderate",
  "Deep (minimal to no blur)",
  "Tilt-shift effect",
] as const;

// --- Type Definitions ---

export type ImageStyle = (typeof IMAGE_STYLES)[number];
export type SceneType = (typeof SCENE_TYPES)[number];

export type ObjectSize = (typeof OBJECT_SIZES)[number];
export type ObjectPosition = (typeof OBJECT_POSITIONS)[number];
export type ObjectMaterial = (typeof OBJECT_MATERIALS)[number];
export type SurfaceTexture = (typeof SURFACE_TEXTURES)[number];

export type PrimaryColor = (typeof PRIMARY_COLORS)[number];
export type SecondaryColor = (typeof SECONDARY_COLORS)[number];
export type HighlightStyle = (typeof HIGHLIGHT_STYLES)[number];
export type RimLightStyle = (typeof RIM_LIGHT_STYLES)[number];

export interface ColorSchemeOptions {
  primary?: PrimaryColor;
  secondary?: SecondaryColor;
  highlights?: HighlightStyle;
  rim_light?: RimLightStyle;
}

export interface ObjectOptions {
  description?: string; // Allow a free-text description of the object
  size?: ObjectSize;
  position?: ObjectPosition;
  material?: ObjectMaterial;
  surface_texture?: SurfaceTexture;
  color_scheme?: ColorSchemeOptions;
}

export type EnvironmentElement = (typeof ENVIRONMENT_ELEMENTS)[number];
export type EnvironmentMaterial = (typeof ENVIRONMENT_MATERIALS)[number];
export type EnvironmentScale = (typeof ENVIRONMENT_SCALES)[number];
export type EnvironmentLayout = (typeof ENVIRONMENT_LAYOUTS)[number];

export interface EnvironmentOptions {
  elements?: EnvironmentElement;
  material?: EnvironmentMaterial;
  scale?: EnvironmentScale;
  layout?: EnvironmentLayout;
}

export type LightingType = (typeof LIGHTING_TYPES)[number];
export type LightingIntensity = (typeof LIGHTING_INTENSITIES)[number];
export type LightingDirection = (typeof LIGHTING_DIRECTIONS)[number];
export type LightingAccentColor = (typeof LIGHTING_ACCENT_COLORS)[number];
export type LightingReflection = (typeof LIGHTING_REFLECTIONS)[number];
export type LightingRefraction = (typeof LIGHTING_REFRACTIONS)[number];

export interface LightingOptions {
  type?: LightingType;
  intensity?: LightingIntensity;
  direction?: LightingDirection;
  accent_colors?: LightingAccentColor;
  reflections?: LightingReflection;
  refractions?: LightingRefraction;
  dispersion_effects?: boolean;
  bloom?: boolean;
}

export type BackgroundColor = (typeof BACKGROUND_COLORS)[number];
export type BackgroundTextureType = (typeof BACKGROUND_TEXTURES)[number];

export interface BackgroundOptions {
  color?: BackgroundColor;
  vignette?: boolean;
  texture?: BackgroundTextureType;
}

export interface PostProcessingOptions {
  chromatic_aberration?: boolean;
  glow?: boolean;
  high_contrast?: boolean;
  sharp_details?: boolean;
}

export type CameraAngleType = (typeof CAMERA_ANGLES)[number];
export type CameraFocusPoint = (typeof CAMERA_FOCUS_POINTS)[number];
export type CameraDepthOfFieldType = (typeof CAMERA_DEPTH_OF_FIELDS)[number];

export interface CameraOptions {
  angle?: CameraAngleType;
  focus?: CameraFocusPoint;
  depth_of_field?: CameraDepthOfFieldType;
}

export interface ImageGenOptions {
  prompt: string; // Main subject / idea for the image. This is new, essential for image gen.
  style?: ImageStyle;
  scene_type?: SceneType;
  object_details?: ObjectOptions; // Renamed from 'object' to avoid conflict and be more descriptive
  environment?: EnvironmentOptions;
  lighting?: LightingOptions;
  background?: BackgroundOptions;
  post_processing?: PostProcessingOptions;
  camera?: CameraOptions;
  negative_prompt?: string; // Things to avoid in the image
  seed?: number; // For reproducibility
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"; // Common aspect ratios
}

// Default options based on the user's JSON, but allowing for overrides
export const DEFAULT_IMAGE_OPTIONS: Omit<ImageGenOptions, "prompt"> = {
  style: "Stylized 3D Isometric Illustration",
  scene_type: "Isolated object on a plain background",
  object_details: {
    size: "Small-scale, icon-like representation",
    position: "Typically centered or balanced within the frame",
    material:
      "Varied and true-to-life (e.g., ceramic, stone, textile, metal, plastic, organic materials like food or plants), rendered with clean surfaces",
    surface_texture:
      "Smooth with appropriate natural textures (e.g., fabric weave, food texture, brushed metal), soft highlights, generally matte to satin finish",
    color_scheme: {
      primary: "Realistic, often slightly muted or pastel-leaning colors",
      secondary:
        "Natural complementary or accent colors that are part of the object itself",
      highlights:
        "Soft, diffused highlights defining form and material properties",
      rim_light:
        "Minimal or absent, form is primarily defined by main light and subtle ambient occlusion",
    },
  },
  environment: {
    elements: "Plain, featureless background for each object",
    material: "N/A (background is a simple white color field)",
    scale:
      "N/A (objects are scaled for clarity as icons within their own space)",
    layout: "Individual, distinct presentation",
  },
  lighting: {
    type: "Soft, even studio lighting",
    intensity:
      "Moderate, providing clear visibility without harsh shadows or overly bright highlights",
    direction:
      "Likely slightly elevated front or top-left, creating soft, subtle grounding shadows",
    accent_colors:
      "Neutral (no strong colored lights observed; colors come from the objects themselves)",
    reflections:
      "Subtle, diffuse reflections on materials like metal or ceramics; no sharp mirror-like reflections",
    refractions:
      "Present if the material naturally requires it (e.g., water in the waterfall icon), but not a general characteristic across all objects",
    dispersion_effects: false,
    bloom: false,
  },
  background: {
    color: "White",
    vignette: false,
    texture: "None",
  },
  post_processing: {
    chromatic_aberration: false,
    glow: false,
    high_contrast: false,
    sharp_details: true,
  },
  camera: {
    angle:
      "Consistent isometric or slightly off-axis axonometric projection for all objects",
    focus: "Entire object in sharp focus",
    depth_of_field:
      "Deep, ensuring all parts of each small object are clear and well-defined",
  },
  aspect_ratio: "1:1", // Default aspect ratio
};

export class ImageGen {
  private backend: GPTImage;

  constructor(backend: GPTImage) {
    this.backend = backend;
  }

  private buildPrompt(options: ImageGenOptions): string {
    let fullPrompt = options.prompt; // Start with the core subject

    if (options.style) {
      fullPrompt += `, ${options.style}`;
    }
    if (options.scene_type) {
      fullPrompt += `, ${options.scene_type}`;
    }

    if (options.object_details) {
      const {
        description,
        size,
        position,
        material,
        surface_texture,
        color_scheme,
      } = options.object_details;
      if (description) {
        fullPrompt += `, object: ${description}`;
      }
      if (size) {
        fullPrompt += `, object size: ${size}`;
      }
      if (position) {
        fullPrompt += `, object position: ${position}`;
      }
      if (material) {
        fullPrompt += `, object material: ${material}`;
      }
      if (surface_texture) {
        fullPrompt += `, object surface texture: ${surface_texture}`;
      }
      if (color_scheme) {
        let colorDesc = "color scheme: ";
        const { primary, secondary, highlights, rim_light } = color_scheme;
        if (primary) colorDesc += `primary ${primary}, `;
        if (secondary) colorDesc += `secondary ${secondary}, `;
        if (highlights) colorDesc += `highlights ${highlights}, `;
        if (rim_light) colorDesc += `rim light ${rim_light}`;
        fullPrompt += `, ${colorDesc.replace(/, $/, "")}`; // remove trailing comma
      }
    }

    if (options.environment) {
      const { elements, material, scale, layout } = options.environment;
      let envDesc = "environment: ";
      if (elements) envDesc += `${elements}, `;
      if (
        material &&
        material !== "N/A (background is a simple white color field)"
      )
        envDesc += `material ${material}, `;
      if (
        scale &&
        scale !==
          "N/A (objects are scaled for clarity as icons within their own space)"
      )
        envDesc += `scale ${scale}, `;
      if (layout) envDesc += `layout ${layout}`;
      if (envDesc !== "environment: ") {
        fullPrompt += `, ${envDesc.replace(/, $/, "")}`;
      }
    }

    if (options.lighting) {
      const {
        type,
        intensity,
        direction,
        accent_colors,
        reflections,
        refractions,
        dispersion_effects,
        bloom,
      } = options.lighting;
      let lightDesc = "lighting: ";
      if (type) lightDesc += `${type}, `;
      if (intensity) lightDesc += `intensity ${intensity}, `;
      if (direction) lightDesc += `direction ${direction}, `;
      if (
        accent_colors &&
        accent_colors !==
          "Neutral (no strong colored lights observed; colors come from the objects themselves)"
      )
        lightDesc += `accent colors ${accent_colors}, `;
      if (reflections) lightDesc += `reflections ${reflections}, `;
      if (refractions) lightDesc += `refractions ${refractions}, `;
      if (dispersion_effects) lightDesc += `dispersion effects, `;
      if (bloom) lightDesc += `bloom effect, `;
      if (lightDesc !== "lighting: ") {
        fullPrompt += `, ${lightDesc.replace(/, $/, "").replace(/, $/, "")}`;
      }
    }

    if (options.background) {
      const { color, vignette, texture } = options.background;
      let bgDesc = "background: ";
      if (color) bgDesc += `color ${color}, `;
      if (vignette) bgDesc += `vignette effect, `;
      if (texture && texture !== "None") bgDesc += `texture ${texture}`;
      if (bgDesc !== "background: ") {
        fullPrompt += `, ${bgDesc.replace(/, $/, "")}`;
      }
    }

    if (options.post_processing) {
      const { chromatic_aberration, glow, high_contrast, sharp_details } =
        options.post_processing;
      let ppDesc = "post-processing: ";
      const ppEffects: string[] = [];
      if (chromatic_aberration) ppEffects.push("chromatic aberration");
      if (glow) ppEffects.push("glow effect");
      if (high_contrast) ppEffects.push("high contrast");
      if (sharp_details) ppEffects.push("sharp details");
      if (ppEffects.length > 0) {
        ppDesc += ppEffects.join(", ");
        fullPrompt += `, ${ppDesc}`;
      }
    }

    if (options.camera) {
      const { angle, focus, depth_of_field } = options.camera;
      let camDesc = "camera: ";
      if (angle) camDesc += `angle ${angle}, `;
      if (focus) camDesc += `focus on ${focus}, `;
      if (depth_of_field) camDesc += `depth of field ${depth_of_field}`;
      if (camDesc !== "camera: ") {
        fullPrompt += `, ${camDesc.replace(/, $/, "")}`;
      }
    }

    if (options.aspect_ratio) {
      fullPrompt += `, aspect ratio ${options.aspect_ratio}`;
    }

    fullPrompt = fullPrompt.replace(/\s+/g, " ").trim();
    if (fullPrompt.endsWith(",")) {
      fullPrompt = fullPrompt.slice(0, -1);
    }

    return fullPrompt;
  }

  public async generateImage(userOptions: ImageGenOptions): Promise<string> {
    const combinedOptions: ImageGenOptions = {
      ...DEFAULT_IMAGE_OPTIONS,
      ...userOptions,
      object_details: {
        ...DEFAULT_IMAGE_OPTIONS.object_details,
        ...userOptions.object_details,
        color_scheme: {
          ...DEFAULT_IMAGE_OPTIONS.object_details?.color_scheme,
          ...userOptions.object_details?.color_scheme,
        },
      },
      environment: {
        ...DEFAULT_IMAGE_OPTIONS.environment,
        ...userOptions.environment,
      },
      lighting: {
        ...DEFAULT_IMAGE_OPTIONS.lighting,
        ...userOptions.lighting,
      },
      background: {
        ...DEFAULT_IMAGE_OPTIONS.background,
        ...userOptions.background,
      },
      post_processing: {
        ...DEFAULT_IMAGE_OPTIONS.post_processing,
        ...userOptions.post_processing,
      },
      camera: {
        ...DEFAULT_IMAGE_OPTIONS.camera,
        ...userOptions.camera,
      },
    };

    const prompt = this.buildPrompt(combinedOptions);

    const backendOptions: any = {};
    if (combinedOptions.seed) backendOptions.seed = combinedOptions.seed;
    if (combinedOptions.negative_prompt)
      backendOptions.negative_prompt = combinedOptions.negative_prompt;
    if (combinedOptions.aspect_ratio)
      backendOptions.aspect_ratio = combinedOptions.aspect_ratio;

    try {
      logger.debug("Generated Prompt:", prompt); // For debugging
      const imageUrl = await this.backend.generate(prompt, backendOptions);
      logger.debug("Image URL returned from backend"); // For debugging
      return imageUrl;
    } catch (error) {
      logger.error("Error generating image:", error);
      throw new Error("Failed to generate image via backend.");
    }
  }
}

// Example Usage (Illustrative - GPTImage needs to be implemented/mocked)
/*
// Mock GPTImage backend
class MockGPTImage implements GPTImage {
  async generate(prompt: string, options?: any): Promise<string> {
    logger.debug("MockGPTImage received prompt:", prompt);
    logger.debug("MockGPTImage received options:", options);
    return `https://example.com/generated-image-for-${prompt.substring(0, 20).replace(/\s/g, '_')}.png`;
  }
}

async function testImageGen() {
  const mockBackend = new MockGPTImage();
  const imageGenerator = new ImageGen(mockBackend);

  try {
    const imageUrl = await imageGenerator.generateImage({
      prompt: "A majestic red dragon soaring through a stormy sky",
      style: "Concept Art",
      object_details: {
        description: "A large, fearsome red dragon with golden eyes and sharp claws.",
        material: "Scales with a metallic sheen"
      },
      lighting: {
        type: "Dramatic spotlight",
        accent_colors: "Flashes of lightning"
      },
      camera: {
        angle: "Low angle (worm\'s-eye view)"
      },
      negative_prompt: "cartoon, cute, friendly",
      seed: 12345,
      aspect_ratio: "16:9"
    });
    logger.debug("Generated Image URL:", imageUrl);

    const iconUrl = await imageGenerator.generateImage({
        prompt: "A sleek, modern smartphone icon",
        object_details: {
            description: "A dark grey smartphone with a glowing screen"
        }
    });
    logger.debug("Generated Icon URL:", iconUrl);


  } catch (error) {
    logger.error("Test failed:", error);
  }
}

testImageGen();
*/
