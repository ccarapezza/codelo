import Image from "next/image";
import { CIUDAD_FOOTER } from "@/lib/vertical/laminas";

// Decoración del pie de ESTE sitio. El motor la renderiza como ranura sin
// saber qué hay adentro; un proyecto sin decoración no exporta nada y el pie
// queda liso.
export function FooterArt() {
  return (
    <>
      {/* Friso del oeste como FONDO de la banda: horizonte apoyado en el borde
          inferior, detrás del contenido y atenuado — cielo transparente (la
          tinta se ve a través), techos en papel y sol en ámbar; la escena del
          logo extendida a paisaje. Un solo bake porque la banda no sigue al
          tema. width/height en vez de fill: el alto sale del aspect del asset
          y el footer conserva el suyo propio. */}
      {/* En mobile el friso se ensancha más allá del viewport y se ancla a la
          derecha: a ancho completo la ciudad quedaba en una franja de ~50 px y
          el sol —que vive en el extremo derecho— era un punto. El excedente se
          recorta por la izquierda, que es la mitad tranquila del dibujo. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end">
        <Image
          src={CIUDAD_FOOTER.ink}
          alt=""
          width={1472}
          height={199}
          sizes="(min-width: 640px) 100vw, 220vw"
          className="h-auto w-[220%] max-w-none opacity-45 sm:w-full"
        />
      </div>
    </>
  );
}
