// El bundler del admin (Vite) resuelve los imports de imágenes a una URL; esta
// declaración es sólo para que TypeScript no se queje del import del logo.
declare module "*.png" {
  const src: string;
  export default src;
}
