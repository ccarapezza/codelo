// Motor de generación de placas para redes. Los colores y el logo salen de la
// instalación (`site-setting` → Identidad visual, vía getRenderContext); las
// tipografías, de la costura del vertical.
// Portado de un prototipo externo: satori + resvg para el
// render, y composer LLM para armar el deck desde un artículo.
export {
  fireGradient,
  resolveBrand,
  rgba,
  BRAND_COLOR_KEYS,
  NEUTRAL_BRAND_COLORS,
  settingKeyForColor,
  SIZES,
  type Brand,
  type BrandColors,
  type Size,
} from "./brand";
export { getRenderContext } from "./render-context";
export { renderToPng } from "./render";
export { renderSlide, TEMPLATE_NAMES, type RenderContext, type Slide, type TemplateName } from "./templates";
export { bundledLogoMark, dataUriFromBuffer, dataUriFromFile, uploadedLogoMark } from "./assets";
export { composeCarousel, type ComposeCarouselInput, type ComposeCarouselResult } from "./composer";
