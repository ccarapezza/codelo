import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

// Activa el modo borrador (draftMode) y redirige a la nota real. Lo abre el
// panel (página Notas) con el secret compartido; una vez activo, la página
// /[lang]/blog/[slug] pide el BORRADOR al CMS en vez de la versión publicada.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const slug = searchParams.get("slug");
  const lang = searchParams.get("lang") || "es";

  const expected = process.env.CMS_PREVIEW_SECRET;
  if (!expected || secret !== expected) {
    return new Response("Preview secret inválido.", { status: 401 });
  }
  if (!slug) {
    return new Response("Falta el slug.", { status: 400 });
  }

  (await draftMode()).enable();
  // redirect() lanza una excepción interna de Next (control de flujo); es el uso
  // esperado en un route handler.
  redirect(`/${lang}/blog/${slug}`);
}
