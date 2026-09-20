import Image from "next/image";
import { LAMINAS_TRANS, type LaminaId } from "@/lib/vertical/laminas";

// Qué se muestra en una página del CMS que no trae portada propia.
//
// Acá: una lámina de la casa impresa directo sobre el papel de la página, sin
// marco ni tratamiento. Dos bakes por tema — ver lib/vertical/laminas.ts.
// Qué lámina le toca a cada página del CMS. El motor pasa el slug; acá se
// decide. Un slug sin entrada cae a la hoja.
const POR_SLUG: Record<string, LaminaId> = {
  contacto: "tallo",
  "quienes-somos": "hoja",
  reprocann: "semillas",
};

export function PageDecoration({ variant }: { variant?: string }) {
  const clave = variant ?? "";
  const lamina = POR_SLUG[clave] ?? (clave in LAMINAS_TRANS ? (clave as LaminaId) : "hoja");
  const bake = LAMINAS_TRANS[lamina];
  if (!bake) return null;

  return (
    <div className="relative mb-10 aspect-[2/1] w-full">
      <Image
        src={bake.light}
        alt=""
        fill
        sizes="(min-width: 768px) 768px, 100vw"
        className="object-contain dark:hidden"
      />
      <Image
        src={bake.dark}
        alt=""
        fill
        sizes="(min-width: 768px) 768px, 100vw"
        className="hidden object-contain dark:block"
      />
    </div>
  );
}
