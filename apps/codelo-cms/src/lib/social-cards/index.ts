// Motor de generación de placas para redes (Cogollos del Oeste).
// Portado de un prototipo externo: satori + resvg para el
// render, y composer LLM para armar el deck desde un artículo.
export { BRAND, FIRE, SIZES, type Size } from "./brand";
export { renderToPng } from "./render";
export { renderSlide, TEMPLATE_NAMES, type Slide, type TemplateName } from "./templates";
export { dataUriFromBuffer, dataUriFromFile, logoMark } from "./assets";
export { composeCarousel, type ComposeCarouselInput, type ComposeCarouselResult } from "./composer";
