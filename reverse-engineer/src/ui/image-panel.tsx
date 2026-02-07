import type React from "react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/accordion";
// Remove direct import of GPTImage and ImageGen for instantiation client-side for generation
import { Button } from "../components/button";
import { Checkbox } from "../components/checkbox";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { ScrollArea } from "../components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import { Textarea } from "../components/textarea";
import { logger } from "@ha/shared";
import * as ImageGenOptions from "../services/imagegen";

// Default options from your imagegen service
const DEFAULTS = ImageGenOptions.DEFAULT_IMAGE_OPTIONS;

interface ImagePanelProps {
  onClose: () => void;
  onAddImageToCanvas: (imageUrl: string) => void;
}

const ImagePanel: React.FC<ImagePanelProps> = ({
  onClose,
  onAddImageToCanvas,
}) => {
  const [prompt, setPrompt] = useState<string>(""); // Prompt remains user-defined
  const [negativePrompt, setNegativePrompt] = useState<string>(
    DEFAULTS.negative_prompt || "",
  );
  const [seed, setSeed] = useState<number | undefined>(DEFAULTS.seed);
  const [aspectRatio, setAspectRatio] = useState<
    ImageGenOptions.ImageGenOptions["aspect_ratio"]
  >(DEFAULTS.aspect_ratio || "1:1");

  const [selectedStyle, setSelectedStyle] = useState<
    ImageGenOptions.ImageStyle | ""
  >(DEFAULTS.style || "");
  const [selectedSceneType, setSelectedSceneType] = useState<
    ImageGenOptions.SceneType | ""
  >(DEFAULTS.scene_type || "");

  // Object Details State
  const [objectDescription, setObjectDescription] = useState<string>(
    DEFAULTS.object_details?.description || "",
  );
  const [objectSize, setObjectSize] = useState<ImageGenOptions.ObjectSize | "">(
    DEFAULTS.object_details?.size || "",
  );
  const [objectPosition, setObjectPosition] = useState<
    ImageGenOptions.ObjectPosition | ""
  >(DEFAULTS.object_details?.position || "");
  const [objectMaterial, setObjectMaterial] = useState<
    ImageGenOptions.ObjectMaterial | ""
  >(DEFAULTS.object_details?.material || "");
  const [objectSurfaceTexture, setObjectSurfaceTexture] = useState<
    ImageGenOptions.SurfaceTexture | ""
  >(DEFAULTS.object_details?.surface_texture || "");
  // Object Color Scheme State
  const [objectColorPrimary, setObjectColorPrimary] = useState<
    ImageGenOptions.PrimaryColor | ""
  >(DEFAULTS.object_details?.color_scheme?.primary || "");
  const [objectColorSecondary, setObjectColorSecondary] = useState<
    ImageGenOptions.SecondaryColor | ""
  >(DEFAULTS.object_details?.color_scheme?.secondary || "");
  const [objectColorHighlights, setObjectColorHighlights] = useState<
    ImageGenOptions.HighlightStyle | ""
  >(DEFAULTS.object_details?.color_scheme?.highlights || "");
  const [objectColorRimLight, setObjectColorRimLight] = useState<
    ImageGenOptions.RimLightStyle | ""
  >(DEFAULTS.object_details?.color_scheme?.rim_light || "");

  // Environment State
  const [envElements, setEnvElements] = useState<
    ImageGenOptions.EnvironmentElement | ""
  >(DEFAULTS.environment?.elements || "");
  const [envMaterial, setEnvMaterial] = useState<
    ImageGenOptions.EnvironmentMaterial | ""
  >(DEFAULTS.environment?.material || "");
  const [envScale, setEnvScale] = useState<
    ImageGenOptions.EnvironmentScale | ""
  >(DEFAULTS.environment?.scale || "");
  const [envLayout, setEnvLayout] = useState<
    ImageGenOptions.EnvironmentLayout | ""
  >(DEFAULTS.environment?.layout || "");

  // Lighting State
  const [lightingType, setLightingType] = useState<
    ImageGenOptions.LightingType | ""
  >(DEFAULTS.lighting?.type || "");
  const [lightingIntensity, setLightingIntensity] = useState<
    ImageGenOptions.LightingIntensity | ""
  >(DEFAULTS.lighting?.intensity || "");
  const [lightingDirection, setLightingDirection] = useState<
    ImageGenOptions.LightingDirection | ""
  >(DEFAULTS.lighting?.direction || "");
  const [lightingAccentColors, setLightingAccentColors] = useState<
    ImageGenOptions.LightingAccentColor | ""
  >(DEFAULTS.lighting?.accent_colors || "");
  const [lightingReflections, setLightingReflections] = useState<
    ImageGenOptions.LightingReflection | ""
  >(DEFAULTS.lighting?.reflections || "");
  const [lightingRefractions, setLightingRefractions] = useState<
    ImageGenOptions.LightingRefraction | ""
  >(DEFAULTS.lighting?.refractions || "");
  const [lightingDispersionEffects, setLightingDispersionEffects] =
    useState<boolean>(DEFAULTS.lighting?.dispersion_effects || false);
  const [lightingBloom, setLightingBloom] = useState<boolean>(
    DEFAULTS.lighting?.bloom || false,
  );

  // Background State
  const [bgColor, setBgColor] = useState<ImageGenOptions.BackgroundColor | "">(
    DEFAULTS.background?.color || "",
  );
  const [bgVignette, setBgVignette] = useState<boolean>(
    DEFAULTS.background?.vignette || false,
  );
  const [bgTexture, setBgTexture] = useState<
    ImageGenOptions.BackgroundTextureType | ""
  >(DEFAULTS.background?.texture || "");

  // PostProcessing State
  const [ppChromaticAberration, setPpChromaticAberration] = useState<boolean>(
    DEFAULTS.post_processing?.chromatic_aberration || false,
  );
  const [ppGlow, setPpGlow] = useState<boolean>(
    DEFAULTS.post_processing?.glow || false,
  );
  const [ppHighContrast, setPpHighContrast] = useState<boolean>(
    DEFAULTS.post_processing?.high_contrast || false,
  );
  const [ppSharpDetails, setPpSharpDetails] = useState<boolean>(
    DEFAULTS.post_processing?.sharp_details || false,
  );

  // Camera State
  const [cameraAngle, setCameraAngle] = useState<
    ImageGenOptions.CameraAngleType | ""
  >(DEFAULTS.camera?.angle || "");
  const [cameraFocus, setCameraFocus] = useState<
    ImageGenOptions.CameraFocusPoint | ""
  >(DEFAULTS.camera?.focus || "");
  const [cameraDof, setCameraDof] = useState<
    ImageGenOptions.CameraDepthOfFieldType | ""
  >(DEFAULTS.camera?.depth_of_field || "");

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Remove direct service instantiation here
  // const gptImageService = new GPTImage();
  // const imageGenService = new ImageGen(gptImageService);

  const handleAddImage = () => {
    if (imageUrl) {
      onAddImageToCanvas(imageUrl);
      onClose(); // Close the panel after adding the image
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setImageUrl(null);
    const options: ImageGenOptions.ImageGenOptions = {
      prompt,
      style: selectedStyle || undefined,
      scene_type: selectedSceneType || undefined,
      object_details: {
        description: objectDescription || undefined,
        size: objectSize || undefined,
        position: objectPosition || undefined,
        material: objectMaterial || undefined,
        surface_texture: objectSurfaceTexture || undefined,
        color_scheme: {
          primary: objectColorPrimary || undefined,
          secondary: objectColorSecondary || undefined,
          highlights: objectColorHighlights || undefined,
          rim_light: objectColorRimLight || undefined,
        },
      },
      environment: {
        elements: envElements || undefined,
        material: envMaterial || undefined,
        scale: envScale || undefined,
        layout: envLayout || undefined,
      },
      lighting: {
        type: lightingType || undefined,
        intensity: lightingIntensity || undefined,
        direction: lightingDirection || undefined,
        accent_colors: lightingAccentColors || undefined,
        reflections: lightingReflections || undefined,
        refractions: lightingRefractions || undefined,
        dispersion_effects: lightingDispersionEffects,
        bloom: lightingBloom,
      },
      background: {
        color: bgColor || undefined,
        vignette: bgVignette,
        texture: bgTexture || undefined,
      },
      post_processing: {
        chromatic_aberration: ppChromaticAberration,
        glow: ppGlow,
        high_contrast: ppHighContrast,
        sharp_details: ppSharpDetails,
      },
      camera: {
        angle: cameraAngle || undefined,
        focus: cameraFocus || undefined,
        depth_of_field: cameraDof || undefined,
      },
      negative_prompt: negativePrompt || undefined,
      seed: seed,
      aspect_ratio: aspectRatio,
    };
    logger.debug("Generating image with options (client-side):", options);

    try {
      logger.debug("Fetching image with options (client-side):", options);
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      });

      // console.log("Response:", response);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.imageUrl) {
        setImageUrl(result.imageUrl);
        logger.info("Image generated (client-side):", result.imageUrl);
      } else {
        throw new Error("Image URL not found in API response.");
      }
    } catch (error: any) {
      logger.error("Error generating image (client-side):", error);
      // Update UI to show error message to user if needed
      setImageUrl(null); // Clear previous image if any
    } finally {
      setIsLoading(false);
    }
  };

  const accordionItemsCol1 = [
    {
      value: "object_details",
      title: "Object Details",
      content: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="object_description" className="block mb-1">
              Object Description:{" "}
            </Label>
            <Input
              type="text"
              id="object_description"
              value={objectDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setObjectDescription(e.target.value)
              }
              placeholder="e.g., a red apple"
            />
          </div>
          <div>
            <Label htmlFor="object_size" className="block mb-1">
              Object Size:{" "}
            </Label>
            <Select
              value={objectSize}
              onValueChange={(value) =>
                setObjectSize(value as ImageGenOptions.ObjectSize | "")
              }
            >
              <SelectTrigger id="object_size">
                <SelectValue placeholder="-- Select Object Size --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.OBJECT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="object_position" className="block mb-1">
              Object Position:{" "}
            </Label>
            <Select
              value={objectPosition}
              onValueChange={(value) =>
                setObjectPosition(value as ImageGenOptions.ObjectPosition | "")
              }
            >
              <SelectTrigger id="object_position">
                <SelectValue placeholder="-- Select Object Position --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.OBJECT_POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="object_material" className="block mb-1">
              Object Material:{" "}
            </Label>
            <Select
              value={objectMaterial}
              onValueChange={(value) =>
                setObjectMaterial(value as ImageGenOptions.ObjectMaterial | "")
              }
            >
              <SelectTrigger id="object_material">
                <SelectValue placeholder="-- Select Object Material --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.OBJECT_MATERIALS.map((mat) => (
                  <SelectItem key={mat} value={mat}>
                    {mat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="object_surface_texture" className="block mb-1">
              Surface Texture:{" "}
            </Label>
            <Select
              value={objectSurfaceTexture}
              onValueChange={(value) =>
                setObjectSurfaceTexture(
                  value as ImageGenOptions.SurfaceTexture | "",
                )
              }
            >
              <SelectTrigger id="object_surface_texture">
                <SelectValue placeholder="-- Select Surface Texture --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.SURFACE_TEXTURES.map((tex) => (
                  <SelectItem key={tex} value={tex}>
                    {tex}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Accordion
            type="single"
            collapsible
            className="w-full pl-4"
            defaultValue="object_color_scheme"
          >
            <AccordionItem value="object_color_scheme">
              <AccordionTrigger className="text-sm font-medium">
                Color Scheme
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-3">
                <div>
                  <Label htmlFor="color_primary" className="block mb-1">
                    Primary Color:{" "}
                  </Label>
                  <Select
                    value={objectColorPrimary}
                    onValueChange={(value) =>
                      setObjectColorPrimary(
                        value as ImageGenOptions.PrimaryColor | "",
                      )
                    }
                  >
                    <SelectTrigger id="color_primary">
                      <SelectValue placeholder="-- Select Primary Color --" />
                    </SelectTrigger>
                    <SelectContent>
                      {ImageGenOptions.PRIMARY_COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="color_secondary" className="block mb-1">
                    Secondary Color:{" "}
                  </Label>
                  <Select
                    value={objectColorSecondary}
                    onValueChange={(value) =>
                      setObjectColorSecondary(
                        value as ImageGenOptions.SecondaryColor | "",
                      )
                    }
                  >
                    <SelectTrigger id="color_secondary">
                      <SelectValue placeholder="-- Select Secondary Color --" />
                    </SelectTrigger>
                    <SelectContent>
                      {ImageGenOptions.SECONDARY_COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="color_highlights" className="block mb-1">
                    Highlights:{" "}
                  </Label>
                  <Select
                    value={objectColorHighlights}
                    onValueChange={(value) =>
                      setObjectColorHighlights(
                        value as ImageGenOptions.HighlightStyle | "",
                      )
                    }
                  >
                    <SelectTrigger id="color_highlights">
                      <SelectValue placeholder="-- Select Highlight Style --" />
                    </SelectTrigger>
                    <SelectContent>
                      {ImageGenOptions.HIGHLIGHT_STYLES.map((style) => (
                        <SelectItem key={style} value={style}>
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="color_rim_light" className="block mb-1">
                    Rim Light:{" "}
                  </Label>
                  <Select
                    value={objectColorRimLight}
                    onValueChange={(value) =>
                      setObjectColorRimLight(
                        value as ImageGenOptions.RimLightStyle | "",
                      )
                    }
                  >
                    <SelectTrigger id="color_rim_light">
                      <SelectValue placeholder="-- Select Rim Light Style --" />
                    </SelectTrigger>
                    <SelectContent>
                      {ImageGenOptions.RIM_LIGHT_STYLES.map((style) => (
                        <SelectItem key={style} value={style}>
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ),
    },
    {
      value: "environment",
      title: "Environment",
      content: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="env_elements" className="block mb-1">
              Elements:{" "}
            </Label>
            <Select
              value={envElements}
              onValueChange={(value) =>
                setEnvElements(value as ImageGenOptions.EnvironmentElement | "")
              }
            >
              <SelectTrigger id="env_elements">
                <SelectValue placeholder="-- Select Elements --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.ENVIRONMENT_ELEMENTS.map((el) => (
                  <SelectItem key={el} value={el}>
                    {el}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="env_material" className="block mb-1">
              Material:{" "}
            </Label>
            <Select
              value={envMaterial}
              onValueChange={(value) =>
                setEnvMaterial(
                  value as ImageGenOptions.EnvironmentMaterial | "",
                )
              }
            >
              <SelectTrigger id="env_material">
                <SelectValue placeholder="-- Select Material --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.ENVIRONMENT_MATERIALS.map((mat) => (
                  <SelectItem key={mat} value={mat}>
                    {mat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="env_scale" className="block mb-1">
              Scale:{" "}
            </Label>
            <Select
              value={envScale}
              onValueChange={(value) =>
                setEnvScale(value as ImageGenOptions.EnvironmentScale | "")
              }
            >
              <SelectTrigger id="env_scale">
                <SelectValue placeholder="-- Select Scale --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.ENVIRONMENT_SCALES.map((scale) => (
                  <SelectItem key={scale} value={scale}>
                    {scale}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="env_layout" className="block mb-1">
              Layout:{" "}
            </Label>
            <Select
              value={envLayout}
              onValueChange={(value) =>
                setEnvLayout(value as ImageGenOptions.EnvironmentLayout | "")
              }
            >
              <SelectTrigger id="env_layout">
                <SelectValue placeholder="-- Select Layout --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.ENVIRONMENT_LAYOUTS.map((layout) => (
                  <SelectItem key={layout} value={layout}>
                    {layout}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      value: "background",
      title: "Background",
      content: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="bg_color" className="block mb-1">
              Color:{" "}
            </Label>
            <Select
              value={bgColor}
              onValueChange={(value) =>
                setBgColor(value as ImageGenOptions.BackgroundColor | "")
              }
            >
              <SelectTrigger id="bg_color">
                <SelectValue placeholder="-- Select Color --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.BACKGROUND_COLORS.map((color) => (
                  <SelectItem key={color} value={color}>
                    {color}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bg_texture" className="block mb-1">
              Texture:{" "}
            </Label>
            <Select
              value={bgTexture}
              onValueChange={(value) =>
                setBgTexture(
                  value as ImageGenOptions.BackgroundTextureType | "",
                )
              }
            >
              <SelectTrigger id="bg_texture">
                <SelectValue placeholder="-- Select Texture --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.BACKGROUND_TEXTURES.map((tex) => (
                  <SelectItem key={tex} value={tex}>
                    {tex}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="bg_vignette"
              checked={bgVignette}
              onCheckedChange={(checked) => setBgVignette(Boolean(checked))}
            />
            <Label htmlFor="bg_vignette" className="cursor-pointer">
              Vignette
            </Label>
          </div>
        </div>
      ),
    },
  ];

  const accordionItemsCol2 = [
    {
      value: "lighting",
      title: "Lighting",
      content: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="light_type" className="block mb-1">
              Type:{" "}
            </Label>
            <Select
              value={lightingType}
              onValueChange={(value) =>
                setLightingType(value as ImageGenOptions.LightingType | "")
              }
            >
              <SelectTrigger id="light_type">
                <SelectValue placeholder="-- Select Type --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.LIGHTING_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="light_intensity" className="block mb-1">
              Intensity:{" "}
            </Label>
            <Select
              value={lightingIntensity}
              onValueChange={(value) =>
                setLightingIntensity(
                  value as ImageGenOptions.LightingIntensity | "",
                )
              }
            >
              <SelectTrigger id="light_intensity">
                <SelectValue placeholder="-- Select Intensity --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.LIGHTING_INTENSITIES.map((intensity) => (
                  <SelectItem key={intensity} value={intensity}>
                    {intensity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="light_direction" className="block mb-1">
              Direction:{" "}
            </Label>
            <Select
              value={lightingDirection}
              onValueChange={(value) =>
                setLightingDirection(
                  value as ImageGenOptions.LightingDirection | "",
                )
              }
            >
              <SelectTrigger id="light_direction">
                <SelectValue placeholder="-- Select Direction --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.LIGHTING_DIRECTIONS.map((dir) => (
                  <SelectItem key={dir} value={dir}>
                    {dir}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="light_accent_colors" className="block mb-1">
              Accent Colors:{" "}
            </Label>
            <Select
              value={lightingAccentColors}
              onValueChange={(value) =>
                setLightingAccentColors(
                  value as ImageGenOptions.LightingAccentColor | "",
                )
              }
            >
              <SelectTrigger id="light_accent_colors">
                <SelectValue placeholder="-- Select Accent Colors --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.LIGHTING_ACCENT_COLORS.map((color) => (
                  <SelectItem key={color} value={color}>
                    {color}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="light_reflections" className="block mb-1">
              Reflections:{" "}
            </Label>
            <Select
              value={lightingReflections}
              onValueChange={(value) =>
                setLightingReflections(
                  value as ImageGenOptions.LightingReflection | "",
                )
              }
            >
              <SelectTrigger id="light_reflections">
                <SelectValue placeholder="-- Select Reflections --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.LIGHTING_REFLECTIONS.map((refl) => (
                  <SelectItem key={refl} value={refl}>
                    {refl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="light_refractions" className="block mb-1">
              Refractions:{" "}
            </Label>
            <Select
              value={lightingRefractions}
              onValueChange={(value) =>
                setLightingRefractions(
                  value as ImageGenOptions.LightingRefraction | "",
                )
              }
            >
              <SelectTrigger id="light_refractions">
                <SelectValue placeholder="-- Select Refractions --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.LIGHTING_REFRACTIONS.map((refr) => (
                  <SelectItem key={refr} value={refr}>
                    {refr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="light_dispersion"
              checked={lightingDispersionEffects}
              onCheckedChange={(checked) =>
                setLightingDispersionEffects(Boolean(checked))
              }
            />
            <Label htmlFor="light_dispersion" className="cursor-pointer">
              Dispersion Effects
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="light_bloom"
              checked={lightingBloom}
              onCheckedChange={(checked) => setLightingBloom(Boolean(checked))}
            />
            <Label htmlFor="light_bloom" className="cursor-pointer">
              Bloom
            </Label>
          </div>
        </div>
      ),
    },
    {
      value: "post_processing",
      title: "Post Processing",
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="pp_chromatic_aberration"
              checked={ppChromaticAberration}
              onCheckedChange={(checked) =>
                setPpChromaticAberration(Boolean(checked))
              }
            />
            <Label htmlFor="pp_chromatic_aberration" className="cursor-pointer">
              Chromatic Aberration
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pp_glow"
              checked={ppGlow}
              onCheckedChange={(checked) => setPpGlow(Boolean(checked))}
            />
            <Label htmlFor="pp_glow" className="cursor-pointer">
              Glow
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pp_high_contrast"
              checked={ppHighContrast}
              onCheckedChange={(checked) => setPpHighContrast(Boolean(checked))}
            />
            <Label htmlFor="pp_high_contrast" className="cursor-pointer">
              High Contrast
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pp_sharp_details"
              checked={ppSharpDetails}
              onCheckedChange={(checked) => setPpSharpDetails(Boolean(checked))}
            />
            <Label htmlFor="pp_sharp_details" className="cursor-pointer">
              Sharp Details
            </Label>
          </div>
        </div>
      ),
    },
    {
      value: "camera",
      title: "Camera",
      content: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="cam_angle" className="block mb-1">
              Angle:{" "}
            </Label>
            <Select
              value={cameraAngle}
              onValueChange={(value) =>
                setCameraAngle(value as ImageGenOptions.CameraAngleType | "")
              }
            >
              <SelectTrigger id="cam_angle">
                <SelectValue placeholder="-- Select Angle --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.CAMERA_ANGLES.map((angle) => (
                  <SelectItem key={angle} value={angle}>
                    {angle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cam_focus" className="block mb-1">
              Focus:{" "}
            </Label>
            <Select
              value={cameraFocus}
              onValueChange={(value) =>
                setCameraFocus(value as ImageGenOptions.CameraFocusPoint | "")
              }
            >
              <SelectTrigger id="cam_focus">
                <SelectValue placeholder="-- Select Focus --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.CAMERA_FOCUS_POINTS.map((focus) => (
                  <SelectItem key={focus} value={focus}>
                    {focus}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cam_dof" className="block mb-1">
              Depth of Field:{" "}
            </Label>
            <Select
              value={cameraDof}
              onValueChange={(value) =>
                setCameraDof(
                  value as ImageGenOptions.CameraDepthOfFieldType | "",
                )
              }
            >
              <SelectTrigger id="cam_dof">
                <SelectValue placeholder="-- Select Depth of Field --" />
              </SelectTrigger>
              <SelectContent>
                {ImageGenOptions.CAMERA_DEPTH_OF_FIELDS.map((dof) => (
                  <SelectItem key={dof} value={dof}>
                    {dof}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
  ];

  // Get all unique accordion item values to manage the `defaultValue` for the main Accordion
  const allAccordionItemValues = [
    ...accordionItemsCol1,
    ...accordionItemsCol2,
  ].map((item) => item.value);

  return (
    <div className="flex p-5 h-screen w-full">
      <div className="mr-5 flex-shrink-0 w-[400px] h-[400px] border rounded-md flex justify-center items-center sticky top-5">
        {isLoading && <p>Loading...</p>}
        {!isLoading && imageUrl && (
          <h2>todo: Image</h2>
          // <Image
          //   src={imageUrl}
          //   alt="Generated"
          //   width={400}
          //   height={400}
          //   className="max-w-full max-h-full object-contain"
          // />
        )}
        {!isLoading && !imageUrl && <p>Image Preview</p>}
      </div>
      <ScrollArea className="flex-grow pr-5">
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Image Generation Options</h2>
            <Button
              onClick={onClose}
              variant="outline"
              className="w-10 mt-2 py-2 text-base"
            >
              X
            </Button>
          </div>
          <div>
            <Label htmlFor="prompt" className="block mb-1">
              Prompt:{" "}
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setPrompt(e.target.value)
              }
              placeholder="Enter your main prompt..."
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="style" className="block mb-1">
                Style:{" "}
              </Label>
              <Select
                value={selectedStyle}
                onValueChange={(value) =>
                  setSelectedStyle(value as ImageGenOptions.ImageStyle | "")
                }
              >
                <SelectTrigger id="style">
                  <SelectValue placeholder="-- Select Style --" />
                </SelectTrigger>
                <SelectContent>
                  {ImageGenOptions.IMAGE_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="scene_type" className="block mb-1">
                Scene Type:{" "}
              </Label>
              <Select
                value={selectedSceneType}
                onValueChange={(value) =>
                  setSelectedSceneType(value as ImageGenOptions.SceneType | "")
                }
              >
                <SelectTrigger id="scene_type">
                  <SelectValue placeholder="-- Select Scene Type --" />
                </SelectTrigger>
                <SelectContent>
                  {ImageGenOptions.SCENE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            {/* Column 1 for Accordions */}
            <div className="flex flex-col gap-y-0">
              {" "}
              {/* Reduced gap for accordions themselves */}
              <Accordion type="multiple" defaultValue={[]} className="w-full">
                {accordionItemsCol1.map((item) => (
                  <AccordionItem value={item.value} key={item.value}>
                    <AccordionTrigger className="text-base font-semibold py-3">
                      {item.title}
                    </AccordionTrigger>
                    <AccordionContent className="pt-0 pb-2 space-y-3">
                      {" "}
                      {/* Adjusted padding */}
                      {item.content}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Column 2 for Accordions */}
            <div className="flex flex-col gap-y-0">
              {" "}
              {/* Reduced gap for accordions themselves */}
              <Accordion type="multiple" defaultValue={[]} className="w-full">
                {accordionItemsCol2.map((item) => (
                  <AccordionItem value={item.value} key={item.value}>
                    <AccordionTrigger className="text-base font-semibold py-3">
                      {item.title}
                    </AccordionTrigger>
                    <AccordionContent className="pt-0 pb-2 space-y-3">
                      {" "}
                      {/* Adjusted padding */}
                      {item.content}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>

          <div>
            <Label htmlFor="aspect_ratio" className="block mb-1">
              Aspect Ratio:{" "}
            </Label>
            <Select
              value={aspectRatio}
              onValueChange={(value) =>
                setAspectRatio(
                  value as ImageGenOptions.ImageGenOptions["aspect_ratio"],
                )
              }
            >
              <SelectTrigger id="aspect_ratio">
                <SelectValue placeholder="-- Select Aspect Ratio --" />
              </SelectTrigger>
              <SelectContent>
                {(["1:1", "16:9", "9:16", "4:3", "3:4"] as const).map((ar) => (
                  <SelectItem key={ar} value={ar}>
                    {ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="negative_prompt" className="block mb-1">
              Negative Prompt:{" "}
            </Label>
            <Input
              type="text"
              id="negative_prompt"
              value={negativePrompt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNegativePrompt(e.target.value)
              }
              placeholder="Describe what to avoid..."
            />
          </div>

          <div>
            <Label htmlFor="seed" className="block mb-1">
              Seed:{" "}
            </Label>
            <Input
              type="number"
              id="seed"
              value={seed === undefined ? "" : seed}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSeed(
                  e.target.value === ""
                    ? undefined
                    : parseInt(e.target.value, 10),
                )
              }
              placeholder="Enter a seed (optional)"
            />
          </div>

          <Button
            onClick={handleSubmit}
            className="mt-2 py-2 text-base"
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : "Generate Image"}
          </Button>

          {imageUrl && !isLoading && (
            <Button onClick={handleAddImage} className="mt-2 py-2 text-base">
              Add Image to Canvas
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ImagePanel;
