// El bundler del admin (Vite) resuelve los imports de imágenes a una URL; esta
// declaración es sólo para que TypeScript no se queje del import del logo.
declare module "*.png" {
  const src: string;
  export default src;
}

// `?inline` le pide a Vite el CSS como string en vez de emitirlo como hoja
// aparte. Ver inject-styles.ts para por qué no alcanza con importar el .css.
declare module "*.css?inline" {
  const css: string;
  export default css;
}
