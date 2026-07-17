// Motor de generación de placas para redes (Fulbo Studio).
// Portado del prototipo externo fulbo-social-cards: satori + resvg para el
// render, y composer LLM para armar el deck desde un artículo.
export { BRAND, FIRE, SIZES, type Size } from "./brand";
export { renderToPng } from "./render";
export { renderSlide, TEMPLATE_NAMES, type Slide, type TemplateName } from "./templates";
export { dataUriFromBuffer, dataUriFromFile, logoMark } from "./assets";
export { composeCarousel, type ComposeCarouselInput, type ComposeCarouselResult } from "./composer";
